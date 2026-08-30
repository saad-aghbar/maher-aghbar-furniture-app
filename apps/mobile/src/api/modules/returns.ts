import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type ReturnReason =
  | 'MANUFACTURING_DEFECT'
  | 'INCORRECT_MEASUREMENT'
  | 'INCORRECT_MATERIAL'
  | 'INCORRECT_COLOR'
  | 'DELIVERY_DAMAGE'
  | 'CUSTOMER_REQUEST'
  | 'OTHER';

export type ReturnRequest = {
  id: string;
  number: string;
  productDesc: string;
  quantity: number | string;
  reason: ReturnReason | string;
  description?: string | null;
  approvalStatus: string;
  /** NONE | WAITING_RETURN | RETURNED | INSPECTING | RESOLVED */
  physicalStatus?: string | null;
  /** Dealer-visible note when approvalStatus is NEED_INFO. */
  needInfoNote?: string | null;
  /** Admin disposition — dealers only see resolved via lifecycle, never scrap labels. */
  inventoryFate?: string | null;
  resolution?: string | null;
  reasonPhotoUrl?: string | null;
  issuePhotoUrl?: string | null;
  /** Multi-photo galleries (preferred). */
  reasonPhotoUrls?: string[] | null;
  issuePhotoUrls?: string[] | null;
  productImageUrl?: string | null;
  createdAt?: string;
  customer?: {
    id: string;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
    lines?: Array<{
      id: string;
      description?: string;
      quantity?: number | string;
      product?: { id: string; nameEn?: string; nameAr?: string; imageUrl?: string | null } | null;
    }>;
  } | null;
};

export async function listReturns(params: PageParams & { q?: string; customerId?: string } = {}) {
  const qs = toSearchParams({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    customerId: params.customerId,
  });
  return apiGet<PaginatedResponse<ReturnRequest>>(`/returns${qs}`);
}

export async function getReturn(id: string) {
  return apiGet<ReturnRequest>(`/returns/${encodeURIComponent(id)}`);
}

export async function createReturn(body: {
  customerId?: string;
  salesOrderId?: string;
  productDesc: string;
  quantity: number;
  reason: ReturnReason;
  description?: string;
  reasonPhotoKey?: string;
  issuePhotoKey?: string;
  reasonPhotoKeys?: string[];
  issuePhotoKeys?: string[];
}) {
  return apiPost<ReturnRequest>('/returns', body);
}

export async function resolveReturn(
  id: string,
  approvalStatus: 'APPROVED' | 'REJECTED',
) {
  return apiPatch<ReturnRequest>(`/returns/${encodeURIComponent(id)}/resolve`, {
    approvalStatus,
  });
}
