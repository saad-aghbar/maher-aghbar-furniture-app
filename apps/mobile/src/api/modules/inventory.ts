import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { openAuthedPdf, withPdfOptions } from '../openPdf';
import type { PdfDownloadOptions } from '@/features/pdf/pdfDownloadTypes';
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
  onHandQty?: number | string;
  freeQty?: number | string;
  warehouseId: string;
  warehouse?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    type?: string;
  } | null;
};

export type InventoryCustomMeasurement = {
  id?: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  value?: number | null;
  unit?: string | null;
};

export type InventoryItem = {
  id: string;
  sku: string;
  barcode?: string | null;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  description?: string | null;
  category: string;
  materialType?: string | null;
  color?: string | null;
  size?: string | null;
  customMeasurements?: InventoryCustomMeasurement[] | null;
  /** Optional photo (typically accessories). */
  imageUrl?: string | null;
  unit: string;
  /** Present only when caller has inventory.cost.read */
  standardCost?: number | string | null;
  materialId?: string | null;
  minStock: number | string;
  maxStock?: number | string | null;
  isActive?: boolean;
  /** Lifecycle class from the API: RAW_MATERIAL | SEMI_FINISHED_GOOD | FINISHED_GOOD */
  itemClass?: string | null;
  onHandQty?: number | string;
  reservedQty?: number | string;
  freeQty?: number | string;
  product?: {
    id: string;
    sku?: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  } | null;
  balances?: InventoryBalance[];
  quarantinedQty?: number | string;
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
  isDefault?: boolean;
};

export const WAREHOUSE_TYPES = ['RAW_MATERIALS', 'SEMI_FINISHED', 'FINISHED_GOODS'] as const;
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

export type CreateWarehouseInput = {
  nameEn: string;
  nameAr: string;
  type: WarehouseType;
  code?: string;
  isDefault?: boolean;
};

export async function listWarehouses() {
  return apiGet<Warehouse[]>('/inventory/warehouses');
}

export async function createWarehouse(body: CreateWarehouseInput) {
  return apiPost<Warehouse>('/warehouses', body);
}

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
    itemClass?: string;
    materialGroup?: string;
    warehouseType?: string;
    warehouseId?: string;
    q?: string;
    isPurchasable?: string;
  } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    categoryGroup: params.categoryGroup,
    category: params.category,
    itemClass: params.itemClass,
    materialGroup: params.materialGroup,
    warehouseType: params.warehouseType,
    warehouseId: params.warehouseId,
    q: params.q,
    isPurchasable: params.isPurchasable,
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
  type?: string;
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

export async function listWarehouseTransfers(
  params: PageParams & { warehouseType?: string } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    warehouseType: params.warehouseType,
  });
  return apiGet<PaginatedResponse<WarehouseTransfer>>(`/inventory/transfers${qs}`);
}

export async function listInventoryStockCounts(
  params: PageParams & { warehouseType?: string } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    warehouseType: params.warehouseType,
  });
  return apiGet<PaginatedResponse<InventoryStockCount>>(`/inventory/counts${qs}`);
}

export type CreateInventoryItemInput = {
  sku?: string;
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
  customMeasurements?: InventoryCustomMeasurement[] | null;
  description?: string;
  imageUrl?: string | null;
};

