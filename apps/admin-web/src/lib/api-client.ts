import type { ApiError } from '@maher/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: ApiError,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      const json = (await res.json()) as { error?: ApiError } & ApiError;
      body = json.error ?? json;
    } catch {
      /* empty */
    }
    throw new ApiClientError(body?.message ?? `Request failed (${res.status})`, res.status, body);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      const json = (await res.json()) as { error?: ApiError } & ApiError;
      body = json.error ?? json;
    } catch {
      /* empty */
    }
    throw new ApiClientError(body?.message ?? `Upload failed (${res.status})`, res.status, body);
  }
  return res.json() as Promise<T>;
}

/** Download a remote URL into storage (server-side fetch). */
export async function apiUploadFromUrl<T>(
  path: string,
  body: { url: string; fileName?: string },
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export { API_URL };

/* ── Sales-order production setup (Piece 2) ─────────────────────────────── */

export type OrderSetupDims = {
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
};

export type OrderSetupMaterial = {
  id?: string;
  inventoryItemId?: string | null;
  sku?: string | null;
  displayName?: string | null;
  category?: string | null;
  unit: string;
  expectedQty: number;
  totalExpectedQty?: number;
  source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM' | string;
  needsReview?: boolean;
  notes?: string | null;
  requestedFabricLabel?: string | null;
  inventoryItem?: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
    category?: string | null;
    unit?: string | null;
    imageUrl?: string | null;
  } | null;
  availability?: {
    available: number;
    reserved: number;
    free: number;
    short: number;
    status: string;
  } | null;
};

export type OrderSetupLine = {
  id: string;
  salesOrderLineId: string;
  status: string;
  manufacturingName: string | null;
  manufacturingComplexity?: string | null;
  quantity: number;
  catalogDimensions?: OrderSetupDims | null;
  orderDimensions?: OrderSetupDims | null;
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  requestedFabricLabel?: string | null;
  factoryNotes?: string | null;
  packagingExpectation?: {
    pieceLabels?: Array<{
      label?: string;
      nameEn?: string;
      nameAr?: string;
      nameHe?: string;
    }>;
    expectedPieceCount?: number | null;
  } | null;
  referenceDocumentIds?: string[];
  materialsReviewedAt?: string | null;
  workflowId?: string | null;
  workflowConfirmedAt?: string | null;
  workflow?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
    stagePath?: Array<{ stageCode: string; nameEn: string; nameAr?: string | null }>;
  } | null;
  product?: {
    id: string;
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    imageUrl?: string | null;
  } | null;
  description?: string | null;
  materials: OrderSetupMaterial[];
  materialStatus?: string;
  sectionProgress?: {
    spec: boolean;
    materials: boolean;
    workflow: boolean;
    packaging: boolean;
    review: boolean;
  };
  issues?: Array<{ code: string; message: string; section?: string }>;
};

export type OrderProductionSetup = {
  id: string;
  salesOrderId: string;
  status: string;
  releasedAt?: string | null;
  releasedById?: string | null;
  salesOrder: {
    id: string;
    number: string;
    status: string;
    projectName?: string | null;
    customerId?: string;
    customer?: {
      id: string;
      nameEn?: string | null;
      nameAr?: string | null;
      code?: string | null;
    } | null;
  };
  progress: {
    totalLines: number;
    readyLines: number;
    needsReviewLines: number;
    percent: number;
    headerStatus: string;
    steps: Array<{ key: string; done: boolean }>;
  };
  validation: {
    ok: boolean;
    issues: Array<{ code: string; message: string; lineId?: string; section?: string }>;
  };
  materialReadiness: {
    status: string;
    anyShortage: boolean;
    anyNeedsSelection: boolean;
    anyNeedsReview: boolean;
  };
  lines: OrderSetupLine[];
};

export type OrderSetupReleasePreview = {
  salesOrderId: string;
  headerStatus: string;
  canRelease: boolean;
  validation: OrderProductionSetup['validation'];
  materialReadiness: OrderProductionSetup['materialReadiness'];
  lines: Array<{
    salesOrderLineId: string;
    manufacturingName: string | null;
    quantity: number;
    manufacturingComplexity?: string | null;
    workflow?: OrderSetupLine['workflow'];
    packagingExpectation?: OrderSetupLine['packagingExpectation'];
    materialStatus?: string;
    materials: Array<{
      sku?: string | null;
      displayName?: string | null;
      expectedQty: number;
      totalExpectedQty?: number;
      availability?: OrderSetupMaterial['availability'];
    }>;
  }>;
  note?: string;
};

export type PatchOrderSetupLineBody = {
  manufacturingName?: string;
  factoryNotes?: string | null;
  orderDimensions?: OrderSetupDims;
  packagingExpectation?: {
    pieceLabels?: Array<{
      label?: string;
      nameEn?: string;
      nameAr?: string;
      nameHe?: string;
    }>;
    expectedPieceCount?: number | null;
  };
  workflowId?: string | null;
  confirmWorkflow?: boolean;
  materialsReviewed?: boolean;
  referenceDocumentIds?: string[];
};

export type PutOrderSetupMaterialsBody = {
  materials: Array<{
    inventoryItemId?: string | null;
    sku?: string | null;
    displayName?: string | null;
    category?: string | null;
    unit?: string;
    expectedQty: number;
    source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';
    needsReview?: boolean;
    notes?: string | null;
    requestedFabricLabel?: string | null;
  }>;
};

function orderSetupBase(salesOrderId: string) {
  return `/api/v1/sales-orders/${salesOrderId}/production-setup`;
}

export function fetchOrderProductionSetup(salesOrderId: string) {
  return apiFetch<OrderProductionSetup>(orderSetupBase(salesOrderId));
}

export function fetchOrderSetupReleasePreview(salesOrderId: string) {
  return apiFetch<OrderSetupReleasePreview>(`${orderSetupBase(salesOrderId)}/release-preview`);
}

export function patchOrderSetupLine(
  salesOrderId: string,
  lineId: string,
  body: PatchOrderSetupLineBody,
) {
  return apiFetch<OrderProductionSetup>(`${orderSetupBase(salesOrderId)}/lines/${lineId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function putOrderSetupMaterials(
  salesOrderId: string,
  lineId: string,
  body: PutOrderSetupMaterialsBody,
) {
  return apiFetch<OrderProductionSetup>(
    `${orderSetupBase(salesOrderId)}/lines/${lineId}/materials`,
    { method: 'PUT', body: JSON.stringify(body) },
  );
}

export function seedOrderSetupLineFromCatalog(salesOrderId: string, lineId: string) {
  return apiFetch<OrderProductionSetup>(
    `${orderSetupBase(salesOrderId)}/lines/${lineId}/seed-from-catalog`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function markOrderSetupReady(salesOrderId: string) {
  return apiFetch<OrderProductionSetup>(`${orderSetupBase(salesOrderId)}/mark-ready`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function releaseOrderProductionSetup(salesOrderId: string) {
  return apiFetch<{
    id: string;
    status: string;
    workerAssignmentRequired?: boolean;
    schedulingSkipped?: boolean;
    productionOrders?: Array<{ id: string; number: string; status: string }>;
  }>(`${orderSetupBase(salesOrderId)}/release`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
