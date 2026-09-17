import { hashSync } from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { seedFoundation } from '../seed/foundation';
import { demoAsOf } from './clock';
import { seedDemoCalendar } from './calendar';
import { seedDemoPeople } from './people';
import { seedDemoWorkflows } from './workflows';
import { seedDemoCatalog } from './catalog';
import { emptySeq, seedDemoSequences } from './seq';
import { seedDemoStock } from './stock';
import { seedDemoOrders } from './orders';
import { seedDemoFabricProcurement } from './fabric-procurement';
import { seedCostPerformanceWorld } from './cost-performance-uat';
import { seedDemoReturns } from './returns';
import { seedDemoExtras } from './extras';
import { wipeOperationalData } from './wipe';
import { ensureQuotationAcceptedUniqueIndex } from './quotation-accepted-index';
import {
  reconcileAvailableQtyFromTransactions,
  ensureAllDefaultWarehouseBins,
  ensureAllWarehouseBinQrCodes,
} from '../seed/warehouse-bins';
import { backfillNameHe } from '../seed/backfill-name-he';
import { backfillSalesOrderItemLetters } from '../../src/backfill-sales-order-item-letters';
import { printDemoCheatSheet } from './cheat-sheet';

export async function seedDemoFactory(prisma: PrismaClient): Promise<void> {
  const passwordHash = hashSync('123', 12);
  const asOf = demoAsOf();

  await prisma.systemSetting.upsert({
    where: { key: 'company' },
    update: {
      value: {
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
        city: 'Amman',
        country: 'JO',
        currency: 'ILS',
        phone: '+96265550000',
        seededWorld: 'demo-factory-v1',
        demoAsOf: asOf.toISOString(),
      },
    },
    create: {
      key: 'company',
      value: {
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
        city: 'Amman',
        country: 'JO',
        currency: 'ILS',
        phone: '+96265550000',
        seededWorld: 'demo-factory-v1',
        demoAsOf: asOf.toISOString(),
      },
    },
  });

  console.log('Seeding factory calendar…');
  await seedDemoCalendar(prisma);

  console.log('Seeding people, dealers, skills…');
  const people = await seedDemoPeople(prisma, passwordHash);

  console.log('Seeding demo workflows…');
  await seedDemoWorkflows(prisma);

  console.log('Seeding catalog + BOMs…');
  const catalog = await seedDemoCatalog(prisma, people.dealers);

  const counters = emptySeq();
  console.log('Seeding stock + purchasing…');
  const stock = await seedDemoStock(prisma, {
    adminId: people.adminId,
    purchasingId: people.purchasingId,
    materials: catalog.materials,
    counters,
  });

  console.log('Seeding sales / production / schedules…');
  await seedDemoOrders(prisma, {
    adminId: people.adminId,
    salesId: people.salesId,
    inspectorId: people.inspectorId,
    driverId: people.driverId,
    warehouseUserId: people.warehouseId,
    dealers: people.dealers,
    products: catalog.products,
    variants: catalog.variants,
    counters,
    rawWhId: stock.rawWhId,
  });

  console.log('Seeding fabric procurement (SO-FB1042)…');
  await seedDemoFabricProcurement(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Cost & Performance ledger examples…');
  await seedCostPerformanceWorld(prisma, {
    adminId: people.adminId,
    warehouseUserId: people.warehouseId,
    inspectorId: people.inspectorId,
    driverId: people.driverId,
    dealers: people.dealers,
    workers: people.workers,
    products: catalog.products,
    counters,
    passwordHash,
  });

  console.log('Seeding RT-DEMO-001 return case…');
  await seedDemoReturns(prisma, {
    adminId: people.adminId,
    driverId: people.driverId,
    dealers: people.dealers,
    products: catalog.products,
  });

  console.log('Seeding extras (audit only)…');
  await seedDemoExtras(prisma, {
    adminId: people.adminId,
  });

  await ensureAllDefaultWarehouseBins(prisma);
  await ensureAllWarehouseBinQrCodes(prisma);
  const patchedBins = await reconcileAvailableQtyFromTransactions(prisma);
  if (patchedBins > 0) {
    console.log(`  reconciled ${patchedBins} bin balances from ledger txs`);
  }

  await backfillNameHe(prisma);
  await backfillSalesOrderItemLetters(prisma);

  await seedDemoSequences(prisma, counters);
  console.log(`Demo factory as of ${asOf.toISOString()} ready.`);
  await printDemoCheatSheet(prisma);
}

/** Foundation → wipe leftover ops/config → curated factory. */
export async function runDemoReset(prisma: PrismaClient): Promise<void> {
  console.log('Demo reset: seeding foundation…');
  await seedFoundation(prisma);
  console.log('Demo reset: wiping operational data…');
  await wipeOperationalData(prisma);
  console.log('Demo reset: re-seeding foundation after wipe…');
  await seedFoundation(prisma);
  await ensureQuotationAcceptedUniqueIndex(prisma);
  await seedDemoFactory(prisma);
}
