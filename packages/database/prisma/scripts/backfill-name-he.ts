import { PrismaClient } from '@prisma/client';
import { backfillNameHe } from '../seed/backfill-name-he';

const prisma = new PrismaClient();

async function main() {
  await backfillNameHe(prisma);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
