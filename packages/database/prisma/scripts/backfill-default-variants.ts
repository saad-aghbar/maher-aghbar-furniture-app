import { PrismaClient } from '@prisma/client';
import { backfillDefaultVariants } from '../seed/backfill-default-variants';

const prisma = new PrismaClient();

async function main() {
  const result = await backfillDefaultVariants(prisma);
  console.log(`Default variants: created ${result.created}, skipped ${result.skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
