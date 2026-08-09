import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type SalesOrderListItem = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string | null;
  imageUrl: string | null;
  progressPercent: number | null;
  progressLabel?: string;
  /** Admin — current floor stage for the PO driving progressPercent */
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  requiredDeliveryDate: string | null;
  createdAt?: string | null;
  externalOrderNumber?: string | null;
  projectName?: string | null;
  sellerPrice?: number | string | null;
  manufacturingCost?: number | string | null;
  profit?: number | string | null;
  customer?: {
    id: string;
    name: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  productionOrders?: Array<{
    id?: string;
    number: string;
    status?: string;
    progressPercent?: number | null;
  }> | null;
};

export type SalesOrderListFilters = PageParams & {
  q?: string;
  status?: string;
  statusGroup?: 'pending' | 'production' | 'delivered';
  sortBy?: 'createdAt' | 'requiredDeliveryDate' | 'number' | 'total';
  sortDir?: 'asc' | 'desc';
  deliveryFrom?: string;
  deliveryTo?: string;
  /** Admin only — never send from dealer client. */
  customerId?: string;
};

export async function listSalesOrders(
  filters: SalesOrderListFilters = {},
): Promise<PaginatedResponse<SalesOrderListItem>> {
  const qs = toSearchParams({
    page: filters.page,
    pageSize: filters.pageSize,
    q: filters.q,
    status: filters.status,
    statusGroup: filters.statusGroup,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    deliveryFrom: filters.deliveryFrom,
    deliveryTo: filters.deliveryTo,
    customerId: filters.customerId,
  });
  return apiGet<PaginatedResponse<SalesOrderListItem>>(`/sales-orders${qs}`);
}

export type SalesOrderDocument = {
  id: string;
  fileName: string;
  mimeType: string | null;
  storageKey?: string;
  category?: string | null;
  createdAt?: string;
};

export type SalesOrderStage = {
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  sortOrder: number;
  dependsOnCodes?: string[];
  status: string;
  progressPercent?: number | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedEnd?: string | null;
  notes?: string | null;
  isOverdue?: boolean;
  assignees?: { id: string; name: string }[];
  blockers?: { id: string; category: string; reason: string }[];
  attachmentCount?: number;
  photos?: Array<{ id: string; fileName: string; mimeType?: string | null }>;
};

export type SalesOrderLineItem = {
  id: string;
  productName: string;
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  material?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabricCode?: string | null;
  woodType?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  notes?: string | null;
};

export type SalesOrderDetail = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string | null;
  imageUrl: string | null;
  notes: string | null;
  externalOrderNumber: string | null;
  deliveryAddress: string | null;
  requiredDeliveryDate: string | null;
  requestedDeliveryDate?: string | null;
  projectName?: string | null;
  total?: number | string | null;
  progressPercent: number | null;
  progressLabel?: string;
  /** Admin — current floor stage for the PO driving progressPercent */
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  sellerPrice?: number | string | null;
  productionPrice?: number | string | null;
  manufacturingCost?: number | string | null;
  costBreakdown?: Record<string, number | string | null> | null;
  profit?: number | string | null;
  assignedEmployeeId?: string | null;
  assignedEmployee?: { id: string; name: string } | null;
  customer?: {
    id: string;
    name: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
    phone?: string | null;
    fax?: string | null;
  } | null;
  customerRequest?: {
    notes?: string | null;
    source?: string | null;
    projectName?: string | null;
    externalOrderNumber?: string | null;
    endCustomerName?: string | null;
    endCustomerPhone?: string | null;
    endCustomerFax?: string | null;
    deliveryAddress?: string | null;
    requiredDeliveryDate?: string | null;
    originalText?: string | null;
    translatedText?: string | null;
    detectedLanguage?: string | null;
    targetLanguage?: string | null;
    items?: SalesOrderLineItem[];
    documents?: SalesOrderDocument[];
  } | null;
  orderedItems?: SalesOrderLineItem[];
  productionOrders?: {
    id: string;
    number: string;
    status: string;
    progressPercent?: number | null;
    progressLabel?: string;
    stages?: SalesOrderStage[];
    photos?: SalesOrderDocument[];
  }[];
  invoices?: {
    id: string;
    number: string;
    status: string;
    total?: number | string | null;
    outstandingAmount?: number | string | null;
  }[];
  deliveries?: {
    id: string;
    number: string;
    status: string;
    deliveryDate?: string | null;
    deliveryWindow?: string | null;
    recipientName?: string | null;
    deliveryAddress?: string | null;
  }[];
  returns?: {
    id: string;
    number: string;
    approvalStatus: string;
    reason?: string | null;
    productDesc?: string | null;
    quantity?: number | string | null;
    createdAt?: string;
  }[];
};

export type UpdateSalesOrderInput = {
  notes?: string;
  projectName?: string;
  externalOrderNumber?: string;
  requiredDeliveryDate?: string | null;
  deliveryAddress?: string;
  manufacturingCost?: number;
  costBreakdown?: Record<string, number>;
};

export async function getSalesOrder(id: string): Promise<SalesOrderDetail> {
  return apiGet<SalesOrderDetail>(`/sales-orders/${encodeURIComponent(id)}`);
}

export async function updateSalesOrder(
  id: string,
  body: UpdateSalesOrderInput,
): Promise<SalesOrderDetail> {
  return apiPatch<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}`,
    body,
  );
}

export async function confirmSalesOrder(id: string): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/confirm`,
  );
}

export async function holdSalesOrder(
  id: string,
  reason?: string,
): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/hold`,
    { reason },
  );
}

export async function cancelSalesOrder(
  id: string,
  reason?: string,
): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/cancel`,
    { reason },
  );
}

/** Matches admin-web Orders detail status gates. */
export const HOLDABLE_STATUSES = [
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
] as const;

export const CANCELLABLE_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
] as const;

export function canHoldSalesOrder(status: string): boolean {
  return (HOLDABLE_STATUSES as readonly string[]).includes(status);
}

export function canCancelSalesOrder(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}
