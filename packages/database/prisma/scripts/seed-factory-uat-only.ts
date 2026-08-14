/**
 * Seeds isolated factory UAT products without wiping operational data.
 * Usage: pnpm --filter @maher/database seed:factory-uat-only
 */
import { PrismaClient } from '@prisma/client';
import { seedFactoryUat } from '../seed/factory-uat';

const prisma = new PrismaClient();

async function main() {
  await seedFactoryUat(prisma);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
