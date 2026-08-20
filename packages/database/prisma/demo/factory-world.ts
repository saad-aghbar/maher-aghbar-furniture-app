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
import { seedDemoExtras } from './extras';
import { wipeOperationalData } from './wipe';

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
  await seedDemoFactory(prisma);
}
