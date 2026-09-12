import type { PaginatedResponse } from '@maher/types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type ReturnReason =
  | 'MANUFACTURING_DEFECT'
  | 'INCORRECT_MEASUREMENT'
  | 'INCORRECT_MATERIAL'
  | 'INCORRECT_COLOR'
  | 'DELIVERY_DAMAGE'
  | 'CUSTOMER_REQUEST'
  | 'OTHER';

export type ReturnInventoryFate =
  | 'PENDING'
  | 'RETURN_TO_STOCK'
  | 'REWORK'
  | 'DAMAGED'
  | 'SCRAP';

export type ReturnLifecycleState =
  | 'REQUESTED'
  | 'NEED_INFO'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'REWORKING'
  | 'REPLACING'
  | 'READY_TO_RETURN'
  | 'RETURNING'
  | 'RETURNED_TO_STOCK'
  | 'SCRAPPED'
  | 'COMPLETED'
  | 'REJECTED';

export type ReturnResponsibility =
  | 'FACTORY_WARRANTY'
  | 'DEALER_RESPONSIBILITY'
  | 'SHARED'
  | 'UNDETERMINED';

export type ReturnChargeStatus =
  | 'NOT_REQUIRED'
  | 'DRAFT'
  | 'AWAITING_DEALER'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'INVOICED';

export type ReturnRequest = {
  id: string;
  number: string;
  productDesc: string;
  quantity: number | string;
  reason: ReturnReason | string;
  description?: string | null;
  approvalStatus: string;
  lifecycleState?: ReturnLifecycleState | string | null;
  salesOrderLineId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  responsibility?: ReturnResponsibility | string | null;
  chargeAmount?: number | string | null;
  factoryShareAmount?: number | string | null;
  chargeStatus?: ReturnChargeStatus | string | null;
  chargeSentAt?: string | null;
  chargeConfirmedAt?: string | null;
  chargeRejectedAt?: string | null;
  chargeRejectionNote?: string | null;
  chargeInvoices?: Array<{
    id: string;
    number: string;
    total?: number | string | null;
    status?: string | null;
    outstandingAmount?: number | string | null;
    dueDate?: string | null;
  }>;
  reworkCost?: {
    status?: string | null;
    estimatedTotal?: number | null;
    actualTotal?: number | null;
    factoryAbsorbed?: number | null;
  } | null;
  receivedQuantity?: number | string | null;
  receivedCondition?: string | null;
  receivedNotes?: string | null;
  inspectionNotes?: string | null;
  workOrders?: Array<{
    id: string;
    number: string;
    originType?: string;
    status?: string;
    releasedToFactoryAt?: string | null;
  }>;
  /** NONE | WAITING_RETURN | RETURNED | INSPECTING | RESOLVED */
  physicalStatus?: string | null;
  /** Dealer-visible note when approvalStatus is NEED_INFO. */
  needInfoNote?: string | null;
  /** Admin disposition — dealers only see resolved via lifecycle, never scrap labels. */
  inventoryFate?: ReturnInventoryFate | string | null;
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
  pieces?: ReturnPiece[];
  pieceSummary?: ReturnPieceSummary;
  reshipDeliveries?: Array<{
    id: string;
    number: string;
    status?: string;
    deliveryDate?: string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
  }>;
};

export type ReturnPieceDecision = 'REPAIR' | 'REPLACEMENT' | 'SCRAP_RECOVERY';
export type ReturnPieceState =
  | 'AWAITING_RECEIPT'
  | 'RECEIVED'
  | 'DECIDED'
  | 'IN_PROGRESS'
  | 'READY_TO_RETURN'
  | 'RETURNING'
  | 'RETURNED'
  | 'RECOVERED'
  | 'CANCELLED';

export type ReturnPieceSummary = {
  total: number;
  awaitingReceipt: number;
  received: number;
  decided: number;
  inProgress: number;
  readyToReturn: number;
  returning: number;
  returned: number;
  recovered: number;
  cancelled: number;
  repair: number;
  replacement: number;
  scrapRecovery: number;
  outboundEligible: number;
  outboundReady: number;
  outboundReturned: number;
  progressPercent: number;
};

export type ReturnPiece = {
  id: string;
  returnRequestId?: string;
  pieceNo: number;
  code: string;
  productDesc: string;
  state: ReturnPieceState | string;
  decision?: ReturnPieceDecision | string | null;
  outboundEligible?: boolean;
  receivedCondition?: string | null;
  conditionNotes?: string | null;
  inspectionNotes?: string | null;
  photoKeys?: string[];
  productionOrder?: {
    id: string;
    number: string;
    originType?: string;
    status?: string;
    progressPercent?: number;
    releasedToFactoryAt?: string | null;
  } | null;
  recoveryOrder?: {
    id: string;
    number: string;
    originType?: string;
    status?: string;
    progressPercent?: number;
    releasedToFactoryAt?: string | null;
  } | null;
  recoveryLines?: ReturnRecoveryLine[];
  specSnapshot?: {
    specifications?: string | null;
    factoryNotes?: string | null;
    orderDimensions?: Record<string, unknown> | null;
    catalogDimensions?: Record<string, unknown> | null;
  } | null;
  product?: { id?: string; imageUrl?: string | null; nameEn?: string | null; nameAr?: string | null } | null;
  salesOrder?: { id: string; number: string } | null;
};

