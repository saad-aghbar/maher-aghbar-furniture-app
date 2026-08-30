import type { PrismaClient } from '@prisma/client';

/** DB-level invariant: one ACCEPTED quotation per RFQ. Prisma cannot express this WHERE clause. */
export async function ensureQuotationAcceptedUniqueIndex(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS quotations_one_accepted_per_request
    ON quotations ("requestId")
    WHERE status = 'ACCEPTED' AND "requestId" IS NOT NULL AND "archivedAt" IS NULL
  `);
}
