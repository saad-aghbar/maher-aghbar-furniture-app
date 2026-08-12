import type { BrowseProduct } from './api';
import { resolveDealerBrowsePrice } from './selectProductCard';

export type ProductDetailDimension = {
  label: string;
  value: string;
  /** Short key for icon mapping (w/h/d/seat/custom). */
  kind: 'w' | 'h' | 'd' | 'seat' | 'custom';
};

export type ProductDetailViewModel = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  description: string | null;
  price: number | null;
  currency: string;
  isAvailable: boolean;
  categoryId: string | null;
  categoryName: string | null;
  imageUris: string[];
  /** Primary W/H/D/seat + custom measurement rows. */
  dimensions: ProductDetailDimension[];
  /** Compact "220 × 85 × 90 cm" when core dims exist. */
  dimensionSummary: string | null;
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
      ? { w: 'العرض', h: 'الارتفاع', d: 'العمق', seat: 'ارتفاع المقعد', empty: '—' }
      : locale === 'he'
        ? { w: 'רוחב', h: 'גובה', d: 'עומק', seat: 'גובה מושב', empty: '—' }
        : { w: 'Width', h: 'Height', d: 'Depth', seat: 'Seat height', empty: '—' };

  const wN = toNumber(product.width);
  const hN = toNumber(product.height);
  const dN = toNumber(product.depth);
  const seatN = toNumber(product.seatHeight);

  // Always surface the four standard dealer measurement slots.
  const dimensions: ProductDetailDimension[] = [
    { label: dimLabels.w, value: formatCm(product.width) ?? dimLabels.empty, kind: 'w' },
    { label: dimLabels.h, value: formatCm(product.height) ?? dimLabels.empty, kind: 'h' },
    { label: dimLabels.d, value: formatCm(product.depth) ?? dimLabels.empty, kind: 'd' },
    {
      label: dimLabels.seat,
      value: formatCm(product.seatHeight) ?? dimLabels.empty,
      kind: 'seat',
    },
  ];

  const coreParts = [wN, hN, dN].filter((n): n is number => n != null);
  const dimensionSummary =
    coreParts.length >= 2
      ? `${coreParts.join(' × ')} cm`
      : seatN != null
        ? `Seat ${seatN} cm`
        : null;

  const notes: string[] = [];
  for (const m of product.customMeasurements ?? []) {
    const label =
      locale === 'ar'
        ? m.nameAr || m.nameEn
        : locale === 'he'
          ? m.nameHe || m.nameEn
          : m.nameEn || m.nameAr;
    if (!label) continue;
    if (m.value != null && Number.isFinite(Number(m.value))) {
      dimensions.push({
        label,
        value: formatCm(m.value) ?? String(m.value),
        kind: 'custom',
      });
    } else if (m.value != null) {
      dimensions.push({ label, value: String(m.value), kind: 'custom' });
    } else {
      notes.push(label);
    }
  }

  const sku = product.sku?.trim() || null;
  const unit = product.unit?.trim() || null;

  return {
    id: product.id,
    name: name || product.nameEn || product.nameAr || '—',
    sku,
    unit,
    description: product.description?.trim() || null,
    price: resolveDealerBrowsePrice(product),
    currency: product.priceCurrency || 'ILS',
    isAvailable: product.isActive !== false,
    categoryId: product.categoryId ?? product.category?.id ?? null,
    categoryName: localizedCategoryName(product, locale),
    imageUris: uris,
    dimensions,
    dimensionSummary,
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
