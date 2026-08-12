import type { PrismaClient } from '@prisma/client';

/** Fresh document counters so the first real docs start near 0001. */
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
      update: { current: 0 },
      create: { key, year, current: 0 },
    });
  }
}
