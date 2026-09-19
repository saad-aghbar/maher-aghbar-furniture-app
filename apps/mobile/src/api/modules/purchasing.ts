import type { PaginatedResponse } from '@maher/types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import { openAuthedPdf, withPdfOptions } from '../openPdf';
import type { PdfDownloadOptions } from '@/features/pdf/pdfDownloadTypes';

export type Supplier = {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  companyName?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
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
  whatsappPhone?: string;
  email?: string;
  address?: string;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  rating?: number;
  status?: string;
  notes?: string;
};

export type UpdateSupplierInput = {
  name?: string;
  nameAr?: string;
  nameEn?: string;
  nameHe?: string;
  companyName?: string;
  phone?: string;
  whatsappPhone?: string;
  email?: string;
  address?: string;
  paymentTermsDays?: number;
  leadTimeDays?: number;
  rating?: number;
  status?: string;
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
  inventoryItem?: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    unit: string;
    category?: string | null;
    imageUrl?: string | null;
  } | null;
  receivedQty?: number | string;
  remainingQty?: number | string;
  fabricProcurementId?: string | null;
  warehouseId?: string | null;
  locationId?: string | null;
  warehouse?: NamedRef | null;
  location?: { id: string; code?: string | null; name?: string | null } | null;
  isFabric?: boolean;
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
  warehouseId?: string | null;
  warehouse?: NamedRef | null;
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

export type PurchaseOrder = {
  id: string;
  number: string;
  status: string;
  createdAt?: string | null;
  origin?: string | null;
  notes?: string | null;
  expectedDeliveryDate?: string | null;
  subtotal?: number | string;
  taxAmount?: number | string;
  total?: number | string;
  supplierId: string;
  warehouseId?: string | null;
  supplier?: Supplier | null;
  warehouse?: NamedRef | null;
  lines?: PurchaseOrderLine[];
  goodsReceipts?: GoodsReceipt[];
  presentation?: PurchaseOrderPresentation;
  purchasingCosting?: PurchasingCosting;
  orderedQty?: number | string;
  receivedAcceptedQty?: number | string;
  attachments?: PurchaseOrderAttachment[];
  whatsappSentAt?: string | null;
  whatsappLastBody?: string | null;
  whatsappLastTo?: string | null;
  purchaseRunId?: string | null;
  runId?: string | null;
  runNumber?: string | null;
  runSupplierCount?: number | null;
};

export type PurchaseRunPhase =
  | 'DRAFT'
  | 'APPROVED'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type PurchaseRun = {
  id: string;
  number: string;
  origin?: string | null;
  notes?: string | null;
  expectedDeliveryDate?: string | null;
  createdAt?: string;
  phase: PurchaseRunPhase | string;
  supplierCount: number;
  total: number | string;
  runId?: string;
  runNumber?: string;
  runSupplierCount?: number;
  orders: PurchaseOrder[];
};

export type PurchaseRunWhatsAppMessage = {
  orderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  to: string | null;
  body: string;
  templateBody: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit: string;
    warehouseName?: string | null;
    locationName?: string | null;
  }>;
};

export type BuyAlert = {
  count: number;
  lowStockCount: number;
  productionCount: number;
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
  openPurchaseOrders?: Array<{ id: string; number: string; status: string; total?: number | string }>;
  recentPurchaseOrders?: Array<{ id: string; number: string; status: string; total?: number | string }>;
  lastPurchase?: SupplierLastPurchase | null;
  previousPurchases?: SupplierLastPurchase[];
  purchaseHistory?: SupplierLastPurchase[];
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
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  taxTotal?: number | string | null;
  total?: number | string | null;
  paidAmount?: number | string | null;
  outstandingAmount?: number | string | null;
  notes?: string | null;
  materialKind?: 'FABRIC' | 'RAW' | string | null;
  supplier?: Supplier | null;
  purchaseOrder?: {
    id: string;
    number: string;
    status?: string;
    paymentTermsDays?: number | null;
  } | null;
  goodsReceipt?: { id: string; number?: string | null; receivedAt?: string | null } | null;
  lines?: Array<{
    id: string;
    description: string;
    quantity: number | string;
    unitPrice: number | string;
    taxRate?: number | string | null;
    lineTotal: number | string;
  }>;
  payments?: Array<{
    id: string;
    number?: string | null;
    amount: number | string;
    method?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    paymentDate?: string | null;
    createdAt?: string;
  }>;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  warehouseId?: string;
  notes?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    inventoryItemId?: string;
    unit?: string;
    warehouseId?: string;
    locationId?: string;
  }>;
};

