import type { PrismaClient } from '@prisma/client';

/** Align sequence counters with highest issued document numbers. */
export async function seedSequences(prisma: PrismaClient) {
  const year = new Date().getFullYear();
  const keys = [
    'sales_order',
    'production_order',
    'invoice',
    'payment',
    'rfq',
    'quotation',
    'delivery',
    'purchase_request',
    'purchase_order',
    'task',
    'contract',
    'return_request',
  ];

  for (const key of keys) {
    await prisma.sequenceCounter.upsert({
      where: { key_year: { key, year } },
      update: { current: 20000 },
      create: { key, year, current: 20000 },
    });
  }
}