export type ReturnRecoveryLine = {
  id: string;
  label: string;
  quantity: number | string;
  unit: string;
  outcome: 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED' | string;
  postedAt?: string | null;
  inventoryItemId?: string | null;
  destinationWarehouseId?: string | null;
  destinationLocationId?: string | null;
  notes?: string | null;
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
  salesOrderLineId?: string;
  productDesc: string;
  quantity: number;
  reason: ReturnReason;
  description?: string;
  reasonPhotoKey?: string;
  issuePhotoKey?: string;
  reasonPhotoKeys?: string[];
  issuePhotoKeys?: string[];
  items?: Array<{ salesOrderLineId?: string; quantity: number }>;
}) {
  return apiPost<ReturnRequest>('/returns', body);
}

export type ReturnResolution =
  | 'REPAIR'
  | 'REPLACEMENT'
  | 'CREDIT_NOTE'
  | 'REFUND'
  | 'REJECTED';

export async function resolveReturn(
  id: string,
  approvalStatus: 'APPROVED' | 'REJECTED' | 'NEED_INFO',
  extras?: { resolution?: Exclude<ReturnResolution, 'REJECTED'>; notes?: string; needInfoNote?: string },
) {
  return apiPatch<ReturnRequest>(`/returns/${encodeURIComponent(id)}/resolve`, {
    approvalStatus,
    ...extras,
  });
}

export async function needInfoReturn(id: string, needInfoNote: string) {
  return apiPatch<ReturnRequest>(`/returns/${encodeURIComponent(id)}/need-info`, {
    needInfoNote,
  });
}

export async function receiveReturn(
  id: string,
  body?: {
    pieceIds?: string[];
    receivedQuantity?: number;
    receivedCondition?: string;
    receivedLocationId?: string;
    warehouseId?: string;
    receivedNotes?: string;
    photoKeys?: string[];
  },
) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/receive`, body ?? {});
}

export async function markReturnSent(id: string) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/mark-sent`, {});
}

export async function scheduleReturnReship(id: string, body?: { address?: string; notes?: string }) {
  return apiPost<{
    delivery: { id: string; number: string };
    created: boolean;
  }>(`/returns/${encodeURIComponent(id)}/reship`, body ?? {});
}

export async function setReturnResponsibility(
  id: string,
  body: {
    responsibility: ReturnResponsibility;
    dealerAmount?: number;
    factoryAmount?: number;
    chargeAmount?: number;
  },
) {
  return apiPatch<ReturnRequest>(`/returns/${encodeURIComponent(id)}/responsibility`, body);
}

export async function sendReturnCharge(id: string) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/charge/send`, {});
}

export async function respondReturnCharge(id: string, body: { accept: boolean; note?: string }) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/charge/respond`, body);
}

export async function chargeReturn(id: string, body?: { amount?: number; description?: string }) {
  return apiPost<{
    invoice: { id: string; number: string };
    created: boolean;
  }>(`/returns/${encodeURIComponent(id)}/charge`, body ?? {});
}

export async function markReturnReady(id: string) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/ready-to-return`, {});
}

export async function cancelReturn(id: string) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/cancel`, {});
}

export async function cancelReturnPiece(id: string, pieceId: string) {
  return apiPost<ReturnRequest>(
    `/returns/${encodeURIComponent(id)}/pieces/${encodeURIComponent(pieceId)}/cancel`,
    {},
  );
}

export async function decideReturnPieces(
  id: string,
  items: Array<{
    pieceId: string;
    decision: ReturnPieceDecision;
    inspectionNotes?: string;
    workflowId?: string;
  }>,
) {
  return apiPost<ReturnRequest>(`/returns/${encodeURIComponent(id)}/decisions`, { items });
}

export async function recordReturnRecoveryLine(
  returnId: string,
  pieceId: string,
  body: {
    productionTaskId?: string;
    inventoryItemId?: string;
    label: string;
    quantity: number;
    unit?: string;
    outcome: 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED';
    destinationWarehouseId?: string;
    destinationLocationId?: string;
    unitCost?: number;
    notes?: string;
  },
) {
  return apiPost<ReturnRecoveryLine>(
    `/returns/${encodeURIComponent(returnId)}/pieces/${encodeURIComponent(pieceId)}/recovery-lines`,
    body,
  );
}

export async function postReturnRecoveryLine(returnId: string, lineId: string) {
  return apiPost<ReturnRecoveryLine>(
    `/returns/${encodeURIComponent(returnId)}/recovery-lines/${encodeURIComponent(lineId)}/post`,
    {},
  );
}

export async function updateReturnRecoveryLine(
  returnId: string,
  lineId: string,
  body: {
    inventoryItemId?: string | null;
    label?: string;
    quantity?: number;
    unit?: string;
    outcome?: 'RECOVER_TO_INVENTORY' | 'DISPOSE' | 'DAMAGED';
    destinationWarehouseId?: string;
    destinationLocationId?: string | null;
    notes?: string;
  },
) {
  return apiPatch<ReturnRecoveryLine>(
    `/returns/${encodeURIComponent(returnId)}/recovery-lines/${encodeURIComponent(lineId)}`,
    body,
  );
}

export async function deleteReturnRecoveryLine(returnId: string, lineId: string) {
  return apiDelete<{ ok: boolean; id: string }>(
    `/returns/${encodeURIComponent(returnId)}/recovery-lines/${encodeURIComponent(lineId)}`,
  );
}

