/**
 * Backfill standard W/H/D (+ seat) and dealer-facing descriptions on all products.
 *
 * Run:
 *   pnpm --filter @maher/database seed:product-measurements
 */
import { PrismaClient } from '@prisma/client';
import {
  measurementsToPrisma,
  standardMeasurementsForProduct,
} from './seed/productMeasurements';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      nameEn: true,
      description: true,
      category: { select: { code: true } },
    },
    orderBy: { sku: 'asc' },
  });

  if (!products.length) {
    console.log('No products found — nothing to update.');
    return;
  }

  let updated = 0;

  for (const product of products) {
    const code = product.category?.code ?? 'CUSTOM';
    const m = standardMeasurementsForProduct({
      categoryCode: code,
      sku: product.sku,
      nameEn: product.nameEn,
    });
    const data = measurementsToPrisma(m);
    await prisma.product.update({
      where: { id: product.id },
      data: {
        width: data.width,
        height: data.height,
        depth: data.depth,
        seatHeight: data.seatHeight,
        unit: data.unit,
        ...(!product.description?.trim() ? { description: data.description } : {}),
      },
    });
    updated += 1;
  }

  console.log(`Updated measurements on ${updated} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
