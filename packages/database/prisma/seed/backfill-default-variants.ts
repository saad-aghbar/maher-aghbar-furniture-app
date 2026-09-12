import type { PrismaClient } from '@prisma/client';

function measurementsFromProduct(product: {
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  seatHeight?: unknown;
  customMeasurements?: unknown;
}) {
  const rows: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    labelHe: string;
    value: number | string | null;
    unit: string;
  }> = [];
  const dim = (key: string, labelAr: string, labelEn: string, labelHe: string, value: unknown) => {
    if (value == null || value === '') return;
    const n = typeof value === 'number' ? value : Number(value);
    rows.push({
      key,
      labelAr,
      labelEn,
      labelHe,
      value: Number.isFinite(n) ? n : String(value),
      unit: 'cm',
    });
  };
  dim('width', 'العرض', 'Width', 'רוחב', product.width);
  dim('height', 'الارتفاع', 'Height', 'גובה', product.height);
  dim('depth', 'العمق', 'Depth', 'עומק', product.depth);
  dim('seatHeight', 'ارتفاع المقعد', 'Seat height', 'גובה ישיבה', product.seatHeight);
  const custom = Array.isArray(product.customMeasurements) ? product.customMeasurements : [];
  for (const row of custom as Array<Record<string, unknown>>) {
    rows.push({
      key: String(row.key ?? row.id ?? row.nameEn ?? 'custom'),
      labelAr: String(row.nameAr ?? ''),
      labelEn: String(row.nameEn ?? ''),
      labelHe: String(row.nameHe ?? ''),
      value: (row.value as number | string | null) ?? null,
      unit: String(row.unit ?? 'cm'),
    });
  }
  return rows;
}

export function shouldCreateDefaultVariant(
  existing: Array<{ isDefault: boolean; sku: string }>,
  productSku: string,
): boolean {
  if (existing.some((v) => v.isDefault)) return false;
  if (existing.some((v) => v.sku === `${productSku}-STD`)) return false;
  return true;
}

/**
 * Idempotent: every product gets one `isDefault` variant at `${sku}-STD`.
 */
export async function backfillDefaultVariants(
  prisma: PrismaClient,
): Promise<{ created: number; skipped: number }> {
  const products = await prisma.product.findMany({
    include: { variants: { select: { id: true, isDefault: true, sku: true } } },
  });
  let created = 0;
  let skipped = 0;
  for (const product of products) {
    if (!shouldCreateDefaultVariant(product.variants, product.sku)) {
      skipped += 1;
      continue;
    }
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `${product.sku}-STD`,
        code: 'STD',
        nameAr: product.nameAr,
        nameEn: product.nameEn,
        nameHe: product.nameHe,
        isDefault: true,
        isActive: product.isActive,
        sortOrder: 0,
        basePrice: product.basePrice,
        manufacturingCost: product.manufacturingCost,
        bomDefaults: product.bomDefaults ?? undefined,
        imageUrl: product.imageUrl,
        galleryUrls: product.galleryUrls,
        width: product.width,
        height: product.height,
        depth: product.depth,
        seatHeight: product.seatHeight,
        measurements: measurementsFromProduct(product),
        adminNotes: product.adminNotes,
      },
    });
    created += 1;
  }
  return { created, skipped };
}
