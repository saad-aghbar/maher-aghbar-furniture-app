import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type Supplier = {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTermsDays?: number | null;
  leadTimeDays?: number | null;
  rating?: number | null;
  isCertified?: boolean | null;
  isActive?: boolean;
  notes?: string | null;
  status?: string | null;
};

export type CreateSupplierInput = {
  name: string;
  nameAr?: string;
  nameEn?: string;
  nameHe?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  rating?: number;
  isCertified?: boolean;
  notes?: string;
};

export type NamedRef = {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  code?: string | null;
};

export type PurchaseOrderPresentation = {
  phase: string;
  labelKey: string;
  tone?: string;
  progress: number;
  attentionReason?: string | null;
  primaryAction?: string | null;
};

export type PurchasingCosting = {
  expectedTotal: number | string;
  actualReceivedValue: number | string;
  purchaseVariance: number | string;
};

export type PurchaseOrderLine = {
  id?: string;
  description: string;
  quantity: number | string;
  unit?: string;
  unitPrice: number | string;
  lineTotal?: number | string;
  inventoryItemId?: string | null;
  inventoryItem?: { id: string; sku: string; nameEn: string; nameAr: string; unit: string } | null;
  receivedQty?: number | string;
  remainingQty?: number | string;
};

export type GoodsReceiptLine = {
  id?: string;
  inventoryItemId?: string;
  receivedQty?: number | string;
  rejectedQty?: number | string;
  unitCost?: number | string | null;
  extendedCost?: number | string | null;
  inventoryItem?: { id: string; sku?: string; nameEn?: string; nameAr?: string } | null;
};

export type GoodsReceipt = {
  id: string;
  number?: string;
  createdAt?: string;
  receiptDate?: string;
  notes?: string | null;
  lines?: GoodsReceiptLine[];
};

export type PurchaseOrderAttachment = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category: string;
  sizeBytes?: number | null;
  createdAt: string;
};

export type GoodsReceiptLine = {
  id?: string;
  inventoryItemId: string;
  orderedQty?: number | string;
  receivedQty?: number | string;
  rejectedQty?: number | string;
};

export type GoodsReceipt = {
  id: string;
  number?: string;
  createdAt?: string;
  receiptDate?: string;
  lines?: GoodsReceiptLine[];
};

export type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  notes?: string | null;
  expectedDeliveryDate?: string | null;
  subtotal?: number | string;
  taxAmount?: number | string;
  total?: number | string;
  supplierId: string;
  warehouseId?: string | null;
  supplier?: Supplier | null;
  lines?: PurchaseOrderLine[];
  goodsReceipts?: GoodsReceipt[];
  presentation?: PurchaseOrderPresentation;
  purchasingCosting?: PurchasingCosting;
  orderedQty?: number | string;
  receivedAcceptedQty?: number | string;
  attachments?: PurchaseOrderAttachment[];
};

export type SupplierLastPurchase = {
  receiptNumber?: string;
  receiptDate?: string | null;
  purchaseOrderNumber?: string;
  sku?: string | null;
  nameEn?: string | null;
  unitCost?: number | null;
  acceptedQty?: number;
};

export type SupplierDetail = Supplier & {
  openPurchaseOrders?: Array<{ id: string; number: string; status: string }>;
  lastPurchase?: SupplierLastPurchase | null;
  previousPurchases?: SupplierLastPurchase[];
};

export type PurchaseRequestLine = {
  id?: string;
  description: string;
  quantity: number | string;
  unit?: string | null;
  inventoryItemId?: string | null;
  inventoryItem?: { id: string; sku: string; nameEn: string; nameAr: string; unit: string } | null;
};

export type SupplierOffer = {
  id: string;
  supplierId: string;
  unitPrice: number | string;
  leadTimeDays?: number | null;
  qualityScore?: number | null;
  isSelected?: boolean;
  notes?: string | null;
  supplier?: NamedRef | null;
};

export type PurchaseRequest = {
  id: string;
  number: string;
  status: string;
  reason?: string | null;
  warehouseId?: string | null;
  preferredSupplierId?: string | null;
  purchaseOrderId?: string | null;
  warehouse?: NamedRef | null;
  preferredSupplier?: NamedRef | null;
  lines?: PurchaseRequestLine[];
  offers?: SupplierOffer[];
  purchaseOrder?: {
    id: string;
    number: string;
    status?: string;
    supplier?: NamedRef | null;
  } | null;
};

export type SupplierInvoice = {
  id: string;
  number: string;
  status: string;
  supplierId: string;
  dueDate?: string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  total?: number | string | null;
  paidAmount?: number | string | null;
  outstandingAmount?: number | string | null;
  notes?: string | null;
  supplier?: Supplier | null;
  purchaseOrder?: { id: string; number: string; status?: string } | null;
  lines?: Array<{
    id: string;
    description: string;
    quantity: number | string;
    unitPrice: number | string;
    lineTotal: number | string;
  }>;
  payments?: Array<{
    id: string;
    amount: number | string;
    method?: string | null;
    createdAt?: string;
  }>;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  warehouseId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    inventoryItemId?: string;
    unit?: string;
  }>;
};

