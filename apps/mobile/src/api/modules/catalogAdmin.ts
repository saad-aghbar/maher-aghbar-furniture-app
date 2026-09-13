import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import type { PaginatedResponse } from '@maher/types';
import type { BrowseCategory } from './catalog';

export type AdminBomLine = {
  sku: string;
  qty: number;
  category?: string | null;
  unitCost: number;
  lineCost: number;
  nameEn: string;
  nameAr: string;
  materialId?: string | null;
  /** Inventory item id (not Material.id). */
  inventoryItemId?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
};

export type AdminCustomMeasurement = {
  id?: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  value?: number | null;
  /** Display unit — cm, m, pcs, or any short custom label. */
  unit?: string | null;
};

export type AdminProductDetail = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  description?: string | null;
  categoryId?: string | null;
  category?: BrowseCategory | null;
  basePrice?: number | string | null;
  unit?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
  galleryUrls?: string[];
  manufacturingCost?: number | string | null;
  productionCost?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
  adminNotes?: string | null;
  bomDefaults?: { materials?: { sku: string; qty: number; unitCost?: number; category?: string }[] } | null;
  customMeasurements?: AdminCustomMeasurement[] | null;
  bomLines?: AdminBomLine[];
};

export type AdminProductPatch = {
  nameEn?: string;
  nameAr?: string;
  nameHe?: string | null;
  description?: string | null;
  categoryId?: string | null;
  basePrice?: number;
  unit?: string;
  isActive?: boolean;
  imageUrl?: string | null;
  galleryUrls?: string[];
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  adminNotes?: string | null;
  customMeasurements?: AdminCustomMeasurement[] | null;
  bomDefaults?: {
    materials: { sku: string; qty: number; unitCost?: number; category?: string }[];
  } | null;
};

export type ProductDealerPrice = {
  id: string;
  customerId: string;
  productId: string;
  variantId?: string | null;
  price: number | string;
  currency: string;
  customer?: {
    id: string;
    code?: string | null;
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  } | null;
};

export type MaterialListItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  category?: string | null;
  unit?: string | null;
  isActive?: boolean;
};

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  return apiGet<AdminProductDetail>(`/products/${encodeURIComponent(id)}`);
}

export type AdminProductListItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  isActive?: boolean;
  imageUrl?: string | null;
  basePrice?: number | string | null;
  manufacturingCost?: number | string | null;
  productionCost?: number | string | null;
  categoryId?: string | null;
  category?: {
    id: string;
    code?: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
};

export async function listAdminProducts(
  params: PageParams & { q?: string; isActive?: string } = {},
): Promise<PaginatedResponse<AdminProductListItem>> {
  const qs = toSearchParams({
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 100,
    q: params.q,
    isActive: params.isActive ?? 'true',
  });
  return apiGet(`/products${qs}`);
}

export async function patchAdminProduct(
  id: string,
  body: AdminProductPatch,
): Promise<AdminProductDetail> {
  return apiPatch<AdminProductDetail>(`/products/${encodeURIComponent(id)}`, body);
}

export type AdminProductCreate = {
  sku?: string;
  nameEn?: string;
  nameAr: string;
  nameHe?: string;
  description?: string;
  categoryId?: string | null;
  basePrice?: number;
  unit?: string;
  isActive?: boolean;
  imageUrl?: string | null;
  galleryUrls?: string[];
  manufacturingCost?: number;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  adminNotes?: string | null;
  customMeasurements?: AdminCustomMeasurement[] | null;
  bomDefaults?: {
    materials: { sku: string; qty: number; unitCost?: number; category?: string }[];
  } | null;
};

export async function createAdminProduct(
  body: AdminProductCreate,
): Promise<AdminProductDetail> {
  return apiPost<AdminProductDetail>('/products', {
    ...body,
    unit: body.unit ?? 'pcs',
    isActive: body.isActive ?? true,
  });
}

export async function listProductCategories(
  params: PageParams & { q?: string } = {},
): Promise<PaginatedResponse<BrowseCategory>> {
  const qs = toSearchParams(params);
  return apiGet<PaginatedResponse<BrowseCategory>>(`/product-categories${qs}`);
}

export type ProductCategoryCreate = {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string;
};

export async function createProductCategory(
  body: ProductCategoryCreate,
): Promise<BrowseCategory> {
  return apiPost<BrowseCategory>('/product-categories', body);
}

export async function listProductDealerPrices(
  productId: string,
  variantId?: string | null,
): Promise<ProductDealerPrice[]> {
  const qs = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
  return apiGet<ProductDealerPrice[]>(
    `/products/${encodeURIComponent(productId)}/dealer-prices${qs}`,
  );
}

export async function upsertDealerPrice(input: {
  customerId: string;
  productId: string;
  variantId?: string | null;
  price: number;
  currency?: string;
}): Promise<unknown> {
  return apiPost(`/customers/${encodeURIComponent(input.customerId)}/dealer-prices`, {
    productId: input.productId,
    ...(input.variantId ? { variantId: input.variantId } : {}),
    price: input.price,
    currency: input.currency ?? 'ILS',
  });
}

