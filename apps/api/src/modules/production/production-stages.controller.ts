import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import { buildDependencyGraph, detectCycles } from '../scheduling/domain';
import type { AuthUser } from '@maher/types';

class StageDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @Type(() => Number) @IsNumber() sortOrder!: number;
  @IsOptional() @Type(() => Number) @IsNumber() estimatedHours?: number;
  @IsOptional() @IsBoolean() requiresInspection?: boolean;
  @IsOptional() @IsBoolean() requiresPhotos?: boolean;
  @IsOptional() @IsString() responsibleDepartment?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOnCodes?: string[];
}

@ApiTags('production-stages')
@Controller('production-stages')
export class ProductionStagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('production-order.update')
  async list(@Query() query: ListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.ProductionStageDefinitionWhereInput = query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: 'insensitive' } },
            { nameEn: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionStageDefinition.count({ where }),
      this.prisma.productionStageDefinition.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('production-order.update')
  async create(@Body() dto: StageDto, @CurrentUser() user: AuthUser) {
    await this.assertNoCycle(dto.code, dto.dependsOnCodes ?? []);
    const row = await this.prisma.productionStageDefinition.create({
      data: {
        ...dto,
        requiresInspection: dto.requiresInspection ?? false,
        requiresPhotos: dto.requiresPhotos ?? false,
        isActive: dto.isActive ?? true,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.create',
        entityType: 'ProductionStageDefinition',
        entityId: row.id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Patch(':id')
  @RequirePermissions('production-order.update')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<StageDto>,
    @CurrentUser() user: AuthUser,
  ) {
    if (dto.code || dto.dependsOnCodes) {
      const existing = await this.prisma.productionStageDefinition.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage not found.' });
      await this.assertNoCycle(dto.code ?? existing.code, dto.dependsOnCodes ?? existing.dependsOnCodes, id);
    }
    const row = await this.prisma.productionStageDefinition.update({ where: { id }, data: dto });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.update',
        entityType: 'ProductionStageDefinition',
        entityId: id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Post(':id/deactivate')
  @RequirePermissions('production-order.update')
  deactivate(@Param('id') id: string) {
    return this.prisma.productionStageDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }

  @Post(':id/activate')
  @RequirePermissions('production-order.update')
  activate(@Param('id') id: string) {
    return this.prisma.productionStageDefinition.update({
      where: { id },
      data: { isActive: true },
    });
  }

  @Delete(':id')
  @RequirePermissions('production-order.update')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const used = await this.prisma.productionStageInstance.count({ where: { stageDefinitionId: id } });
    if (used > 0) {
      await this.prisma.productionStageDefinition.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    const existing = await this.prisma.productionStageDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage not found.' });
    await this.prisma.productionStageDefinition.delete({ where: { id } });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'stage.delete',
        entityType: 'ProductionStageDefinition',
        entityId: id,
      },
    });
    return { ok: true };
  }

  /** Guards against introducing a dependency cycle across all active stage definitions. */
  private async assertNoCycle(code: string, dependsOnCodes: string[], excludeId?: string) {
    const existing = await this.prisma.productionStageDefinition.findMany({
      where: { isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { code: true, dependsOnCodes: true },
    });
    const nodes = [
      ...existing.filter((s) => s.code !== code),
      { code, dependsOnCodes },
    ];
    const graph = buildDependencyGraph(nodes);
    const cycle = detectCycles(graph);
    if (cycle.length > 0) {
      throw new BadRequestException({
        code: 'STAGE_CYCLE',
        message: `Stage dependency cycle detected: ${cycle.join(' -> ')}`,
      });
    }
  }
}
