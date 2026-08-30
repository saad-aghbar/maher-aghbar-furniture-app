import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { ProductionInventoryService } from '../production/production-inventory.service';
import { ProductionReworkService } from '../production/production-rework.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QualityFloorService } from './quality-floor.service';
import type { AuthUser } from '@maher/types';

function isQcPass(result: QualityResult | null | undefined) {
  return result === QualityResult.PASSED || result === QualityResult.PASSED_WITH_NOTES;
}

function isQcFail(result: QualityResult | null | undefined) {
  return result === QualityResult.FAILED_REWORK_REQUIRED || result === QualityResult.BLOCKED;
}

class CreateInspectionDto {
  @IsUUID()
  productionOrderId!: string;

  @IsOptional()
  @IsString()
  stageCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class StartReworkDto {
  @IsUUID()
  stageInstanceId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class SubmitInspectionDto {
  @IsString()
  result!: QualityResult;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  defectDescription?: string;

  @IsOptional()
  @IsString()
  defectCategory?: string;

  @IsOptional()
  @IsNumber()
  affectedQty?: number;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsUUID()
  reentryStageInstanceId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  checklistResults?: { checklistCode: string; result: string; note?: string }[];

  @IsOptional()
  photoDocumentIds?: string[];
}

class ListQualityDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  productionOrderId?: string;
}

@ApiTags('quality')
@Controller('quality-inspections')
export class QualityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly pipeline: StagePipelineService,
    private readonly productionInventory: ProductionInventoryService,
    private readonly rework: ProductionReworkService,
    private readonly scheduling: SchedulingService,
    private readonly floor: QualityFloorService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @RequirePermissions('quality-inspection.read')
  async list(@Query() query: ListQualityDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = query.productionOrderId
      ? { productionOrderId: query.productionOrderId }
      : {};
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.qualityInspection.count({ where }),
      this.prisma.qualityInspection.findMany({
        where,
        include: {
          productionOrder: { include: { product: true, salesOrder: true } },
          inspector: true,
          defects: true,
          rework: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Get('attention')
  @RequirePermissions('quality-inspection.read')
  attention() {
    return this.floor.qualityAttentionCards();
  }

  @Get('orders/:productionOrderId/context')
  @RequirePermissions('quality-inspection.read')
  floorContext(@Param('productionOrderId') productionOrderId: string) {
    return this.floor.getFloorContextForOrder(productionOrderId);
  }

  @Get('orders/:productionOrderId/timeline')
  @RequirePermissions('quality-inspection.read')
  timeline(@Param('productionOrderId') productionOrderId: string) {
    return this.floor.buildTimeline(productionOrderId);
  }

  @Get('orders/:productionOrderId/rework-stages')
  @RequirePermissions('quality-inspection.read')
  reworkStages(
    @Param('productionOrderId') productionOrderId: string,
    @Query('category') category?: string,
  ) {
    return this.floor.listEligibleReworkStages(productionOrderId, category);
  }

  @Post()
  @RequirePermissions('quality-inspection.perform')
  async create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthUser) {
    const existingOpen = await this.prisma.qualityInspection.findFirst({
      where: {
        productionOrderId: dto.productionOrderId,
        result: null,
      },
      include: { items: true, productionOrder: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOpen) return existingOpen;

    if (dto.idempotencyKey) {
      const existing = await this.prisma.qualityInspection.findFirst({
        where: {
          productionOrderId: dto.productionOrderId,
          result: null,
          inspectorId: user.id,
        },
        include: { items: true, productionOrder: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return existing;
    }

    const template = await this.prisma.qualityChecklistTemplate.findFirst({
      where: {
        isActive: true,
        OR: [
          ...(dto.stageCode ? [{ stageCode: dto.stageCode }] : []),
          { code: 'FINAL_QC' },
        ],
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { code: 'asc' },
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      const number = await this.sequences.next('QC', 'QC');
      try {
        return await this.prisma.qualityInspection.create({
          data: {
            number,
            productionOrderId: dto.productionOrderId,
            stageCode: dto.stageCode ?? 'INSPECTION',
            inspectorId: user.id,
            notes: dto.notes,
            items: template?.items.length
              ? {
                  create: template.items.map((i) => ({
                    checklistCode: i.code,
                    label: i.labelEn,
                  })),
                }
              : undefined,
          },
          include: { items: true, productionOrder: true },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate quality inspection number');
  }

  @Post('rework/:reworkId/start')
  @RequirePermissions('quality-inspection.approve')
  startRework(
    @Param('reworkId') reworkId: string,
    @Body() dto: StartReworkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rework.startRework({
      reworkId,
      stageInstanceId: dto.stageInstanceId,
      notes: dto.notes,
      userId: user.id,
    });
  }

  @Post('rework/:reworkId/complete')
  @RequirePermissions('quality-inspection.perform')
  async completeRework(
    @Param('reworkId') reworkId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.rework.completeRework(reworkId, user.id);
    await this.notifications
      .notifyAdminUsers({
        templateCode: 'ORDER_CONFIRMED',
        vars: {
          number: result.number,
        },
        linkUrl: `/production/${result.productionOrderId}`,
      })
      .catch(() => undefined);
    return result;
  }

  @Get(':id')
  @RequirePermissions('quality-inspection.read')
  get(@Param('id') id: string) {
    return this.prisma.qualityInspection.findUniqueOrThrow({
      where: { id },
      include: {
        items: true,
        defects: true,
        rework: true,
        inspector: true,
        productionOrder: {
          include: { product: true, salesOrder: { include: { customer: true } } },
        },
      },
    });
  }

  @Post(':id/submit')
  @RequirePermissions('quality-inspection.perform')
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitInspectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const inspection = await this.prisma.qualityInspection.findUniqueOrThrow({ where: { id } });
    if (inspection.result && isQcPass(inspection.result)) {
      return this.prisma.qualityInspection.findUniqueOrThrow({
        where: { id },
        include: { items: true, defects: true, rework: true },
      });
    }
    if (inspection.result && isQcFail(inspection.result) && isQcFail(dto.result)) {
      return this.prisma.qualityInspection.findUniqueOrThrow({
        where: { id },
        include: { items: true, defects: true, rework: true },
      });
    }

    const previousResult = inspection.result;
    let firstNewlyCompletedTaskId: string | undefined;
    let createdReworkId: string | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.checklistResults?.length) {
        for (const item of dto.checklistResults) {
          await tx.qualityInspectionItem.updateMany({
            where: { inspectionId: id, checklistCode: item.checklistCode },
            data: {
              result: item.result as never,
              note: item.note,
            },
          });
        }
      }

      if (dto.photoDocumentIds?.length) {
        await tx.document.updateMany({
          where: { id: { in: dto.photoDocumentIds } },
          data: {
            productionOrderId: inspection.productionOrderId,
            category: `QC_PHOTO:${id}`,
            visibility: 'INTERNAL',
          },
        });
      }

      const updated = await tx.qualityInspection.update({
        where: { id },
        data: {
          result: dto.result,
          notes: dto.notes ?? inspection.notes,
          inspectorId: user.id,
          inspectedAt: new Date(),
        },
        include: { items: true, defects: true },
      });

      if (isQcFail(dto.result)) {
        const category = dto.defectCategory ?? 'OTHER';
        const affected =
          dto.affectedQty != null ? `Affected qty: ${dto.affectedQty}. ` : '';
        const description =
          `${affected}${dto.defectDescription ?? 'Rework required'}`.trim();
        await tx.qualityDefect.create({
          data: {
            inspectionId: id,
            description,
            severity: dto.severity ?? 'HIGH',
            stageCode: category,
            correctiveAction: dto.reentryStageInstanceId
              ? `Rework stage ${dto.reentryStageInstanceId}`
              : null,
          },
        });
        const existingOpen = await tx.reworkRequest.findFirst({
          where: {
            inspectionId: id,
            status: { in: ['AWAITING_STAGE', 'IN_PROGRESS'] },
          },
        });
        if (!existingOpen) {
          const reworkNumber = await this.sequences.next('RW', 'RW');
          const created = await tx.reworkRequest.create({
            data: {
              number: reworkNumber,
              productionOrderId: inspection.productionOrderId,
              inspectionId: id,
              description,
              status: 'AWAITING_STAGE',
              reentryStageInstanceId: dto.reentryStageInstanceId ?? null,
            },
          });
          createdReworkId = created.id;
        } else {
          createdReworkId = existingOpen.id;
        }
        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId },
          data: { status: 'ON_HOLD' },
        });
        await this.productionInventory.reverseFinishedGoods({
          productionOrderId: inspection.productionOrderId,
          userId: user.id,
          tx,
        });
      }

      if (isQcPass(dto.result)) {
        const stageCode = inspection.stageCode ?? 'INSPECTION';
        const stage = await tx.productionStageInstance.findFirst({
          where: {
            productionOrderId: inspection.productionOrderId,
            stageDefinition: { code: stageCode },
          },
          include: { tasks: true, stageDefinition: true },
        });
        if (stage) {
          for (const task of stage.tasks) {
            if (task.status !== 'COMPLETED' && !task.isRework) {
              await tx.productionTask.update({
                where: { id: task.id },
                data: {
                  status: 'COMPLETED',
                  progressPercent: 100,
                  actualCompletion: new Date(),
                },
              });
              firstNewlyCompletedTaskId ??= task.id;
            }
          }
          await this.productionInventory.onInspectionPassed({
            productionOrderId: inspection.productionOrderId,
            userId: user.id,
            tx,
          });
          await this.pipeline.onTaskComplete(
            inspection.productionOrderId,
            stage.id,
            tx,
          );
        } else {
          await this.productionInventory.onInspectionPassed({
            productionOrderId: inspection.productionOrderId,
            userId: user.id,
            tx,
          });
          await this.pipeline.unlockReadyStages(inspection.productionOrderId, tx);
          await this.pipeline.rollupProgress(inspection.productionOrderId, tx);
        }

        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId },
          data: { status: 'IN_PROGRESS' },
        });
        await this.pipeline.rollupProgress(inspection.productionOrderId, tx);
      }

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          action: 'quality.submit',
          entityType: 'QualityInspection',
          entityId: id,
          newValues: {
            result: dto.result,
            defectCategory: dto.defectCategory ?? null,
            affectedQty: dto.affectedQty ?? null,
          },
        },
      });

      return updated;
    });

    if (createdReworkId && dto.reentryStageInstanceId) {
      await this.rework
        .startRework({
          reworkId: createdReworkId,
          stageInstanceId: dto.reentryStageInstanceId,
          notes: dto.notes,
          userId: user.id,
        })
        .catch(() => undefined);
    }

    if (isQcPass(dto.result) && !isQcPass(previousResult)) {
      await this.scheduling.enqueueTargetedReplan(
        inspection.productionOrderId,
        'qc-pass',
        firstNewlyCompletedTaskId,
      );
      await this.notifications
        .notifyAdminUsers({
          templateCode: 'ORDER_CONFIRMED',
          vars: { number: updated.number },
          linkUrl: `/production/${inspection.productionOrderId}`,
        })
        .catch(() => undefined);
    } else if (isQcFail(dto.result) && !isQcFail(previousResult)) {
      await this.scheduling.enqueueTargetedReplan(inspection.productionOrderId, 'qc-fail');
      await this.notifications
        .notifyAdminUsers({
          templateCode: 'ORDER_CONFIRMED',
          vars: { number: updated.number },
          linkUrl: `/production/${inspection.productionOrderId}`,
        })
        .catch(() => undefined);
    }

    return this.prisma.qualityInspection.findUniqueOrThrow({
      where: { id },
      include: { items: true, defects: true, rework: true },
    });
  }
}
