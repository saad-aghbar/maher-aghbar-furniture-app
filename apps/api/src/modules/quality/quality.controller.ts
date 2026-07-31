import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { QualityResult } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
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

class SubmitInspectionDto {
  @IsString()
  result!: QualityResult;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  defectDescription?: string;
}

@ApiTags('quality')
@Controller('quality-inspections')
export class QualityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get()
  @RequirePermissions('quality-inspection.read')
  async list(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.qualityInspection.count(),
      this.prisma.qualityInspection.findMany({
        include: { productionOrder: true, inspector: true, defects: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('quality-inspection.perform')
  async create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthUser) {
    const number = await this.sequences.next('QC', 'QC');
    return this.prisma.qualityInspection.create({
      data: {
        number,
        productionOrderId: dto.productionOrderId,
        stageCode: dto.stageCode,
        inspectorId: user.id,
        notes: dto.notes,
      },
    });
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
      const updated = await tx.qualityInspection.update({
        where: { id },
        data: { result: dto.result, notes: dto.notes ?? inspection.notes },
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
          },
        });
        await tx.productionOrder.update({
          where: { id: inspection.productionOrderId },
          data: { status: 'ON_HOLD' },
        });
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
