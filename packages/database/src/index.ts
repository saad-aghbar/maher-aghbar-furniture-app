import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export { PrismaClient };
export {
  formatSalesOrderItemNumber,
  itemLetterAtIndex,
  nextItemLetter,
  withLineItemLetters,
} from './sales-order-item-number';
export { backfillSalesOrderItemLetters } from './backfill-sales-order-item-letters';
