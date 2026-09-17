import { PrismaClient } from '@prisma/client';
import { demoAsOf } from './clock';

/** Optional audit breadcrumb only — no inbox notifications or AI jobs. */
export async function seedDemoExtras(
  prisma: PrismaClient,
  opts: {
    adminId: string;
  },
) {
  const asOf = demoAsOf();
  await prisma.auditEvent.create({
    data: {
      userId: opts.adminId,
      action: 'DEMO_RESET',
      entityType: 'SystemSetting',
      entityId: 'company',
      newValues: { seededWorld: 'demo-factory-v1', asOf: asOf.toISOString() },
      createdAt: asOf,
    },
  });
}
