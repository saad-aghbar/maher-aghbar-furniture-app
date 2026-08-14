import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { ProductionInventoryService } from '../production/production-inventory.service';
import { ProductionReworkService } from '../production/production-rework.service';
import type { AuthUser } from '@maher/types';

class CreateInspectionDto {
  @IsUUID()
  productionOrderId!: string;

  @IsOptional()
  @IsString()
  stageCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
  checklistResults?: { checklistCode: string; result: string; note?: string }[];
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
  ) {}

  @Get()
  @RequirePermissions('quality-inspection.read')
  async list(@Query() query: PaginationDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.qualityInspection.count(),
      this.prisma.qualityInspection.findMany({
        include: { productionOrder: true, inspector: true, defects: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('quality-inspection.perform')
  async create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthUser) {
    const number = await this.sequences.next('QC', 'QC');
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

    return this.prisma.qualityInspection.create({
      data: {
        number,
        productionOrderId: dto.productionOrderId,
        stageCode: dto.stageCode,
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
    return this.rework.completeRework(reworkId, user.id);
  }

  @Get(':id')
  @RequirePermissions('quality-inspection.read')
  get(@Param('id') id: string) {
    return this.prisma.qualityInspection.findUniqueOrThrow({
      where: { id },
      include: { items: true, defects: true, rework: true },
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
    return this.prisma.$transaction(async (tx) => {
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

      const updated = await tx.qualityInspection.update({
        where: { id },
        data: { result: dto.result, notes: dto.notes ?? inspection.notes },
        include: { items: true, defects: true },
      });

      if (
        dto.result === QualityResult.FAILED_REWORK_REQUIRED ||
        dto.result === QualityResult.BLOCKED
      ) {
        if (dto.defectDescription) {
          await tx.qualityDefect.create({
            data: {
              inspectionId: id,
              description: dto.defectDescription,
              severity: 'HIGH',
              stageCode: inspection.stageCode,
            },
          });
        }
        const reworkNumber = await this.sequences.next('RW', 'RW');
        await tx.reworkRequest.create({
          data: {
            number: reworkNumber,
            productionOrderId: inspection.productionOrderId,
            inspectionId: id,
            description: dto.defectDescription ?? 'Rework required',
            status: 'AWAITING_STAGE',
          },
        });
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

      if (
        dto.result === QualityResult.PASSED ||
        dto.result === QualityResult.PASSED_WITH_NOTES
      ) {
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
            if (task.status !== 'COMPLETED') {
              await tx.productionTask.update({
                where: { id: task.id },
                data: {
                  status: 'COMPLETED',
                  progressPercent: 100,
                  actualCompletion: new Date(),
                },
              });
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
          newValues: { result: dto.result },
        },
      });

      return updated;
    });
  }
}
