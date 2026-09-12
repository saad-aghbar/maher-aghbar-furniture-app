import { PrismaClient } from '@prisma/client';
import { ensurePlaceholderHourlyRates } from '../seed/labor-rates';

const prisma = new PrismaClient();

async function main() {
  const workers = await prisma.user.findMany({
    where: {
      archivedAt: null,
      roles: { some: { role: { kind: 'PRODUCTION_WORKER', code: 'PRODUCTION_WORKER' } } },
    },
    select: { id: true },
  });
  const result = await ensurePlaceholderHourlyRates(
    prisma,
    workers.map((w) => w.id),
  );
  console.log(`Worker hourly rates: created ${result.created}, skipped ${result.skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
