import { Body, Controller, Get, Optional, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { ProductionReworkService } from '../production/production-rework.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { QualityFloorService } from './quality-floor.service';
import { QualityInspectionService, isQcPass, isQcFail } from './quality-inspection.service';
import { ReturnPieceService } from '../contracts/return-piece.service';
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
  @IsOptional()
  @IsString()
  result?: QualityResult;

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
  checklistResults?: {
    checklistCode: string;
    result: string;
    note?: string;
    reentryStageInstanceIds?: string[];
    voiceDocumentId?: string;
    photoDocumentIds?: string[];
    defectDescription?: string;
  }[];

  @IsOptional()
  photoDocumentIds?: string[];

  @IsOptional()
  @IsUUID()
  voiceDocumentId?: string;
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
    private readonly rework: ProductionReworkService,
    private readonly scheduling: SchedulingService,
    private readonly floor: QualityFloorService,
    private readonly inspections: QualityInspectionService,
    @Optional() private readonly returnPieces?: ReturnPieceService,
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
    return this.inspections.create({
      productionOrderId: dto.productionOrderId,
      stageCode: dto.stageCode,
      notes: dto.notes,
      inspectorId: user.id,
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
    const result = await this.rework.completeRework(reworkId, user.id);
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
    const before = await this.prisma.qualityInspection.findUniqueOrThrow({ where: { id } });
    const previousResult = before.result;
    const updated = await this.inspections.submit({
      id,
      userId: user.id,
      result: dto.result,
      notes: dto.notes,
      defectDescription: dto.defectDescription,
      defectCategory: dto.defectCategory,
      affectedQty: dto.affectedQty,
      severity: dto.severity,
      reentryStageInstanceId: dto.reentryStageInstanceId,
      checklistResults: dto.checklistResults,
      photoDocumentIds: dto.photoDocumentIds,
      voiceDocumentId: dto.voiceDocumentId,
    });

    const nextResult = updated.result;
    if (isQcPass(nextResult) || isQcFail(nextResult) || (!nextResult && !previousResult)) {
      await this.returnPieces
        ?.onQualityResult(before.productionOrderId, Boolean(isQcPass(nextResult)))
        .catch(() => undefined);
    }

    if (isQcPass(nextResult) && !isQcPass(previousResult)) {
      await this.scheduling.enqueueTargetedReplan(before.productionOrderId, 'qc-pass');
    } else if ((isQcFail(nextResult) || (!nextResult && dto.checklistResults?.some((i) => i.result === 'FAIL'))) && !isQcFail(previousResult)) {
      await this.scheduling.enqueueTargetedReplan(before.productionOrderId, 'qc-fail');
    }

    return updated;
  }
}
