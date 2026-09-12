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

export type SpecOptionGroup = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  inputType: 'SELECT' | 'SELECT_WITH_QTY' | 'DIMENSION' | 'COLOR';
  appliesTo?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type SpecOptionValue = {
  id: string;
  groupId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  hex?: string | null;
  numericValue?: number | string | null;
  unit?: string | null;
  colorReferenceId?: string | null;
  inventoryItemId?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export async function listSpecOptionGroups(
  params: PageParams & { q?: string; includeInactive?: boolean } = {},
): Promise<PaginatedResponse<SpecOptionGroup>> {
  const { includeInactive, ...rest } = params;
  const qs = toSearchParams({
    ...rest,
    includeInactive: includeInactive ? 'true' : undefined,
  });
  return apiGet<PaginatedResponse<SpecOptionGroup>>(`/spec-option-groups${qs}`);
}

export async function listSpecOptionValues(
  params: PageParams & {
    q?: string;
    groupId?: string;
    groupCode?: string;
    includeInactive?: boolean;
  } = {},
): Promise<PaginatedResponse<SpecOptionValue>> {
  const { includeInactive, ...rest } = params;
  const qs = toSearchParams({
    ...rest,
    includeInactive: includeInactive ? 'true' : undefined,
  });
  return apiGet<PaginatedResponse<SpecOptionValue>>(`/spec-option-values${qs}`);
}

export async function getSpecOptionValue(id: string): Promise<SpecOptionValue> {
  return apiGet<SpecOptionValue>(`/spec-option-values/${encodeURIComponent(id)}`);
}

export type CatalogNamedRow = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  color?: string | null;
  hex?: string | null;
};

export async function listCatalogFabrics(q?: string) {
  const qs = toSearchParams({ page: 1, pageSize: 200, q });
  return apiGet<PaginatedResponse<CatalogNamedRow>>(`/fabrics${qs}`);
}

export async function listCatalogColors(q?: string) {
  const qs = toSearchParams({ page: 1, pageSize: 200, q });
  return apiGet<PaginatedResponse<CatalogNamedRow>>(`/colors${qs}`);
}