export type UpdateInventoryItemInput = {
  nameEn?: string;
  nameAr?: string;
  unit?: string;
  category?: string;
  minStock?: number;
  standardCost?: number;
  barcode?: string;
  color?: string;
  materialType?: string;
  size?: string;
  customMeasurements?: InventoryCustomMeasurement[] | null;
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

export const INVENTORY_CATEGORY_GROUPS: InventoryCategoryGroup[] = [
  'fabric',
  'foam',
  'wood',
  'accessories',
];

export function categoryGroupFromCategory(
  category?: string | null,
): InventoryCategoryGroup {
  switch (category) {
    case 'FOAM':
      return 'foam';
    case 'WOOD':
      return 'wood';
    case 'METAL_ACCESSORY':
    case 'DECORATIVE_ACCESSORY':
    case 'PACKAGING':
      return 'accessories';
    default:
      return 'fabric';
  }
}

/** Catalog unit price from inventory (`standardCost`). Treats missing/invalid as 0. */
export function inventoryItemUnitCost(
  item: { standardCost?: number | string | null } | null | undefined,
): number {
  const raw = item?.standardCost;
  if (raw == null || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function createInventoryItem(body: CreateInventoryItemInput) {
  return apiPost<InventoryItem>('/inventory/items', body);
}

export async function updateInventoryItem(id: string, body: UpdateInventoryItemInput) {
  return apiPatch<InventoryItem>(`/inventory/items/${encodeURIComponent(id)}`, body);
}

/** Fetch inventory label PDF with Bearer auth and open / share. */
export async function openInventoryLabelPdf(
  id: string,
  sku?: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/inventory/items/${encodeURIComponent(id)}/label`, opts),
    'Inventory label PDF failed',
    sku ? `Label ${sku}` : 'Inventory label PDF',
  );
}

export async function createWarehouseTransfer(body: CreateWarehouseTransferInput) {
  return apiPost<WarehouseTransfer>('/inventory/transfers', body);
}

export async function completeWarehouseTransfer(id: string) {
  return apiPost<WarehouseTransfer>(`/inventory/transfers/${encodeURIComponent(id)}/complete`, {});
}

export async function createInventoryStockCount(body: CreateInventoryStockCountInput) {
  return apiPost<InventoryStockCount>('/inventory/counts', body);
}

export async function postInventoryStockCount(id: string) {
  return apiPost<InventoryStockCount>(`/inventory/counts/${encodeURIComponent(id)}/post`, {});
}

export type InventoryOverview = {
  rawMaterials: {
    itemCount: number;
    lowStockCount: number;
    groups: Record<string, InventoryGroupSummary>;
  };
  semiFinished: { itemCount: number; totalQty: number; waitingCount: number };
  finishedGoods: {
    itemCount: number;
    availableQty: number;
    reservedQty: number;
    readyForDeliveryQty: number;
  };
};

export async function getInventoryOverview() {
  return apiGet<InventoryOverview>('/inventory/overview');
}

/** Low-stock raw materials — same list the atelier uses on Inventory. */
export async function listLowStock() {
  return apiGet<InventoryItem[]>('/inventory/low-stock');
}

export type SemiFinishedLot = {
  id: string;
  quantity: number | string;
  producedAt: string;
  status: string;
  inventoryItem: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    product?: {
      id: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
      imageUrl?: string | null;
    } | null;
  };
  warehouse: { id: string; code: string; nameEn: string; nameAr: string };
  productionOrder?: { id: string; number: string; productDescription: string } | null;
  stageInstance?: {
    stageDefinition?: { code: string; nameEn: string; nameAr: string; nameHe?: string | null } | null;
  } | null;
  productNameEn?: string | null;
  productNameAr?: string | null;
  productionOrderNumber?: string | null;
  producingStageNameEn?: string | null;
  producingStageNameAr?: string | null;
  laterMovements?: Array<{
    type: string;
    quantity: number;
    createdAt: string;
    warehouseNameEn: string;
    warehouseNameAr: string;
  }>;
};

export async function listSemiFinishedLots(params: PageParams & { q?: string } = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
  });
  return apiGet<PaginatedResponse<SemiFinishedLot>>(`/inventory/semi-finished${qs}`);
}

export async function getInventoryLot(id: string) {
  return apiGet<SemiFinishedLot>(`/inventory/lots/${encodeURIComponent(id)}`);
}

export async function listFinishedGoodsItems(
  params: PageParams & { q?: string } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    itemClass: 'FINISHED_GOOD',
  });
  return apiGet<PaginatedResponse<InventoryItem>>(`/inventory/finished-goods${qs}`);
}
