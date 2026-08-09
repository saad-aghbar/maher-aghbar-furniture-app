import type { PaginatedResponse } from '@maher/types';
import { Linking, Share } from 'react-native';
import { getAccessToken } from '@/storage/tokens';
import { apiGet, apiPatch, apiPost } from '../client';
import { getApiV1Url } from '../config';
import { toSearchParams, type PageParams } from '../pagination';

export type InventoryCategoryGroup = 'fabric' | 'foam' | 'wood' | 'accessories';

export type InventoryGroupSummary = {
  categoryGroup: InventoryCategoryGroup;
  materialCount: number;
  lowStockCount: number;
  totalOnHand: number | string;
  primaryUnit: string | null;
};

export type InventoryBalance = {
  id: string;
  availableQty: number | string;
  reservedQty?: number | string;
  warehouseId: string;
  warehouse?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
  } | null;
};

export type InventoryItem = {
  id: string;
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn: string;
  description?: string | null;
  category: string;
  materialType?: string | null;
  color?: string | null;
  size?: string | null;
  /** Optional photo (typically accessories). */
  imageUrl?: string | null;
  unit: string;
  /** Present only when caller has inventory.cost.read */
  standardCost?: number | string | null;
  minStock: number | string;
  maxStock?: number | string | null;
  isActive?: boolean;
  balances?: InventoryBalance[];
};

export type InventoryTransaction = {
  id: string;
  number: string;
  type: string;
  inventoryItemId: string;
  warehouseId: string;
  quantity: number | string;
  unitCost?: number | string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  warehouse?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
  } | null;
};

export type Warehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  type?: string;
  isActive?: boolean;
};

export type StockReceiptInput = {
  inventoryItemId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
  idempotencyKey?: string;
};

export type StockIssueInput = {
  inventoryItemId: string;
  warehouseId: string;
  quantity: number;
  notes?: string;
  idempotencyKey?: string;
};

export async function listInventoryGroups() {
  return apiGet<InventoryGroupSummary[]>('/inventory/groups');
}

export async function listInventoryItems(
  params: PageParams & {
    categoryGroup?: InventoryCategoryGroup | string;
    category?: string;
    q?: string;
  } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    categoryGroup: params.categoryGroup,
    category: params.category,
    q: params.q,
  });
  return apiGet<PaginatedResponse<InventoryItem>>(`/inventory/items${qs}`);
}

export async function getInventoryItem(id: string) {
  return apiGet<InventoryItem>(`/inventory/items/${id}`);
}

export async function getInventoryItemByCode(code: string) {
  return apiGet<InventoryItem>(
    `/inventory/items/by-code/${encodeURIComponent(code.trim())}`,
  );
}

export async function listInventoryTransactions(
  id: string,
  params: PageParams = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
  });
  return apiGet<PaginatedResponse<InventoryTransaction>>(
    `/inventory/items/${id}/transactions${qs}`,
  );
}

export async function listWarehouses() {
  return apiGet<Warehouse[]>('/inventory/warehouses');
}

export async function receiveStock(body: StockReceiptInput) {
  return apiPost<InventoryTransaction>('/inventory/receipts', body);
}

export async function issueStock(body: StockIssueInput) {
  return apiPost<InventoryTransaction>('/inventory/issues', body);
}

export async function syncInventoryFromMaterials() {
  return apiPost<{ created: number }>('/inventory/items/sync-from-materials', {});
}

export type WarehouseRef = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

export type WarehouseTransferLine = {
  id: string;
  inventoryItemId: string;
  quantity: number | string;
};

export type WarehouseTransfer = {
  id: string;
  number: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromWarehouse: WarehouseRef;
  toWarehouse: WarehouseRef;
  lines: WarehouseTransferLine[];
};

export type InventoryCountLine = {
  id: string;
  inventoryItemId: string;
  systemQty: number | string;
  countedQty?: number | string | null;
  varianceQty?: number | string | null;
};

export type InventoryStockCount = {
  id: string;
  number: string;
  status: string;
  warehouseId: string;
  notes?: string | null;
  createdAt: string;
  countedAt?: string | null;
  lines: InventoryCountLine[];
};

export async function listWarehouseTransfers(params: PageParams = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
  });
  return apiGet<PaginatedResponse<WarehouseTransfer>>(`/inventory/transfers${qs}`);
}

export async function listInventoryStockCounts(params: PageParams = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
  });
  return apiGet<PaginatedResponse<InventoryStockCount>>(`/inventory/counts${qs}`);
}

export type CreateInventoryItemInput = {
  sku: string;
  nameEn: string;
  nameAr: string;
  unit?: string;
  category?: string;
  minStock?: number;
  standardCost?: number;
  barcode?: string;
  color?: string;
  materialType?: string;
  size?: string;
  description?: string;
  imageUrl?: string | null;
};

export type UpdateInventoryItemInput = {
  nameEn?: string;
  nameAr?: string;
  unit?: string;
  minStock?: number;
  standardCost?: number;
  barcode?: string;
  color?: string;
  materialType?: string;
  size?: string;
  description?: string;
  imageUrl?: string | null;
};

export type CreateWarehouseTransferInput = {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  lines: Array<{ inventoryItemId: string; quantity: number }>;
};

export type CreateInventoryStockCountInput = {
  warehouseId: string;
  notes?: string;
  lines: Array<{ inventoryItemId: string; countedQty?: number }>;
};

/** Maps UI category group → API category string (matches admin-web). */
export const INVENTORY_CATEGORY_FOR_CREATE: Record<InventoryCategoryGroup, string> = {
  fabric: 'FABRIC',
  foam: 'FOAM',
  wood: 'WOOD',
  accessories: 'METAL_ACCESSORY',
};

export async function createInventoryItem(body: CreateInventoryItemInput) {
  return apiPost<InventoryItem>('/inventory/items', body);
}

export async function updateInventoryItem(id: string, body: UpdateInventoryItemInput) {
  return apiPatch<InventoryItem>(`/inventory/items/${encodeURIComponent(id)}`, body);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

/** Fetch inventory label PDF with Bearer auth and open / share. */
export async function openInventoryLabelPdf(id: string, sku?: string): Promise<void> {
  const token = await getAccessToken();
  const url = `${getApiV1Url()}/inventory/items/${encodeURIComponent(id)}/label`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Inventory label PDF failed (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  const dataUrl = `data:application/pdf;base64,${arrayBufferToBase64(buf)}`;
  const canOpen = await Linking.canOpenURL(dataUrl);
  if (canOpen) {
    await Linking.openURL(dataUrl);
    return;
  }
  await Share.share({
    url: dataUrl,
    message: sku ? `Label ${sku}` : 'Inventory label PDF',
  });
}

export async function createWarehouseTransfer(body: CreateWarehouseTransferInput) {
  return apiPost<WarehouseTransfer>('/inventory/transfers', body);
}

export async function createInventoryStockCount(body: CreateInventoryStockCountInput) {
  return apiPost<InventoryStockCount>('/inventory/counts', body);
}
