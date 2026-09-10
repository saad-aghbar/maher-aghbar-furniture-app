/**
 * Ensure every warehouse has a default {CODE}-MAIN bin, every bin has a QR,
 * and every unlocated balance / lot / transaction / WIP kit is moved onto that bin.
 *
 * Usage:
 *   DRY_RUN=1 pnpm --filter @maher/database exec tsx prisma/scripts/backfill-default-warehouse-bins.ts
 *   pnpm --filter @maher/database exec tsx prisma/scripts/backfill-default-warehouse-bins.ts
 *
 * Safe to re-run. Does not wipe data.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import {
  allocateBinQrCode,
  ensureAllDefaultWarehouseBins,
  ensureDefaultWarehouseBin,
} from '../seed/warehouse-bins';

config({ path: resolve(__dirname, '../../../../.env') });

const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const prisma = new PrismaClient();

function money(n: number) {
  return Number(n).toFixed(3);
}

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true },
  });
  const defaults = dryRun
    ? await Promise.all(
        warehouses.map(async (wh) => {
          const existing =
            (await prisma.warehouseLocation.findFirst({
              where: { warehouseId: wh.id, isDefault: true },
            })) ??
            (await prisma.warehouseLocation.findUnique({
              where: {
                warehouseId_code: { warehouseId: wh.id, code: `${wh.code}-MAIN` },
              },
            }));
          return { warehouseId: wh.id, code: wh.code, binId: existing?.id ?? null };
        }),
      )
    : await ensureAllDefaultWarehouseBins(prisma);

  const defaultByWarehouse = new Map(defaults.map((d) => [d.warehouseId, d.binId]));

  let qrAllocated = 0;
  const locations = await prisma.warehouseLocation.findMany({
    include: { warehouse: { select: { code: true } } },
  });
  if (!dryRun) {
    for (const loc of locations) {
      if (loc.qrCode) continue;
      const qrCode = await allocateBinQrCode(prisma, loc.warehouse.code, loc.code);
      await prisma.warehouseLocation.update({ where: { id: loc.id }, data: { qrCode } });
      qrAllocated += 1;
    }
  } else {
    qrAllocated = locations.filter((l) => !l.qrCode).length;
  }

  let balancesMoved = 0;
  let balancesMerged = 0;
  const nullBalances = await prisma.inventoryBalance.findMany({
    where: { locationId: null },
  });
  for (const row of nullBalances) {
    const binId = defaultByWarehouse.get(row.warehouseId);
    if (!binId) continue;
    if (dryRun) {
      balancesMoved += 1;
      continue;
    }
    const clash = await prisma.inventoryBalance.findFirst({
      where: {
        inventoryItemId: row.inventoryItemId,
        warehouseId: row.warehouseId,
        locationId: binId,
      },
    });
    if (clash) {
      await prisma.inventoryBalance.update({
        where: { id: clash.id },
        data: {
          availableQty: money(Number(clash.availableQty) + Number(row.availableQty)),
          reservedQty: money(Number(clash.reservedQty) + Number(row.reservedQty)),
          damagedQty: money(Number(clash.damagedQty) + Number(row.damagedQty)),
          onOrderQty: money(Number(clash.onOrderQty) + Number(row.onOrderQty)),
        },
      });
      await prisma.inventoryBalance.delete({ where: { id: row.id } });
      balancesMerged += 1;
    } else {
      await prisma.inventoryBalance.update({
        where: { id: row.id },
        data: { locationId: binId },
      });
      balancesMoved += 1;
    }
  }

  async function repointNull(
    model: 'inventoryLot' | 'inventoryTransaction' | 'wipKit',
    warehouseField: 'warehouseId',
  ) {
    const rows = await (prisma[model] as never as {
      findMany: (args: unknown) => Promise<Array<{ id: string; warehouseId: string }>>;
      update: (args: unknown) => Promise<unknown>;
    }).findMany({ where: { locationId: null }, select: { id: true, warehouseId: true } });
    let n = 0;
    for (const row of rows) {
      const binId = defaultByWarehouse.get(row.warehouseId);
      if (!binId) continue;
      n += 1;
      if (dryRun) continue;
      await (prisma[model] as never as { update: (args: unknown) => Promise<unknown> }).update({
        where: { id: row.id },
        data: { locationId: binId },
      });
    }
    void warehouseField;
    return n;
  }

  const lotsMoved = await repointNull('inventoryLot', 'warehouseId');
  const txsMoved = await repointNull('inventoryTransaction', 'warehouseId');
  const kitsMoved = await repointNull('wipKit', 'warehouseId');

  if (!dryRun) {
    for (const wh of warehouses) {
      await ensureDefaultWarehouseBin(prisma, wh);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        warehouses: warehouses.length,
        defaultBins: defaults.filter((d) => d.binId).length,
        qrAllocated,
        balancesMoved,
        balancesMerged,
        lotsMoved,
        transactionsMoved: txsMoved,
        kitsMoved,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
