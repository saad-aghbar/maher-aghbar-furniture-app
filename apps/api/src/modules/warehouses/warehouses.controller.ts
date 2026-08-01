import {
  BadRequestException,
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
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { ListActiveQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import type { AuthUser } from '@maher/types';

class WarehouseDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsString() @MinLength(1) type!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class LocationDto {
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() name?: string;
}

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('warehouse.manage')
  async list(@Query() query: ListActiveQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.WarehouseWhereInput = {
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        include: { locations: true, _count: { select: { balances: true } } },
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('warehouse.manage')
  async create(@Body() dto: WarehouseDto, @CurrentUser() user: AuthUser) {
    const clash = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
    if (clash) {
      throw new ConflictException({ code: 'DUPLICATE_CODE', message: 'Warehouse code already exists.' });
    }
    const row = await this.prisma.warehouse.create({
      data: {
        code: dto.code,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        type: dto.type,
        branchId: dto.branchId,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(user.id, 'warehouse.create', row.id, row);
    return row;
  }

  @Get(':id')
  @RequirePermissions('warehouse.manage')
  get(@Param('id') id: string) {
    return this.prisma.warehouse.findUniqueOrThrow({
      where: { id },
      include: {
        locations: true,
        balances: { include: { inventoryItem: true }, take: 50 },
      },
    });
  }

  @Patch(':id')
  @RequirePermissions('warehouse.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<WarehouseDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.warehouse.update({ where: { id }, data: dto });
    await this.audit(user.id, 'warehouse.update', id, row);
    return row;
  }

  @Post(':id/deactivate')
  @RequirePermissions('warehouse.manage')
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.warehouse.update({ where: { id }, data: { isActive: false } });
    await this.audit(user.id, 'warehouse.deactivate', id, null);
    return row;
  }

  @Post(':id/activate')
  @RequirePermissions('warehouse.manage')
  async activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.warehouse.update({ where: { id }, data: { isActive: true } });
    await this.audit(user.id, 'warehouse.activate', id, null);
    return row;
  }

  @Delete(':id')
  @RequirePermissions('warehouse.manage')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const [balances, txs] = await Promise.all([
      this.prisma.inventoryBalance.count({
        where: {
          warehouseId: id,
          OR: [{ availableQty: { gt: 0 } }, { reservedQty: { gt: 0 } }],
        },
      }),
      this.prisma.inventoryTransaction.count({ where: { warehouseId: id } }),
    ]);
    if (balances > 0 || txs > 0) {
      throw new ConflictException({
        code: 'WAREHOUSE_HAS_STOCK',
        message:
          'This warehouse cannot be deleted because it has stock or movement history. Deactivate it instead.',
      });
    }
    await this.prisma.warehouse.delete({ where: { id } });
    await this.audit(user.id, 'warehouse.delete', id, null);
    return { ok: true };
  }

  @Post(':id/locations')
  @RequirePermissions('warehouse.manage')
  async addLocation(
    @Param('id') warehouseId: string,
    @Body() dto: LocationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Warehouse not found.' });
    try {
      const row = await this.prisma.warehouseLocation.create({
        data: { warehouseId, code: dto.code, name: dto.name },
      });
      await this.audit(user.id, 'warehouse.location.create', row.id, row);
      return row;
    } catch {
      throw new ConflictException({
        code: 'LOCATION_EXISTS',
        message: 'Location code already exists in this warehouse.',
      });
    }
  }

  @Delete(':id/locations/:locationId')
  @RequirePermissions('warehouse.manage')
  async removeLocation(
    @Param('id') warehouseId: string,
    @Param('locationId') locationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const bal = await this.prisma.inventoryBalance.count({
      where: {
        locationId,
        OR: [{ availableQty: { gt: 0 } }, { reservedQty: { gt: 0 } }],
      },
    });
    if (bal > 0) {
      throw new BadRequestException({
        code: 'LOCATION_HAS_STOCK',
        message: 'Cannot remove a location that still has stock.',
      });
    }
    await this.prisma.warehouseLocation.delete({ where: { id: locationId } });
    await this.audit(user.id, 'warehouse.location.delete', locationId, { warehouseId });
    return { ok: true };
  }

  private audit(userId: string, action: string, entityId: string, newValues: unknown) {
    return this.prisma.auditEvent.create({
      data: {
        userId,
        action,
        entityType: 'Warehouse',
        entityId,
        newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