export type BatchPurchaseOrderInput = {
  orders: CreatePurchaseOrderInput[];
};

export type LowStockDraftItem = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  unit: string;
  imageUrl?: string | null;
  category?: string | null;
  minStock: number;
  reorderQty?: number | null;
  onHandQty: number;
  standardCost: number;
  lastUnitCost?: number | null;
  preferredSupplierId?: string | null;
  defaultWarehouseId?: string | null;
  suggestedQty: number;
  coveredByOpenOrder?: boolean;
  onOrderQty?: number;
  stillNeeded?: number;
  reason?: 'LOW_STOCK' | 'PRODUCTION' | 'BOTH';
};

export type LowStockDraftGroup = {
  supplierId: string | null;
  supplier: Supplier | null;
  items: LowStockDraftItem[];
};

export type LowStockDraftResponse = {
  groups: LowStockDraftGroup[];
  unassigned: LowStockDraftGroup;
};

export type ReceivablePurchaseOrder = PurchaseOrder & {
  remainingQty?: number;
  isOverdue?: boolean;
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
  warehouseId?: string;
  notes?: string;
  idempotencyKey?: string;
  locationId?: string;
  photoDocumentId?: string;
  lines: Array<{
    inventoryItemId: string;
    orderedQty: number;
    receivedQty: number;
    rejectedQty?: number;
    unitCost?: number;
    warehouseId?: string;
    locationId?: string;
  }>;
};

export type PurchasingListFilters = PageParams & {
  q?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
  materialKind?: 'FABRIC' | 'RAW';
};

export async function listSuppliers(
  params: PageParams & { q?: string; status?: string } = {},
) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize ?? 50,
    q: params.q,
    status: params.status,
  });
  return apiGet<PaginatedResponse<Supplier>>(`/suppliers${qs}`);
}

export async function getSupplier(id: string) {
  return apiGet<SupplierDetail>(`/suppliers/${encodeURIComponent(id)}`);
}

export async function createSupplier(body: CreateSupplierInput) {
  return apiPost<Supplier>('/suppliers', body);
}

export async function updateSupplier(id: string, body: UpdateSupplierInput) {
  return apiPatch<Supplier>(`/suppliers/${encodeURIComponent(id)}`, body);
}

