import type { PaginatedResponse } from '@maher/types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';
import type { RequestDetail, RequestEditPolicy } from '@/features/requests/types';

export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type { RequestDetail, RequestEditPolicy };

export type CreateRequestItemInput = {
  productName: string;
  productId?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  width?: number;
  height?: number;
  depth?: number;
  fabric?: string;
  description?: string;
  color?: string;
  customMeasurements?: { label: string; value: string }[];
};

export type CreateRequestInput = {
  source?: string;
  externalOrderNumber?: string;
  priority?: RequestPriority;
  notes?: string;
  deliveryAddress?: string;
  endCustomerName?: string;
  endCustomerPhone?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** ISO date the dealer needs delivery by. */
  requiredDeliveryDate?: string;
  items: CreateRequestItemInput[];
};

export type UpdateRequestInput = Partial<CreateRequestInput> & {
  projectName?: string;
  internalNotes?: string;
};

export type RequestSummary = {
  id: string;
  number: string;
  status: string;
  priority?: string;
  title?: string | null;
  externalOrderNumber?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  createdAt?: string;
  editPolicy?: RequestEditPolicy;
  customer?: {
    id: string;
    name?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
};

export type ListRequestsFilters = PageParams & {
  status?: string;
  statusGroup?: string;
  q?: string;
};

export async function createRequest(
  body: CreateRequestInput,
  opts?: { submit?: boolean },
): Promise<RequestSummary> {
  const qs = opts?.submit ? '?submit=true' : '?submit=false';
  return apiPost<RequestSummary>(`/requests${qs}`, body);
}

export async function updateRequest(
  id: string,
  body: UpdateRequestInput,
): Promise<RequestSummary> {
  return apiPatch<RequestSummary>(`/requests/${encodeURIComponent(id)}`, body);
}

export async function submitRequest(id: string): Promise<RequestSummary> {
  return apiPost<RequestSummary>(`/requests/${encodeURIComponent(id)}/submit`);
}

export async function markRequestUnderReview(id: string): Promise<RequestDetail> {
  return apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/under-review`);
}

export async function markRequestReadyForQuotation(id: string): Promise<RequestDetail> {
  return apiPost<RequestDetail>(
    `/requests/${encodeURIComponent(id)}/ready-for-quotation`,
  );
}

export async function markRequestNeedsInformation(
  id: string,
  reason?: string,
): Promise<RequestDetail> {
  return apiPost<RequestDetail>(
    `/requests/${encodeURIComponent(id)}/needs-information`,
    { reason, notes: reason },
  );
}

export async function closeRequest(id: string): Promise<RequestDetail> {
  return apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/close`);
}

export async function confirmRequestDelivery(id: string, date: string): Promise<RequestDetail> {
  return apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/confirm-delivery`, { date });
}

export async function changeRequestDelivery(
  id: string,
  date: string,
  reason: string,
): Promise<RequestDetail> {
  return apiPost<RequestDetail>(`/requests/${encodeURIComponent(id)}/change-delivery`, {
    date,
    reason,
  });
}

export async function discardRequestDraft(id: string): Promise<{ id: string; discarded: boolean }> {
  return apiDelete<{ id: string; discarded: boolean }>(
    `/requests/${encodeURIComponent(id)}`,
  );
}

export async function getRequest(id: string): Promise<RequestDetail> {
  return apiGet<RequestDetail>(`/requests/${encodeURIComponent(id)}`);
}

export async function listRequests(
  filters: ListRequestsFilters = {},
): Promise<PaginatedResponse<RequestSummary>> {
  const qs = toSearchParams({
    page: filters.page,
    pageSize: filters.pageSize,
    status: filters.status,
    statusGroup: filters.statusGroup,
    q: filters.q,
  });
  return apiGet<PaginatedResponse<RequestSummary>>(`/requests${qs}`);
}