export type TranslatedCatalogName = {
  nameAr: string;
  nameEn: string;
  nameHe: string;
};

export async function translateCatalogName(
  text: string,
  kind: 'name' | 'prose' = 'name',
  sourceLocale: 'ar' | 'en' | 'he' = 'ar',
): Promise<TranslatedCatalogName> {
  return apiPost<TranslatedCatalogName>('/catalog/translate-name', {
    text,
    kind,
    sourceLocale,
  });
}

export async function deleteDealerPrice(customerId: string, priceId: string): Promise<unknown> {
  return apiDelete(
    `/customers/${encodeURIComponent(customerId)}/dealer-prices/${encodeURIComponent(priceId)}`,
  );
}

export type AdminVariantOption = {
  specOptionValueId: string;
  qty?: number | string | null;
  note?: string | null;
  specOptionValue?: {
    id: string;
    groupId: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    group?: { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null };
  };
};

export type AdminProductVariant = {
  id: string;
  productId: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  basePrice?: number | string | null;
  manufacturingCost?: number | string | null;
  bomDefaults?: unknown;
  imageUrl?: string | null;
  galleryUrls?: string[];
  workflowId?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
  measurements?: Array<{
    key: string;
    labelAr?: string | null;
    labelEn?: string | null;
    labelHe?: string | null;
    value: number | string | null;
    unit: string;
  }> | null;
  composition?: Array<{
    labelAr?: string | null;
    labelEn?: string | null;
    labelHe?: string | null;
    qty: number;
  }> | null;
  includedItems?: Array<{
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
    specOptionValueId?: string | null;
    width?: number | null;
    height?: number | null;
    qty: number;
    unit?: string | null;
    inventoryItemId?: string | null;
    note?: string | null;
  }> | null;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  adminNotes?: string | null;
  options?: AdminVariantOption[];
};

export type AdminProductVariantWrite = {
  sku?: string;
  code?: string;
  nameAr?: string;
  nameEn?: string;
  nameHe?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  basePrice?: number | null;
  bomDefaults?: unknown;
  workflowId?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  measurements?: AdminProductVariant['measurements'];
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  adminNotes?: string | null;
  options?: Array<{ specOptionValueId: string; qty?: number | null; note?: string | null }>;
};

export async function listProductVariants(
  productId: string,
  includeInactive = true,
): Promise<AdminProductVariant[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  return apiGet<AdminProductVariant[]>(
    `/products/${encodeURIComponent(productId)}/variants${qs}`,
  );
}

export async function getProductVariant(
  productId: string,
  variantId: string,
): Promise<AdminProductVariant> {
  return apiGet<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
  );
}

export async function createProductVariant(
  productId: string,
  body: AdminProductVariantWrite,
): Promise<AdminProductVariant> {
  return apiPost<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants`,
    body,
  );
}

export async function patchProductVariant(
  productId: string,
  variantId: string,
  body: AdminProductVariantWrite,
): Promise<AdminProductVariant> {
  return apiPatch<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    body,
  );
}

export async function duplicateProductVariant(
  productId: string,
  variantId: string,
): Promise<AdminProductVariant> {
  return apiPost<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/duplicate`,
    {},
  );
}

export async function deactivateProductVariant(productId: string, variantId: string) {
  return apiPost<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/deactivate`,
    {},
  );
}

export async function activateProductVariant(productId: string, variantId: string) {
  return apiPost<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/activate`,
    {},
  );
}

export async function copyVariantFromStandard(productId: string, variantId: string) {
  return apiPost<AdminProductVariant>(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/copy-from-standard`,
    {},
  );
}

export type VariantCostBreakdown = {
  materials: { total: number; breakdown: Record<string, number> };
  labor: { minutes: number; hours: number; cost: number };
  manufacturingCost: number;
};

export async function getVariantCost(
  productId: string,
  variantId: string,
): Promise<VariantCostBreakdown> {
  return apiGet(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/cost`,
  );
}

export async function promoteProductFromOrderLine(lineId: string) {
  return apiPost(`/products/from-order-line/${encodeURIComponent(lineId)}`, {});
}

export async function promoteVariantFromOrderLine(productId: string, lineId: string) {
  return apiPost(
    `/products/${encodeURIComponent(productId)}/variants/from-order-line/${encodeURIComponent(lineId)}`,
    {},
  );
}

export async function listMaterials(
  params: PageParams & { q?: string; isActive?: string; categoryGroup?: string } = {},
): Promise<PaginatedResponse<MaterialListItem>> {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    isActive: params.isActive ?? 'true',
    categoryGroup: params.categoryGroup,
  });
  return apiGet<PaginatedResponse<MaterialListItem>>(`/materials${qs}`);
}