export async function archiveSupplier(id: string) {
  return apiPost<Supplier>(`/suppliers/${encodeURIComponent(id)}/archive`);
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
    warehouseId: params.warehouseId,
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

export async function sendPurchaseOrder(id: string, body?: { body?: string }) {
  return apiPost<PurchaseOrderSendResponse>(
    `/purchase-orders/${encodeURIComponent(id)}/send`,
    body ?? {},
  );
}

export async function draftPurchaseOrderWhatsApp(id: string) {
  return apiPost<{ to: string | null; body: string; supplier: Supplier }>(
    `/purchase-orders/${encodeURIComponent(id)}/whatsapp-draft`,
  );
}

export async function createPurchaseOrdersBatch(body: BatchPurchaseOrderInput) {
  return apiPost<{ orders: PurchaseOrder[]; run?: PurchaseRun | null }>(
    '/purchase-orders/batch',
    body,
  );
}

export async function createPurchaseRun(body: {
  notes?: string;
  expectedDeliveryDate?: string;
  origin?: string;
  orders: CreatePurchaseOrderInput[];
}) {
  return apiPost<PurchaseRun>('/purchase-runs', body);
}

export async function getPurchaseRun(id: string) {
  return apiGet<PurchaseRun>(`/purchase-runs/${encodeURIComponent(id)}`);
}

export async function approvePurchaseRun(id: string) {
  return apiPost<PurchaseRun>(`/purchase-runs/${encodeURIComponent(id)}/approve`);
}

export async function draftPurchaseRunWhatsApp(id: string) {
  return apiPost<{
    runId: string;
    number: string;
    phase: string;
    messages: PurchaseRunWhatsAppMessage[];
  }>(`/purchase-runs/${encodeURIComponent(id)}/whatsapp-drafts`);
}

export async function sendPurchaseRun(
  id: string,
  orders?: Array<{ id: string; body?: string }>,
) {
  return apiPost<{
    results: Array<{
      id: string;
      ok: boolean;
      to: string | null;
      error?: string;
      purchaseOrder?: PurchaseOrder;
    }>;
    run: PurchaseRun;
  }>(`/purchase-runs/${encodeURIComponent(id)}/send`, { orders });
}

export async function markPurchaseOrderSent(id: string) {
  return apiPost<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}/mark-sent`);
}

export async function getBuyAlert() {
  return apiGet<BuyAlert>('/purchase-orders/buy-alert');
}

export async function sendPurchaseOrdersBatch(
  orders: Array<{ id: string; body?: string }>,
) {
  return apiPost<{
    results: Array<{
      id: string;
      ok: boolean;
      to: string | null;
      error?: string;
      purchaseOrder?: PurchaseOrder;
    }>;
  }>('/purchase-orders/send-batch', { orders });
}

export async function getLowStockDraft(q?: string) {
  const qs = toSearchParams({ q });
  return apiGet<LowStockDraftResponse>(`/purchase-orders/low-stock-draft${qs}`);
}

export async function listReceivablePurchaseOrders(params: { warehouseId?: string; q?: string } = {}) {
  const qs = toSearchParams(params);
  return apiGet<ReceivablePurchaseOrder[]>(`/purchase-orders/receivable${qs}`);
}

export type PurchaseWhatsAppResult = {
  ok: boolean;
  to: string | null;
  body: string;
  error?: string;
};

export type PurchaseOrderSendResponse = {
  purchaseOrder: PurchaseOrder;
  whatsapp: PurchaseWhatsAppResult;
};

export async function sendPurchaseRequestToSupplier(id: string) {
  return apiPost<PurchaseOrderSendResponse>(
    `/purchase-requests/${encodeURIComponent(id)}/send-to-supplier`,
  );
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
    materialKind: params.materialKind,
  });
  return apiGet<PaginatedResponse<SupplierInvoice>>(`/supplier-invoices${qs}`);
}

export async function getSupplierInvoice(id: string) {
  return apiGet<SupplierInvoice>(`/supplier-invoices/${encodeURIComponent(id)}`);
}

export async function createSupplierInvoice(body: {
  purchaseOrderId: string;
  goodsReceiptId?: string;
  notes?: string;
}) {
  return apiPost<SupplierInvoice>('/supplier-invoices', body);
}

export async function updateSupplierInvoice(
  id: string,
  body: {
    notes?: string | null;
    dueDate?: string | null;
    invoiceDate?: string;
    subtotal?: number;
    taxTotal?: number;
    total?: number;
    status?: string;
    lines?: Array<{
      id?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
    }>;
  },
) {
  return apiPatch<SupplierInvoice>(`/supplier-invoices/${encodeURIComponent(id)}`, body);
}

export async function recordSupplierPayment(body: {
  supplierId: string;
  supplierInvoiceId?: string;
  amount: number;
  method?: string;
  referenceNumber?: string;
  notes?: string;
}) {
  return apiPost('/supplier-payments', body);
}

export async function updateSupplierPayment(
  id: string,
  body: {
    amount?: number;
    method?: string;
    referenceNumber?: string | null;
    notes?: string | null;
    paymentDate?: string;
  },
) {
  return apiPatch(`/supplier-payments/${encodeURIComponent(id)}`, body);
}

export async function deleteSupplierPayment(id: string) {
  return apiDelete<{ ok: boolean; id: string }>(
    `/supplier-payments/${encodeURIComponent(id)}`,
  );
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

export type FabricReadiness = {
  requirementId: string;
  label: string;
  sku: string | null;
  role: string | null;
  stageCode: string | null;
  unit: string;
  expectedQty: number | null;
  arrivedQty: number;
  issuedQty: number;
  storedState: string;
  derivedStatus: string;
  readyForProduction: boolean;
  overridden: boolean;
  missing: string[];
  attentionCode: string | null;
  expectedAvailableAt: string | null;
};

export type FabricTrackerItem = {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  productionOrderId?: string | null;
  productionOrderNumber?: string | null;
  salesOrderLineId?: string | null;
  itemLetter?: string | null;
  dealerName?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  imageUrl?: string | null;
  inventoryItemId?: string | null;
  sku?: string | null;
  supplier?: { id: string; name: string; phone?: string | null } | null;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  supplierInvoiceId?: string | null;
  supplierInvoiceNumber?: string | null;
  purchaseRequestId?: string | null;
  whatsappSentAt?: string | null;
  whatsappLastBody?: string | null;
  whatsappLastTo?: string | null;
  state?: string;
  expectedAvailableAt?: string | null;
  events?: Array<{
    id: string;
    kind: string;
    note?: string | null;
    createdAt: string;
    supplierId?: string | null;
  }>;
  lots: Array<{
    id: string;
    qrCode?: string | null;
    quantity: number;
    remainingQty: number | null;
    locationId?: string | null;
    locationLabel?: string | null;
    status: string;
    unitCost?: number | null;
  }>;
  /** True when a unit price is known (lot, PO, or standard cost). Safe without cost.read. */
  costOnFile?: boolean;
  /** Resolved unit price — only present when the caller can read cost. */
  resolvedUnitCost?: number | null;
  readiness: FabricReadiness;
};

export type FabricTrackerPayload = {
  salesOrderId: string;
  required: number;
  ready: number;
  missing: Array<{
    label: string;
    qty: number | null;
    unit: string;
    derivedStatus: string;
    attentionCode: string | null;
    stageCode: string | null;
  }>;
  overridden: boolean;
  items: FabricTrackerItem[];
};

export type FabricTaskBoard = {
  taskId: string;
  salesOrderId?: string | null;
  salesOrderNumber?: string | null;
  taken: number;
  total: number;
  items: Array<{
    id: string;
    label: string;
    role: string | null;
    stageCode: string | null;
    derivedStatus: string;
    readyForProduction: boolean;
    expectedQty: number | null;
    arrivedQty: number;
    issuedQty: number;
    unit: string;
    imageUrl?: string | null;
    lots: Array<{
      id: string;
      qrCode?: string | null;
      remainingQty: number | null;
      status: string;
      locationLabel?: string | null;
    }>;
  }>;
};

export async function listFabricProcurements(
  params: { q?: string; state?: string; salesOrderId?: string; supplierId?: string } = {},
) {
  const qs = toSearchParams({
    q: params.q,
    state: params.state,
    salesOrderId: params.salesOrderId,
    supplierId: params.supplierId,
  });
  return apiGet<FabricTrackerItem[]>(`/fabric-procurements${qs}`);
}

export async function getFabricProcurement(id: string) {
  return apiGet<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}`);
}

