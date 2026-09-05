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
import { seedPiece1LifecycleExamples } from './piece1-lifecycle';
import { seedPiece2ProductionSetupExamples } from './piece2-production-setup';
import { seedPiece3ProductionPlanExamples } from './piece3-production-plan';
import { seedPiece4ManufacturingSpecExamples } from './piece4-manufacturing-spec';
import { seedPiece5ManufacturingCostExamples } from './piece5-manufacturing-cost';
import { seedPiece6PurchasingReceivingExamples } from './piece6-purchasing-receiving';
import { seedDemoFabricProcurement } from './fabric-procurement';
import { seedPiece7DealerFinanceExamples } from './piece7-dealer-finance';
import { seedPiece8FactoryFloorExamples } from './piece8-factory-floor';
import { seedPiece9QualityPackagingExamples } from './piece9-quality-packaging';
import { seedPiece10FinishedOutboundExamples } from './piece10-finished-outbound';
import { seedPiece11ExceptionsReturnsExamples } from './piece11-exceptions-returns';
import { seedPiece12ManagementDashboardExamples } from './piece12-management-dashboard';
import { seedPiece14FullSystemExamples } from './piece14-full-system';
import { seedDemoExtras } from './extras';
import { wipeOperationalData } from './wipe';
import { ensureQuotationAcceptedUniqueIndex } from './quotation-accepted-index';

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
    counters,
    rawWhId: stock.rawWhId,
  });

  console.log('Seeding Piece 1 order lifecycle examples…');
  await seedPiece1LifecycleExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 2 production setup examples…');
  await seedPiece2ProductionSetupExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 3 production plan examples…');
  await seedPiece3ProductionPlanExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
  });

  console.log('Seeding Piece 4 manufacturing spec examples…');
  await seedPiece4ManufacturingSpecExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 5 manufacturing cost examples…');
  await seedPiece5ManufacturingCostExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 6 purchasing / receiving examples…');
  await seedPiece6PurchasingReceivingExamples(prisma, {
    adminUserId: people.adminId,
  });

  console.log('Seeding fabric procurement examples…');
  await seedDemoFabricProcurement(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 7 dealer commercial finance examples…');
  await seedPiece7DealerFinanceExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
  });

  console.log('Seeding Piece 8 factory floor SEMI handoff examples…');
  await seedPiece8FactoryFloorExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
  });

  console.log('Seeding Piece 9 quality / rework / packaging examples…');
  await seedPiece9QualityPackagingExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
  });

  console.log('Seeding Piece 10 finished outbound / dealer receipt examples…');
  await seedPiece10FinishedOutboundExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
    driverId: people.driverId,
  });

  console.log('Seeding Piece 11 exceptions / returns / cancel examples…');
  await seedPiece11ExceptionsReturnsExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
    driverId: people.driverId,
  });

  console.log('Seeding Piece 12 management dashboard mapping log…');
  await seedPiece12ManagementDashboardExamples(prisma);

  console.log('Seeding Piece 14 full-system walkthrough examples…');
  await seedPiece14FullSystemExamples(prisma, {
    dealers: people.dealers,
    products: catalog.products,
    adminUserId: people.adminId,
    workerIds: people.workers.map((w) => w.id),
    workers: people.workers,
  });

  console.log('Seeding extras…');
  await seedDemoExtras(prisma, {
    adminId: people.adminId,
    salesId: people.salesId,
    dealers: people.dealers,
    workerIds: people.workers.map((w) => w.id),
    counters,
  });

  await seedDemoSequences(prisma, counters);
  console.log(`Demo factory as of ${asOf.toISOString()} ready.`);
  console.log('  Logins (password 123): admin | nile | oasis | balqis | prodmgr | scheduler | cutter | carpenter | …');
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
