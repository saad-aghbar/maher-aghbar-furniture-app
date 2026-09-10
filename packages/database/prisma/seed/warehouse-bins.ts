import type { PrismaClient } from '@prisma/client';

export function defaultBinCode(warehouseCode: string): string {
  const code = String(warehouseCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
  return `${code || 'WH'}-MAIN`;
}

export function formatBinQrCode(warehouseCode: string, locationCode: string): string {
  const wh =
    String(warehouseCode ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 12) || 'WH';
  const loc =
    String(locationCode ?? '')
      .replace(/[^A-Za-z0-9-]/g, '')
      .toUpperCase()
      .slice(0, 24) || 'BIN';
  return `BIN-${wh}-${loc}`;
}

export async function allocateBinQrCode(
  prisma: PrismaClient,
  warehouseCode: string,
  locationCode: string,
): Promise<string> {
  const base = formatBinQrCode(warehouseCode, locationCode);
  let candidate = base;
  let n = 0;
  while (await prisma.warehouseLocation.findUnique({ where: { qrCode: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function ensureDefaultWarehouseBin(
  prisma: PrismaClient,
  warehouse: { id: string; code: string },
): Promise<{ id: string; code: string; qrCode: string | null; isDefault: boolean }> {
  const existingDefault = await prisma.warehouseLocation.findFirst({
    where: { warehouseId: warehouse.id, isDefault: true },
  });
  if (existingDefault) {
    if (!existingDefault.qrCode) {
      const qrCode = await allocateBinQrCode(prisma, warehouse.code, existingDefault.code);
      return prisma.warehouseLocation.update({
        where: { id: existingDefault.id },
        data: { qrCode },
      });
    }
    return existingDefault;
  }

  const code = defaultBinCode(warehouse.code);
  const found = await prisma.warehouseLocation.findUnique({
    where: { warehouseId_code: { warehouseId: warehouse.id, code } },
  });
  if (found) {
    await prisma.warehouseLocation.updateMany({
      where: { warehouseId: warehouse.id, isDefault: true, id: { not: found.id } },
      data: { isDefault: false },
    });
    return prisma.warehouseLocation.update({
      where: { id: found.id },
      data: {
        isDefault: true,
        qrCode: found.qrCode || (await allocateBinQrCode(prisma, warehouse.code, found.code)),
        name: found.name || 'Main floor',
      },
    });
  }

  const qrCode = await allocateBinQrCode(prisma, warehouse.code, code);
  return prisma.warehouseLocation.create({
    data: {
      warehouseId: warehouse.id,
      code,
      name: 'Main floor',
      isDefault: true,
      qrCode,
    },
  });
}

export async function ensureAllDefaultWarehouseBins(prisma: PrismaClient) {
  const warehouses = await prisma.warehouse.findMany({ select: { id: true, code: true } });
  const created: Array<{ warehouseId: string; binId: string; code: string }> = [];
  for (const warehouse of warehouses) {
    const bin = await ensureDefaultWarehouseBin(prisma, warehouse);
    created.push({ warehouseId: warehouse.id, binId: bin.id, code: warehouse.code });
  }
  return created;
}

export async function ensureAllWarehouseBinQrCodes(prisma: PrismaClient) {
  const locations = await prisma.warehouseLocation.findMany({
    include: { warehouse: { select: { code: true } } },
  });
  for (const loc of locations) {
    if (loc.qrCode) continue;
    const qrCode = await allocateBinQrCode(prisma, loc.warehouse.code, loc.code);
    await prisma.warehouseLocation.update({ where: { id: loc.id }, data: { qrCode } });
  }
}

export async function defaultBinIdForWarehouse(
  prisma: PrismaClient,
  warehouseId: string,
): Promise<string> {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, code: true },
  });
  if (!warehouse) throw new Error(`Warehouse ${warehouseId} not found`);
  const bin = await ensureDefaultWarehouseBin(prisma, warehouse);
  return bin.id;
}

/** Align `InventoryBalance.availableQty` with signed transaction sums per bin. */
export async function reconcileAvailableQtyFromTransactions(prisma: PrismaClient): Promise<number> {
  const txs = await prisma.inventoryTransaction.findMany({
    select: { inventoryItemId: true, warehouseId: true, locationId: true, quantity: true },
  });
  const sums = new Map<
    string,
    { inventoryItemId: string; warehouseId: string; locationId: string; qty: number }
  >();
  for (const tx of txs) {
    if (!tx.locationId || !tx.warehouseId) continue;
    const key = `${tx.inventoryItemId}|${tx.warehouseId}|${tx.locationId}`;
    const row = sums.get(key) ?? {
      inventoryItemId: tx.inventoryItemId,
      warehouseId: tx.warehouseId,
      locationId: tx.locationId,
      qty: 0,
    };
    row.qty += Number(tx.quantity);
    sums.set(key, row);
  }
  let patched = 0;
  for (const row of sums.values()) {
    const existing = await prisma.inventoryBalance.findFirst({
      where: {
        inventoryItemId: row.inventoryItemId,
        warehouseId: row.warehouseId,
        locationId: row.locationId,
      },
    });
    if (existing) {
      if (Math.abs(Number(existing.availableQty) - row.qty) > 0.02) {
        await prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: { availableQty: row.qty },
        });
        patched += 1;
      }
    } else if (Math.abs(row.qty) > 0.02) {
      await prisma.inventoryBalance.create({
        data: {
          inventoryItemId: row.inventoryItemId,
          warehouseId: row.warehouseId,
          locationId: row.locationId,
          availableQty: row.qty,
          reservedQty: 0,
        },
      });
      patched += 1;
    }
  }
  return patched;
}
