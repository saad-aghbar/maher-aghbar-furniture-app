/**
 * Coherent 8-month operational demo data for Maher Al-Aghbar & Sons (Amman).
 * Foundation (roles, permissions, warehouses, departments, stage defs,
 * QC FINAL_QC, notification templates, base settings) is seeded by seed.ts first.
 */
import type { PrismaClient } from '@prisma/client';
import { wipeOperationalData } from './seed/wipe';
import { seedPeople } from './seed/people';
import { seedCatalog } from './seed/catalog';
import { seedInventory } from './seed/inventory';
import { seedPurchasing } from './seed/purchasing';
import { seedSalesTimeline } from './seed/sales-timeline';
import { seedPlatformExtras } from './seed/platform-extras';
import { seedSequences } from './seed/sequences';

export { wipeOperationalData };

export async function seedDemoWorld(prisma: PrismaClient, passwordHash: string): Promise<void> {
  console.log('Seeding 8-month operational world…');

  // Company extras on settings
  const companyExisting = await prisma.systemSetting.findUnique({ where: { key: 'company' } });
  const companyBase =
    companyExisting?.value && typeof companyExisting.value === 'object'
      ? (companyExisting.value as Record<string, unknown>)
      : {};
  await prisma.systemSetting.upsert({
    where: { key: 'company' },
    update: {
      value: {
        ...companyBase,
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
        city: 'Amman',
        country: 'JO',
        phone: '+96265550000',
        seededWorld: '8-month-v1',
      },
    },
    create: {
      key: 'company',
      value: {
        nameEn: 'Maher Al-Aghbar & Sons Furniture',
        nameAr: 'مفروشات ماهر الأغبر وأولاده',
          city: 'Amman',
        country: 'JO',
        phone: '+96265550000',
        seededWorld: '8-month-v1',
      },
    },
  });

  const { admin, dealers, workers, stageAssignees } = await seedPeople(prisma, passwordHash);
  console.log(`  people: admin + ${dealers.length} dealers + ${workers.length} workers`);

  const { products } = await seedCatalog(prisma, dealers);
  console.log(`  catalog: ${products.length} products`);

  const inventory = await seedInventory(prisma, admin.id);
  console.log(`  inventory: ${inventory.items.length} items`);

  await seedPurchasing(prisma, {
    adminId: admin.id,
    items: inventory.items,
    rawWhId: inventory.rawWh.id,
  });
  console.log('  purchasing: suppliers + multi-month PO/GRN/AP + open PR');

  const timeline = await seedSalesTimeline(prisma, {
    adminId: admin.id,
    dealers,
    products,
    stageAssignees,
    inspectorId: workers.find((w) => w.username === 'inspector')?.id,
    driverId: workers.find((w) => w.username === 'driver')?.id,
  });
  console.log(
    `  sales timeline: ${timeline.orderCount} orders, ${timeline.productionCount} POs, ${timeline.deliveredCount} delivered`,
  );

  await seedPlatformExtras(prisma, {
    adminId: admin.id,
    workerIds: workers.map((w) => w.id),
    dealers,
  });
  console.log('  platform: notifications, audit, AI jobs, docs, comms');

  await seedSequences(prisma);

  const counts = {
    customers: await prisma.customer.count(),
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    salesOrders: await prisma.salesOrder.count(),
    productionOrders: await prisma.productionOrder.count(),
    productionTasks: await prisma.productionTask.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    deliveries: await prisma.delivery.count(),
    rfqs: await prisma.requestForQuotation.count(),
    quotations: await prisma.quotation.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    returns: await prisma.returnRequest.count(),
    notifications: await prisma.notification.count(),
  };
  console.log('  counts:', counts);
  console.log('8-month operational world ready.');
  console.log('  Demo logins (password 123): admin, nile, oasis, carpenter, cutter, inspector, …');
}
