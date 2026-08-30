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
  qrCode?: string | null;
  /** Authoritative printed QR payload from the API helper. */
  scanCode?: string | null;
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
  archivedAt?: string | null;
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
    imageUrl?: string | null;
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

export type InventoryOpenReceipt = {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  supplierNameAr?: string | null;
  supplierNameHe?: string | null;
  orderedQty: number | string;
  receivedQty: number | string;
  remainingQty: number | string;
  unit: string;
  expectedDeliveryDate?: string | null;
  suggestedWarehouseId?: string | null;
  status: string;
};

export async function listInventoryOpenReceipts(itemId: string) {
  return apiGet<InventoryOpenReceipt[]>(
    `/inventory/items/${encodeURIComponent(itemId)}/open-receipts`,
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

/** Fetch inventory item statement PDF (details + warehouses + photo). */
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

/** Fetch warehouse QR print sheet (centered photo + large QR). */
export async function openInventoryQrLabelPdf(
  id: string,
  sku?: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/inventory/items/${encodeURIComponent(id)}/qr-label`, opts),
    'Inventory QR label PDF failed',
    sku ? `QR label ${sku}` : 'Inventory QR label PDF',
  );
}

/** Floor print sheet for a WIP kit QR. */
export async function openWipKitQrLabelPdf(
  id: string,
  code?: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/inventory/wip-kits/${encodeURIComponent(id)}/qr-label`, opts),
    'WIP kit QR label PDF failed',
    code ? `WIP kit ${code}` : 'WIP kit QR label PDF',
  );
}

/** Floor print sheet for a WIP piece QR. */
export async function openWipPieceQrLabelPdf(
  id: string,
  code?: string,
  opts?: PdfDownloadOptions,
): Promise<void> {
  await openAuthedPdf(
    withPdfOptions(`/inventory/wip-pieces/${encodeURIComponent(id)}/qr-label`, opts),
    'WIP piece QR label PDF failed',
    code ? `WIP piece ${code}` : 'WIP piece QR label PDF',
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

export type SemiFinishedLot = {
  id: string;
  quantity: number | string;
  producedAt: string;
  status: string;
  qrCode?: string | null;
  location?: { id: string; code: string; name?: string | null } | null;
  wipKit?: { id: string; qrCode: string } | null;
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
  salesOrderNumber?: string | null;
  salesOrder?: {
    id: string;
    deliveries?: Array<{ id: string; number?: string; status?: string }>;
  } | null;
  dealerNameEn?: string | null;
  dealerNameAr?: string | null;
  projectName?: string | null;
  nextConsumingStageCode?: string | null;
  nextConsumingStageNameEn?: string | null;
  nextConsumingStageNameAr?: string | null;
  laterMovements?: Array<{
    type: string;
    quantity: number;
    createdAt: string;
    warehouseNameEn: string;
    warehouseNameAr: string;
  }>;
};

export type FinishedLot = SemiFinishedLot & {
  daysWaiting?: number;
  agingBucket?: 'READY_TODAY' | 'D1_3' | 'D4_7' | 'D8_PLUS' | 'NO_DELIVERY';
  deliveryId?: string | null;
  deliveryStatus?: string | null;
  deliveryNumber?: string | null;
  deliveryDate?: string | null;
  qcStatus?: string | null;
  qcInspectedAt?: string | null;
  packagingComplete?: boolean;
  finishedAt?: string | null;
  packagesPerUnit?: number;
  packageCount?: number;
  pieceLabels?: Array<{ nameEn: string; nameAr: string; nameHe?: string | null }>;
  packageSummary?: string | null;
  loadChecked?: number;
  loadTotal?: number;
  enteredAt?: string | null;
  leftAt?: string | null;
  dealerNameHe?: string | null;
  salesOrder?: {
    id: string;
    number?: string;
    projectName?: string | null;
    status?: string;
    customer?: {
      id: string;
      nameEn?: string | null;
      nameAr?: string | null;
      nameHe?: string | null;
      name?: string | null;
      code?: string | null;
    } | null;
    deliveries?: Array<{ id: string; number?: string; status?: string; deliveryDate?: string | null }>;
  } | null;
};

export async function listSemiFinishedLots(params: PageParams & { q?: string } = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
  });
  return apiGet<PaginatedResponse<SemiFinishedLot>>(`/inventory/semi-finished${qs}`);
}

export async function listFinishedLots(
  params: PageParams & {
    q?: string;
    warehouseId?: string;
    scope?: 'inWarehouse' | 'history';
    from?: string;
    to?: string;
  } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    warehouseId: params.warehouseId,
    scope: params.scope,
    from: params.from,
    to: params.to,
  });
  return apiGet<PaginatedResponse<FinishedLot>>(`/inventory/finished-lots${qs}`);
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

export type WipKitBoardSection = {
  stageCode: string;
  stageNameEn: string;
  stageNameAr: string;
  stageNameHe: string | null;
  kits: WipKitCard[];
};

export type WipKitCard = {
  id: string;
  status: string;
  qrCode: string;
  expectedPieceCount: number;
  custody?: string | null;
  handoffCount?: number;
  materialOverageNotes?: string | null;
  location?: { id: string; code: string; name?: string | null } | null;
  warehouse?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    type?: string;
  } | null;
  productionOrder: {
    id: string;
    number: string;
    productDescription: string;
    product?: {
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
    } | null;
  };
  stageInstance: {
    stageDefinition: {
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    };
  };
  pieces: Array<{
    id: string;
    sortOrder: number;
    label: string | null;
    qrCode: string | null;
    photoDocumentId: string | null;
    photoDocument?: {
      id: string;
      fileName: string;
      storageKey: string;
      mimeType: string;
    } | null;
    inventoryLot?: {
      id: string;
      quantity: number | string;
      status: string;
      qrCode: string | null;
    } | null;
  }>;
  producingTask?: {
    id: string;
    number: string;
    assignedEmployee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    materialUsages?: Array<{
      id: string;
      sku: string;
      expectedQty: number | string;
      actualQty: number | string;
      varianceQty: number | string;
      isExtra: boolean;
      inventoryItem?: {
        id: string;
        nameEn: string;
        nameAr: string;
        sku: string;
      } | null;
    }>;
  } | null;
  claimedByTask?: { id: string; number: string } | null;
  claimedByUser?: { id: string; firstName: string; lastName: string } | null;
};

export async function fetchWipKitBoard(params: {
  stageCode?: string;
  status?: string;
  productionOrderId?: string;
  custody?: string;
  scope?: 'active' | 'history';
  from?: string;
  to?: string;
  warehouseId?: string;
  q?: string;
} = {}) {
  const qs = toSearchParams(params);
  return apiGet<{ sections: WipKitBoardSection[]; totalKits: number }>(
    `/inventory/wip-kits/board${qs}`,
  );
}

export async function getWipKit(id: string) {
  return apiGet<WipKitCard>(`/inventory/wip-kits/${encodeURIComponent(id)}`);
}

export async function getWipKitTimeline(id: string) {
  return apiGet<{
    kit: WipKitCard;
    location: { id: string; code: string; name?: string | null } | null;
    custody: string | null;
    events: Array<{
      type: 'PRODUCED' | 'RECEIVED' | 'CONSUMED';
      at: string;
      quantity?: number;
      labelEn: string;
      meta?: Record<string, unknown>;
    }>;
  }>(`/inventory/wip-kits/${encodeURIComponent(id)}/timeline`);
}

export async function getWipKitByCode(code: string) {
  return apiGet<WipKitCard>(`/inventory/wip-kits/by-code/${encodeURIComponent(code)}`);
}

