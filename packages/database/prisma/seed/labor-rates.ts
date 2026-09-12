import type { PrismaClient } from '@prisma/client';

const DEFAULT_HOURLY_RATE = 25;

export async function ensurePlaceholderHourlyRates(
  prisma: PrismaClient,
  userIds: string[],
  hourlyRate = DEFAULT_HOURLY_RATE,
) {
  let created = 0;
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    const open = await prisma.laborRate.findFirst({
      where: { userId, effectiveTo: null, stageDefinitionId: null },
    });
    if (open) continue;
    await prisma.laborRate.create({
      data: {
        userId,
        hourlyRate,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    created += 1;
  }
  return { created, skipped: unique.length - created };
}
