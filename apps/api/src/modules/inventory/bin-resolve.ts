import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { defaultBinCode, formatBinQrCode } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';

export type BinDb = PrismaService | Prisma.TransactionClient;

export type BinPick = {
  locationId: string;
  warehouseId: string;
  quantity: number;
};

export async function allocateBinQrCode(
  db: BinDb,
  warehouseCode: string,
  locationCode: string,
): Promise<string> {
  const base = formatBinQrCode(warehouseCode, locationCode);
  let candidate = base;
  let n = 0;
  while (await db.warehouseLocation.findUnique({ where: { qrCode: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function ensureDefaultBinId(db: BinDb, warehouseId: string): Promise<string> {
  const existing = await db.warehouseLocation.findFirst({
    where: { warehouseId, isDefault: true },
  });
  if (existing) {
    if (!existing.qrCode) {
      const warehouse = await db.warehouse.findUnique({
        where: { id: warehouseId },
        select: { code: true },
      });
      const qrCode = await allocateBinQrCode(db, warehouse?.code ?? 'WH', existing.code);
      await db.warehouseLocation.update({ where: { id: existing.id }, data: { qrCode } });
    }
    return existing.id;
  }

  const warehouse = await db.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, code: true },
  });
  if (!warehouse) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Warehouse not found.' });
  }
  const code = defaultBinCode(warehouse.code);
  const found = await db.warehouseLocation.findUnique({
    where: { warehouseId_code: { warehouseId, code } },
  });
  if (found) {
    await db.warehouseLocation.updateMany({
      where: { warehouseId, isDefault: true, id: { not: found.id } },
      data: { isDefault: false },
    });
    const qrCode = found.qrCode || (await allocateBinQrCode(db, warehouse.code, found.code));
    await db.warehouseLocation.update({
      where: { id: found.id },
      data: { isDefault: true, qrCode, name: found.name || 'Main floor' },
    });
    return found.id;
  }

  const qrCode = await allocateBinQrCode(db, warehouse.code, code);
  try {
    const created = await db.warehouseLocation.create({
      data: {
        warehouseId,
        code,
        name: 'Main floor',
        isDefault: true,
        qrCode,
      },
    });
    return created.id;
  } catch {
    const raced = await db.warehouseLocation.findUnique({
      where: { warehouseId_code: { warehouseId, code } },
    });
    if (raced) return raced.id;
    throw new BadRequestException({
      code: 'LOCATION_EXISTS',
      message: 'Could not create the default bin for this warehouse.',
    });
  }
}

export async function resolveBinId(
  db: BinDb,
  warehouseId: string,
  locationId?: string | null,
): Promise<string> {
  if (locationId) {
    const loc = await db.warehouseLocation.findFirst({
      where: { id: locationId, warehouseId },
    });
    if (!loc) {
      throw new BadRequestException({
        code: 'LOCATION_NOT_IN_WAREHOUSE',
        message: 'That bin does not belong to the selected warehouse.',
      });
    }
    return loc.id;
  }
  return ensureDefaultBinId(db, warehouseId);
}

export async function pickBinsForIssue(
  db: BinDb,
  params: {
    inventoryItemId: string;
    warehouseId: string;
    quantity: number;
    locationId?: string | null;
  },
): Promise<BinPick[]> {
  if (params.locationId) {
    const locationId = await resolveBinId(db, params.warehouseId, params.locationId);
    return [{ locationId, warehouseId: params.warehouseId, quantity: params.quantity }];
  }

  const rows = await db.inventoryBalance.findMany({
    where: { inventoryItemId: params.inventoryItemId, warehouseId: params.warehouseId },
    orderBy: { availableQty: 'desc' },
  });
  let remaining = params.quantity;
  const picks: BinPick[] = [];
  for (const row of rows) {
    if (remaining <= 1e-9) break;
    if (!row.locationId) continue;
    const avail = Number(row.availableQty);
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    picks.push({
      locationId: row.locationId,
      warehouseId: params.warehouseId,
      quantity: take,
    });
    remaining -= take;
  }
  if (remaining > 1e-9) {
    const defaultId = await ensureDefaultBinId(db, params.warehouseId);
    const existing = picks.find((p) => p.locationId === defaultId);
    if (existing) existing.quantity += remaining;
    else {
      picks.push({
        locationId: defaultId,
        warehouseId: params.warehouseId,
        quantity: remaining,
      });
    }
  }
  if (!picks.length) {
    return [
      {
        locationId: await ensureDefaultBinId(db, params.warehouseId),
        warehouseId: params.warehouseId,
        quantity: params.quantity,
      },
    ];
  }
  return picks;
}

export function freeQtyOf(row: { availableQty?: unknown; reservedQty?: unknown }): number {
  return Number(row.availableQty ?? 0) - Number(row.reservedQty ?? 0);
}

export function warehouseStockFromBalances(
  rows: Array<{ availableQty?: unknown; reservedQty?: unknown }>,
): { available: number; reserved: number; free: number } {
  const available = rows.reduce((s, r) => s + Number(r.availableQty ?? 0), 0);
  const reserved = rows.reduce((s, r) => s + Number(r.reservedQty ?? 0), 0);
  return { available, reserved, free: available - reserved };
}
