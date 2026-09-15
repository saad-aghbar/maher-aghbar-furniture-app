import { PrismaClient } from '@prisma/client';
import { backfillSalesOrderItemLetters } from '../../src/backfill-sales-order-item-letters';

const prisma = new PrismaClient();

async function main() {
  const result = await backfillSalesOrderItemLetters(prisma);
  console.log(
    `sales-order item letters: linesUpdated=${result.linesUpdated} productionOrdersRenamed=${result.productionOrdersRenamed}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
