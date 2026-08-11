import type { BrowseProduct } from './api';

export type ProductCardModel = {
  id: string;
  name: string;
  imageUrl: string | null;
  imageUrls: string[];
  price: number | null;
  currency: string;
  isAvailable: boolean;
  categoryName: string | null;
  dimensionHint: string | null;
  galleryCount: number;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function dimensionHint(product: BrowseProduct): string | null {
  const parts = [product.width, product.height, product.depth]
    .map(toNumber)
    .filter((n): n is number => n != null);
  if (!parts.length) return null;
  return parts.join('×');
}

function collectImageUrls(product: BrowseProduct): string[] {
  const uris: string[] = [];
  const add = (u?: string | null) => {
    const v = u?.trim();
    if (v && !uris.includes(v)) uris.push(v);
  };
  add(product.imageUrl);
  for (const g of product.galleryUrls ?? []) add(g);
  return uris;
}

/** Dealer list/detail price — prefer scoped dealerPrice; never manufacturing cost. */
export function resolveDealerBrowsePrice(item: BrowseProduct): number | null {
  return toNumber(item.dealerPrice ?? item.price);
}

export function toProductCard(
  item: BrowseProduct,
  locale: string,
): ProductCardModel {
  const name =
    locale === 'ar'
      ? item.nameAr || item.nameEn
      : locale === 'he'
        ? item.nameHe || item.nameEn
        : item.nameEn || item.nameAr;

  const imageUrls = collectImageUrls(item);
  const thumb = item.thumbnailUrl?.trim() || null;

  return {
    id: item.id,
    name: name || item.nameEn || item.nameAr || '—',
    /** Prefer thumbnail when API ships one; otherwise first full image. */
    imageUrl: thumb ?? imageUrls[0] ?? null,
    imageUrls: thumb ? [thumb, ...imageUrls.filter((u) => u !== thumb)] : imageUrls,
    price: resolveDealerBrowsePrice(item),
    currency: item.priceCurrency || 'JOD',
    isAvailable: item.isActive !== false,
    categoryName: localizedCategoryName(item, locale),
    dimensionHint: dimensionHint(item),
    galleryCount: imageUrls.length,
  };
}

/** Runtime guard — dealer cards must never carry factory cost / list basePrice. */
export function assertProductCardSafe(model: ProductCardModel): void {
  const keys = Object.keys(model);
  if (
    keys.includes('manufacturingCost') ||
    keys.includes('basePrice') ||
    keys.includes('bomDefaults')
  ) {
    throw new Error('Product card must not include cost/basePrice fields');
  }
}
