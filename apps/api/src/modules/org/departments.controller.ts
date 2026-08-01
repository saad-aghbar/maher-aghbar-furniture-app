import {
  Body,
  ConflictException,
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
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { ListQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import type { AuthUser } from '@maher/types';

class DepartmentDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsUUID() branchId?: string;
}

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('department.manage')
  async list(@Query() query: ListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.DepartmentWhereInput = query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: 'insensitive' } },
            { nameEn: { contains: query.q, mode: 'insensitive' } },
            { nameAr: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.department.count({ where }),
      this.prisma.department.findMany({
        where,
        include: { branch: true },
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('department.manage')
  async create(@Body() dto: DepartmentDto, @CurrentUser() user: AuthUser) {
    const clash = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (clash) {
      throw new ConflictException({ code: 'DUPLICATE_CODE', message: 'Department code already exists.' });
    }
    const row = await this.prisma.department.create({ data: dto });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'department.create',
        entityType: 'Department',
        entityId: row.id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Patch(':id')
  @RequirePermissions('department.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<DepartmentDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Department not found.' });
    if (dto.code && dto.code !== existing.code) {
      const clash = await this.prisma.department.findUnique({ where: { code: dto.code } });
      if (clash) {
        throw new ConflictException({ code: 'DUPLICATE_CODE', message: 'Department code already exists.' });
      }
    }
    const row = await this.prisma.department.update({ where: { id }, data: dto });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'department.update',
        entityType: 'Department',
        entityId: id,
        newValues: row as unknown as Prisma.InputJsonValue,
      },
    });
    return row;
  }

  @Delete(':id')
  @RequirePermissions('department.manage')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.department.delete({ where: { id } });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'department.delete',
        entityType: 'Department',
        entityId: id,
      },
    });
    return { ok: true };
  }
}