export async function getFabricProcurementByCode(code: string) {
  return apiGet<FabricTrackerItem>(
    `/fabric-procurements/by-code/${encodeURIComponent(code)}`,
  );
}

export async function getFabricTracker(salesOrderId: string) {
  return apiGet<FabricTrackerPayload>(
    `/fabric-procurements/orders/${encodeURIComponent(salesOrderId)}`,
  );
}

export async function getFabricTaskBoard(taskId: string) {
  return apiGet<FabricTaskBoard>(
    `/fabric-procurements/tasks/${encodeURIComponent(taskId)}/board`,
  );
}

export async function draftFabricWhatsApp(ids: string[], supplierId: string) {
  return apiPost<{ body: string; to: string | null; supplier: { id: string; name: string } }>(
    '/fabric-procurements/draft-whatsapp',
    { ids, supplierId },
  );
}

export async function sendFabricWhatsApp(ids: string[], supplierId: string, body?: string) {
  return apiPost('/fabric-procurements/send-whatsapp', { ids, supplierId, body });
}

export async function waitFabricProcurement(id: string, note?: string, expectedAvailableAt?: string) {
  return apiPost<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}/wait`, {
    note,
    expectedAvailableAt,
  });
}

export async function redirectFabricProcurement(id: string, supplierId: string, note?: string) {
  return apiPost<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}/redirect`, {
    supplierId,
    note,
  });
}

