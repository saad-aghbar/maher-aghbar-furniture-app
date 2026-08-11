/**
 * Backfill every catalog product with a random count of demo furniture photos.
 *
 * Run:
 *   pnpm --filter @maher/database seed:product-photos
 */
import { PrismaClient } from '@prisma/client';
import { assignRandomProductPhotos } from './seed/productPhotoPool';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, sku: true },
    orderBy: { sku: 'asc' },
  });

  if (products.length === 0) {
    console.log('No products found — nothing to update.');
    return;
  }

  let updated = 0;
  const histogram: Record<number, number> = {};

  for (const product of products) {
    const photos = assignRandomProductPhotos({ min: 1, max: 6 });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        imageUrl: photos.imageUrl,
        galleryUrls: photos.galleryUrls,
      },
    });
    histogram[photos.photoCount] = (histogram[photos.photoCount] ?? 0) + 1;
    updated += 1;
  }

  console.log(`Updated photos on ${updated} products.`);
  console.log(
    'Photo-count distribution:',
    Object.entries(histogram)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([n, c]) => `${n}→${c}`)
      .join(', '),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
