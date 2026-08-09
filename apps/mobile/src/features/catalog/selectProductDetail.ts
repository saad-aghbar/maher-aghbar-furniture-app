import type { BrowseProduct } from './api';

export type ProductDetailViewModel = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  isAvailable: boolean;
  categoryName: string | null;
  imageUris: string[];
  dimensions: { label: string; value: string }[];
  notes: string[];
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCm(value: number | string | null | undefined): string | null {
  const n = toNumber(value);
  if (n == null) return null;
  return `${n} cm`;
}

function localizedCategoryName(
  product: BrowseProduct,
  locale: string,
): string | null {
  const cat = product.category;
  if (!cat) return null;
  if (locale === 'ar') return cat.nameAr || cat.nameEn || null;
  if (locale === 'he') return cat.nameHe || cat.nameEn || cat.nameAr || null;
  return cat.nameEn || cat.nameAr || null;
}

export function selectProductDetail(
  product: BrowseProduct,
  locale: string,
): ProductDetailViewModel {
  const name =
    locale === 'ar'
      ? product.nameAr || product.nameEn
      : locale === 'he'
        ? product.nameHe || product.nameEn
        : product.nameEn || product.nameAr;

  const uris: string[] = [];
  if (product.imageUrl) uris.push(product.imageUrl);
  for (const g of product.galleryUrls ?? []) {
    if (g && !uris.includes(g)) uris.push(g);
  }

  const dimLabels =
    locale === 'ar'
      ? { w: 'العرض', h: 'الارتفاع', d: 'العمق', seat: 'ارتفاع المقعد' }
      : locale === 'he'
        ? { w: 'רוחב', h: 'גובה', d: 'עומק', seat: 'גובה מושב' }
        : { w: 'W', h: 'H', d: 'D', seat: 'Seat' };

  const dimensions: { label: string; value: string }[] = [];
  const w = formatCm(product.width);
  const h = formatCm(product.height);
  const d = formatCm(product.depth);
  const seat = formatCm(product.seatHeight);
  if (w) dimensions.push({ label: dimLabels.w, value: w });
  if (h) dimensions.push({ label: dimLabels.h, value: h });
  if (d) dimensions.push({ label: dimLabels.d, value: d });
  if (seat) dimensions.push({ label: dimLabels.seat, value: seat });

  const notes: string[] = [];
  for (const m of product.customMeasurements ?? []) {
    const label =
      locale === 'ar'
        ? m.nameAr || m.nameEn
        : locale === 'he'
          ? m.nameHe || m.nameEn
          : m.nameEn || m.nameAr;
    if (m.value != null) notes.push(`${label}: ${m.value}`);
    else if (label) notes.push(label);
  }

  return {
    id: product.id,
    name: name || product.nameEn || product.nameAr || '—',
    description: product.description?.trim() || null,
    price: toNumber(product.price),
    currency: product.priceCurrency || 'JOD',
    isAvailable: product.isActive !== false,
    categoryName: localizedCategoryName(product, locale),
    imageUris: uris,
    dimensions,
    notes,
  };
}

export function assertProductDetailSafe(vm: ProductDetailViewModel): void {
  const json = JSON.stringify(vm);
  if (
    json.includes('manufacturingCost') ||
    json.includes('basePrice') ||
    json.includes('bomDefaults') ||
    json.includes('adminNotes')
  ) {
    throw new Error('Product detail leaked cost/internal fields');
  }
}