export async function setFabricSupplierState(
  id: string,
  state: string,
  note?: string,
  expectedAvailableAt?: string,
) {
  return apiPost<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}/supplier-state`, {
    state,
    note,
    expectedAvailableAt,
  });
}

export async function overrideFabricHold(id: string, reason: string) {
  return apiPost<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}/override`, {
    reason,
  });
}

export async function receiveFabricProcurement(
  id: string,
  body: {
    qty: number;
    locationId: string;
    unitCost?: number;
    note?: string;
    photoDocumentId?: string;
    inventoryItemId?: string;
    idempotencyKey?: string;
  },
) {
  return apiPost<FabricTrackerItem>(`/fabric-procurements/${encodeURIComponent(id)}/receive`, body);
}

export async function allocateFabricFromStock(
  id: string,
  body: {
    inventoryItemId: string;
    qty: number;
    locationId?: string;
    warehouseId?: string;
    replaceFabric?: boolean;
    reason?: string;
  },
) {
  return apiPost<FabricTrackerItem>(
    `/fabric-procurements/${encodeURIComponent(id)}/allocate-from-stock`,
    body,
  );
}

export async function takeInFabricLot(taskId: string, qrCode: string) {
  return apiPost(`/fabric-procurements/tasks/${encodeURIComponent(taskId)}/take-in`, { qrCode });
}

export async function dispositionFabricLot(
  taskId: string,
  body: { qrCode: string; returnedQty?: number; scrapQty?: number; scrapReason?: string },
) {
  return apiPost(`/fabric-procurements/tasks/${encodeURIComponent(taskId)}/disposition`, body);
}

export async function openPurchaseOrderPdf(id: string, opts?: PdfDownloadOptions) {
  await openAuthedPdf(
    withPdfOptions(`/purchasing/orders/${encodeURIComponent(id)}/pdf`, opts),
    'Purchase order PDF failed',
    'Purchase order PDF',
  );
}

export async function openGoodsReceiptPdf(id: string, opts?: PdfDownloadOptions) {
  await openAuthedPdf(
    withPdfOptions(`/purchasing/goods-receipts/${encodeURIComponent(id)}/pdf`, opts),
    'Goods receipt PDF failed',
    'Goods receipt PDF',
  );
}

export async function openSupplierPaymentPdf(id: string, opts?: PdfDownloadOptions) {
  await openAuthedPdf(
    withPdfOptions(`/supplier-payments/${encodeURIComponent(id)}/pdf`, opts),
    'Supplier payment PDF failed',
    'Supplier payment PDF',
  );
}

export async function openSupplierStatementPdf(id: string, opts?: PdfDownloadOptions) {
  await openAuthedPdf(
    withPdfOptions(`/suppliers/${encodeURIComponent(id)}/statement/pdf`, opts),
    'Supplier statement PDF failed',
    'Supplier statement PDF',
  );
}
