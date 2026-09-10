/**
 * Assert the default-bin invariant after backfill / seed.
 *
 * Usage:
 *   pnpm --filter @maher/database exec tsx prisma/scripts/verify-bin-invariant.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(__dirname, '../../../../.env') });

const prisma = new PrismaClient();

async function main() {
  const failures: string[] = [];

  const warehouses = await prisma.warehouse.findMany({
    select: { id: true, code: true, locations: { select: { id: true, isDefault: true, qrCode: true } } },
  });
  for (const wh of warehouses) {
    const defaults = wh.locations.filter((l) => l.isDefault);
    if (defaults.length !== 1) {
      failures.push(
        `warehouse ${wh.code} has ${defaults.length} default bins (expected 1)`,
      );
    }
  }

  const missingQr = await prisma.warehouseLocation.count({ where: { qrCode: null } });
  if (missingQr > 0) failures.push(`${missingQr} bins missing qrCode`);

  const qrDupes = await prisma.$queryRaw<Array<{ qrCode: string; n: bigint }>>`
    SELECT "qrCode", COUNT(*)::bigint AS n
    FROM warehouse_locations
    WHERE "qrCode" IS NOT NULL
    GROUP BY "qrCode"
    HAVING COUNT(*) > 1
  `;
  if (qrDupes.length) {
    failures.push(`${qrDupes.length} duplicate bin qrCodes`);
  }

  const nullBalances = await prisma.inventoryBalance.count({ where: { locationId: null } });
  const nullLots = await prisma.inventoryLot.count({ where: { locationId: null } });
  const nullTxs = await prisma.inventoryTransaction.count({ where: { locationId: null } });
  const nullKits = await prisma.wipKit.count({ where: { locationId: null } });
  if (nullBalances) failures.push(`${nullBalances} balances still have locationId null`);
  if (nullLots) failures.push(`${nullLots} lots still have locationId null`);
  if (nullTxs) failures.push(`${nullTxs} transactions still have locationId null`);
  if (nullKits) failures.push(`${nullKits} WIP kits still have locationId null`);

  const orphaned = await prisma.warehouseLocation.count({
    where: { warehouse: { is: undefined as never } },
  });
  void orphaned;

  const summary = {
    warehouses: warehouses.length,
    locations: await prisma.warehouseLocation.count(),
    nullBalances,
    nullLots,
    nullTxs,
    nullKits,
    failures,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
