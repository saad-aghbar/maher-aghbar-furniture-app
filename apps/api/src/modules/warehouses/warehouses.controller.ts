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
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListActiveQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import {
  nextLocationCode,
  nextWarehouseCode,
  slugFromWarehouseName,
} from '../../common/helpers/warehouse-code.util';
import { binScanPayload, type AuthUser } from '@maher/types';
import { allocateBinQrCode, ensureDefaultBinId } from '../inventory/bin-resolve';

class WarehouseDto {
  /** Optional — auto-generated from the English name when omitted. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsString()
  @MinLength(1)
  nameAr!: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsIn(['RAW_MATERIALS', 'SEMI_FINISHED', 'FINISHED_GOODS'])
  type!: string;

  @IsOptional()
  @IsString()
  nameHe?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class LocationDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class LocationPatchDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('warehouses')
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequireAnyPermissions('warehouse.read', 'warehouse.manage')
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
    const provided = dto.code?.trim();
    const existing = provided
      ? []
      : await this.prisma.warehouse.findMany({ select: { code: true } });
    const code =
      provided ||
      nextWarehouseCode(
        slugFromWarehouseName(dto.nameEn),
        existing.map((row) => row.code),
      );
    const clash = await this.prisma.warehouse.findUnique({ where: { code } });
    if (clash) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: 'Warehouse code already exists.',
      });
    }
    const row = await this.prisma.warehouse.create({
      data: {
        code,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn.trim(),
        nameHe: dto.nameHe?.trim() || undefined,
        type: dto.type as never,
        branchId: dto.branchId,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });
    if (row.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { type: row.type, isDefault: true, id: { not: row.id } },
        data: { isDefault: false },
      });
    }
    await this.audit(user.id, 'warehouse.create', row.id, row);
    await ensureDefaultBinId(this.prisma, row.id);
    return this.prisma.warehouse.findUniqueOrThrow({
      where: { id: row.id },
      include: { locations: true },
    });
  }

  @Get('locations/by-code/:code')
  @RequireAnyPermissions('warehouse.read', 'warehouse.manage', 'inventory.read', 'inventory.receive')
  async findLocationByCode(@Param('code') raw: string) {
    const code = decodeURIComponent(String(raw ?? '')).trim();
    if (!code) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Bin not found.' });
    }
    const prefixed = code.startsWith('BIN:') && !code.startsWith('BIN-');
    const idOrCode = prefixed ? code.slice('BIN:'.length) : code;
    const stripped = code.startsWith('BIN-') ? code.slice('BIN-'.length) : '';
    const location = await this.prisma.warehouseLocation.findFirst({
      where: prefixed
        ? { id: idOrCode }
        : {
            OR: [
              { qrCode: code },
              { id: idOrCode },
              { code: idOrCode },
              ...(stripped ? [{ code: stripped }] : []),
            ],
          },
      include: {
        warehouse: {
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true, type: true },
        },
        balances: {
          where: {
            OR: [{ availableQty: { gt: 0 } }, { reservedQty: { gt: 0 } }],
          },
          include: {
            inventoryItem: {
              select: {
                id: true,
                sku: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                unit: true,
                imageUrl: true,
              },
            },
          },
          take: 80,
        },
      },
    });
    if (!location) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Bin not found.' });
    }
    return {
      ...location,
      scanCode: binScanPayload(location),
      contents: location.balances.map((b) => ({
        inventoryItemId: b.inventoryItemId,
        sku: b.inventoryItem.sku,
        nameEn: b.inventoryItem.nameEn,
        nameAr: b.inventoryItem.nameAr,
        nameHe: b.inventoryItem.nameHe,
        unit: b.inventoryItem.unit,
        imageUrl: b.inventoryItem.imageUrl,
        availableQty: Number(b.availableQty),
        reservedQty: Number(b.reservedQty),
      })),
    };
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
    const row = await this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.nameHe !== undefined ? { nameHe: dto.nameHe } : {}),
        ...(dto.type !== undefined ? { type: dto.type as Prisma.WarehouseUpdateInput['type'] } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.branchId !== undefined ? { branch: { connect: { id: dto.branchId } } } : {}),
      },
    });
    const type = (dto.type ?? row.type) as string;
    if (dto.isDefault === true) {
      await this.prisma.warehouse.updateMany({
        where: { type: type as never, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
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
  @RequireAnyPermissions('warehouse.manage', 'inventory.receive')
  async addLocation(
    @Param('id') warehouseId: string,
    @Body() dto: LocationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Warehouse not found.' });
    const existing = await this.prisma.warehouseLocation.findMany({
      where: { warehouseId },
      select: { code: true },
    });
    const code =
      dto.code?.trim() ||
      nextLocationCode(
        dto.name ?? '',
        existing.map((row) => row.code),
      );
    try {
      const qrCode = await allocateBinQrCode(this.prisma, warehouse.code, code);
      const row = await this.prisma.warehouseLocation.create({
        data: { warehouseId, code, name: dto.name?.trim() || dto.name, qrCode },
      });
      await this.audit(user.id, 'warehouse.location.create', row.id, row);
      return { ...row, scanCode: binScanPayload(row) };
    } catch {
      throw new ConflictException({
        code: 'LOCATION_EXISTS',
        message: 'Location code already exists in this warehouse.',
      });
    }
  }

  @Patch(':id/locations/:locationId')
  @RequireAnyPermissions('warehouse.manage', 'inventory.receive')
  async updateLocation(
    @Param('id') warehouseId: string,
    @Param('locationId') locationId: string,
    @Body() dto: LocationPatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouseId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Holding location not found.' });
    }
    try {
      if (dto.isDefault === true) {
        await this.prisma.warehouseLocation.updateMany({
          where: { warehouseId, isDefault: true, id: { not: locationId } },
          data: { isDefault: false },
        });
      }
      const row = await this.prisma.warehouseLocation.update({
        where: { id: locationId },
        data: {
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      await this.audit(user.id, 'warehouse.location.update', row.id, row);
      return { ...row, scanCode: binScanPayload(row) };
    } catch {
      throw new ConflictException({
        code: 'LOCATION_EXISTS',
        message: 'Location code already exists in this warehouse.',
      });
    }
  }

  @Delete(':id/locations/:locationId')
  @RequireAnyPermissions('warehouse.manage', 'inventory.receive')
  async removeLocation(
    @Param('id') warehouseId: string,
    @Param('locationId') locationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.warehouseLocation.findFirst({
      where: { id: locationId, warehouseId },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Holding location not found.' });
    }
    if (existing.isDefault) {
      throw new BadRequestException({
        code: 'DEFAULT_LOCATION',
        message: 'The main floor bin cannot be deleted. Deactivate extra bins instead.',
      });
    }
    const [bal, lots, kits] = await Promise.all([
      this.prisma.inventoryBalance.count({
        where: {
          locationId,
          OR: [{ availableQty: { gt: 0 } }, { reservedQty: { gt: 0 } }],
        },
      }),
      this.prisma.inventoryLot.count({
        where: { locationId, remainingQty: { gt: 0 } },
      }),
      this.prisma.wipKit.count({ where: { locationId } }),
    ]);
    if (bal > 0 || lots > 0 || kits > 0) {
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
