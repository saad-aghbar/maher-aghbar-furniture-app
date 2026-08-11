import type { PaginatedResponse } from '@maher/types';
import { apiGet } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type BrowseCategory = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
};

/** Dealer-facing browse product — costs / basePrice intentionally omitted from the type. */
export type BrowseProduct = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  /** Optional smaller URI for grid cards when the API provides one. */
  thumbnailUrl?: string | null;
  galleryUrls?: string[];
  isActive: boolean;
  unit?: string;
  price: number | string | null;
  dealerPrice: number | string | null;
  priceCurrency: string;
  categoryId?: string | null;
  category?: BrowseCategory | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
  customMeasurements?:
    | {
        id?: string;
        nameEn: string;
        nameAr: string;
        nameHe?: string | null;
        value?: number | null;
      }[]
    | null;
};

export type BrowseProductsFilters = PageParams & {
  q?: string;
  categoryId?: string;
  sortBy?: 'name' | 'price';
  sortDir?: 'asc' | 'desc';
};

export async function listBrowseCategories(): Promise<BrowseCategory[]> {
  return apiGet<BrowseCategory[]>('/catalog/browse/categories');
}

export async function listBrowseProducts(
  filters: BrowseProductsFilters = {},
): Promise<PaginatedResponse<BrowseProduct>> {
  const qs = toSearchParams({
    page: filters.page,
    pageSize: filters.pageSize,
    q: filters.q,
    categoryId: filters.categoryId,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  });
  return apiGet<PaginatedResponse<BrowseProduct>>(`/catalog/browse/products${qs}`);
}

export async function getBrowseProduct(id: string): Promise<BrowseProduct> {
  return apiGet<BrowseProduct>(`/catalog/browse/products/${encodeURIComponent(id)}`);
}

/** Products this dealer has ordered before (newest first). */
export async function listPreviouslyOrderedProducts(): Promise<{ data: BrowseProduct[] }> {
  return apiGet<{ data: BrowseProduct[] }>('/catalog/browse/previously-ordered');
}