export type CreatePurchaseRequestInput = {
  reason?: string;
  warehouseId?: string;
  preferredSupplierId?: string;
  lines: Array<{
    description: string;
    quantity: number;
    inventoryItemId?: string;
    unit?: string;
  }>;
};

export type GoodsReceiptInput = {
  warehouseId: string;
  notes?: string;
  idempotencyKey?: string;
  lines: Array<{
    inventoryItemId: string;
    orderedQty: number;
    receivedQty: number;
    rejectedQty?: number;
    unitCost?: number;
  }>;
};

export type PurchasingListFilters = PageParams & {
  q?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function listSuppliers(params: PageParams & { q?: string } = {}) {
  const qs = toSearchParams({ page: params.page, pageSize: params.pageSize ?? 50, q: params.q });
  return apiGet<PaginatedResponse<Supplier>>(`/suppliers${qs}`);
}

export async function getSupplier(id: string) {
  return apiGet<SupplierDetail>(`/suppliers/${encodeURIComponent(id)}`);
}

export async function createSupplier(body: CreateSupplierInput) {
  return apiPost<Supplier>('/suppliers', body);
}

export async function listPurchaseOrders(params: PurchasingListFilters = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    status: params.status,
    supplierId: params.supplierId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return apiGet<PaginatedResponse<PurchaseOrder>>(`/purchase-orders${qs}`);
}

export async function getPurchaseOrder(id: string) {
  return apiGet<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}`);
}

export async function createPurchaseOrder(body: CreatePurchaseOrderInput) {
  return apiPost<PurchaseOrder>('/purchase-orders', body);
}

export async function approvePurchaseOrder(id: string) {
  return apiPost<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}/approve`);
}

export async function sendPurchaseOrder(id: string) {
  return apiPost<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}/send`);
}

export async function receivePurchaseOrder(id: string, body: GoodsReceiptInput) {
  return apiPost(`/purchase-orders/${encodeURIComponent(id)}/goods-receipts`, body);
}

export async function listPurchaseRequests(params: PurchasingListFilters = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    status: params.status,
    supplierId: params.supplierId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return apiGet<PaginatedResponse<PurchaseRequest>>(`/purchase-requests${qs}`);
}

export async function getPurchaseRequest(id: string) {
  return apiGet<PurchaseRequest>(`/purchase-requests/${encodeURIComponent(id)}`);
}

export async function createPurchaseRequest(body: CreatePurchaseRequestInput) {
  return apiPost<PurchaseRequest>('/purchase-requests', body);
}

export async function approvePurchaseRequest(id: string) {
  return apiPost<PurchaseRequest>(`/purchase-requests/${encodeURIComponent(id)}/approve`);
}

export async function convertPurchaseRequest(id: string) {
  return apiPost<PurchaseOrder>(`/purchase-requests/${encodeURIComponent(id)}/convert`);
}

export async function createPurchaseRequestFromLowStock() {
  return apiPost<PurchaseRequest>('/purchase-requests/from-low-stock');
}

export async function listSupplierInvoices(params: PurchasingListFilters = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    status: params.status,
    supplierId: params.supplierId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });
  return apiGet<PaginatedResponse<SupplierInvoice>>(`/supplier-invoices${qs}`);
}

export async function getSupplierInvoice(id: string) {
  return apiGet<SupplierInvoice>(`/supplier-invoices/${encodeURIComponent(id)}`);
}

export type MaterialDemandIncoming = {
  qty: number | string;
  eta?: string | null;
  purchaseOrderNumber?: string;
};

export type MaterialDemandAffected = {
  productionOrderId: string;
  productionOrderNumber: string;
  stageCode: string;
  qty: number | string;
  requiredBy?: string | null;
};

export type MaterialDemandRow = {
  inventoryItemId: string;
  sku: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  standardCost?: number | string | null;
  onHandQty?: number | string;
  reservedQty?: number | string;
  freeQty?: number | string;
  availableQty?: number | string;
  requiredQty: number | string;
  incomingQty?: number | string;
  stillNeeded?: number | string;
  nextEta?: string | null;
  nextRequiredBy?: string | null;
  status?: 'COVERED' | 'AT_RISK' | 'SHORTAGE' | 'NO_ETA' | string | null;
  incoming?: MaterialDemandIncoming[];
  affected?: MaterialDemandAffected[];
};

export async function getMaterialDemand() {
  return apiGet<MaterialDemandRow[]>('/material-demand');
}
