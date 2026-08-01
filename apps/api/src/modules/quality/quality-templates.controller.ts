import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '@maher/types';

class ChecklistItemDto {
  @IsString()
  code!: string;

  @IsString()
  labelAr!: string;

  @IsString()
  labelEn!: string;

  @IsOptional()
  sortOrder?: number;
}

class UpsertTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  nameAr!: string;

  @IsString()
  nameEn!: string;

  @IsOptional()
  @IsString()
  stageCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items?: ChecklistItemDto[];
}

@ApiTags('quality-templates')
@Controller('quality-checklist-templates')
export class QualityTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('quality-inspection.read')
  list() {
    return this.prisma.qualityChecklistTemplate.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { code: 'asc' },
    });
  }

  @Get(':id')
  @RequirePermissions('quality-inspection.read')
  get(@Param('id') id: string) {
    return this.prisma.qualityChecklistTemplate.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Post()
  @RequirePermissions('quality-inspection.approve')
  async create(@Body() dto: UpsertTemplateDto, @CurrentUser() user: AuthUser) {
    const template = await this.prisma.qualityChecklistTemplate.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        stageCode: dto.stageCode,
        isActive: dto.isActive ?? true,
        items: dto.items?.length
          ? {
              create: dto.items.map((i, idx) => ({
                code: i.code,
                labelAr: i.labelAr,
                labelEn: i.labelEn,
                sortOrder: i.sortOrder ?? idx + 1,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'quality-template.create',
        entityType: 'QualityChecklistTemplate',
        entityId: template.id,
      },
    });
    return template;
  }

  @Patch(':id')
  @RequirePermissions('quality-inspection.approve')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertTemplateDto>,
    @CurrentUser() user: AuthUser,
  ) {
    if (dto.items) {
      await this.prisma.qualityChecklistItem.deleteMany({ where: { templateId: id } });
    }
    const template = await this.prisma.qualityChecklistTemplate.update({
      where: { id },
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        stageCode: dto.stageCode,
        isActive: dto.isActive,
        items: dto.items
          ? {
              create: dto.items.map((i, idx) => ({
                code: i.code,
                labelAr: i.labelAr,
                labelEn: i.labelEn,
                sortOrder: i.sortOrder ?? idx + 1,
              })),
            }
          : undefined,
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'quality-template.update',
        entityType: 'QualityChecklistTemplate',
        entityId: id,
      },
    });
    return template;
  }
}
