/**
 * Re-seed Piece 12 mapping log only (no mutations).
 * Prefer full demo:reset; this exists for smoke/docs parity with other pieces.
 */
import { PrismaClient } from '@prisma/client';
import { seedPiece12ManagementDashboardExamples } from './piece12-management-dashboard';

async function main() {
  const prisma = new PrismaClient();
  console.log('Re-seeding Piece 12 (mapping log only)…');
  await seedPiece12ManagementDashboardExamples(prisma);
  const samples = await prisma.salesOrder.findMany({
    where: {
      OR: [
        { number: { startsWith: 'SO-P8-' } },
        { number: { startsWith: 'SO-P9-' } },
        { number: { startsWith: 'SO-P10-' } },
        { number: { startsWith: 'SO-P11-' } },
        { number: { startsWith: 'SO-P7-' } },
      ],
    },
    select: { number: true, status: true },
    orderBy: { number: 'asc' },
    take: 40,
  });
  console.log(
    'Existing demo SOs (sample):',
    samples.map((s) => `${s.number}=${s.status}`).join(', ') || '(none — run demo:reset)',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
