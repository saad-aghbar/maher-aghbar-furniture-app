import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type AiReviewPhase =
  | 'uploading'
  | 'reading'
  | 'extracting'
  | 'preparing'
  | 'needs_review'
  | 'ready'
  | 'failed'
  | 'approved'
  | 'manual';

export type AiReviewField = {
  fieldName: string;
  label: string;
  value: string;
  confidence: number | null;
  isMissing: boolean;
  correctable: boolean;
};

export type AiJobReview = {
  phase: AiReviewPhase;
  orderNumber: string;
  extractedModel: string | null;
  dealer: string | null;
  customer: string | null;
  fabric: string | null;
  notes: string | null;
  confidence: number | null;
  missingFields: string[];
  fields: AiReviewField[];
  originalDownloadPath: string | null;
  storageKey: string | null;
  requestNumber: string | null;
  canApprove: boolean;
  canReject: boolean;
  canRequestManual: boolean;
  canCorrect: boolean;
};

export type AiJob = {
  id: string;
  number: string;
  status: string;
  provider?: string | null;
  errorMessage?: string | null;
  storageKey?: string | null;
  originalText?: string | null;
  translatedText?: string | null;
  originalDownloadPath?: string | null;
  request?: { id: string; number: string } | null;
  fields?: Array<{
    fieldName: string;
    fieldValue?: string | null;
    reviewedValue?: string | null;
    confidence?: number | string | null;
    isMissing?: boolean;
  }>;
  review?: AiJobReview;
  createdAt?: string;
};

export type AiApproveResult = {
  jobId: string;
  request: { id: string; number: string; status: string };
  created: {
    draftRfq: boolean;
    invoice: boolean;
    inventoryMovement: boolean;
    salesOrder: boolean;
  };
};

export type AiExtractPreview = {
  productName?: string;
  quantity?: string;
  fabric?: string;
  fabricDescription?: string;
  notes?: string;
  width?: string;
  height?: string;
  depth?: string;
  material?: string;
  endCustomerName?: string;
  deliveryAddress?: string;
  projectName?: string;
};

export type ExtractPreviewResponse = {
  jobId: string;
  preview: AiExtractPreview;
};

export async function listAiJobs(params: PageParams = {}) {
  const qs = toSearchParams(params);
  return apiGet<PaginatedResponse<AiJob>>(`/ai-intake/jobs${qs}`);
}

export async function getAiJob(id: string) {
  return apiGet<AiJob>(`/ai-intake/jobs/${encodeURIComponent(id)}`);
}

export async function createAiJob(body: {
  sourceType: string;
  storageKey?: string;
  rawText?: string;
  customerId?: string;
}) {
  return apiPost<AiJob>('/ai-intake/jobs', body);
}

export async function approveAiJob(
  id: string,
  body: { customerId: string; fieldOverrides?: Record<string, string> },
) {
  return apiPost<AiApproveResult>(
    `/ai-intake/jobs/${encodeURIComponent(id)}/approve`,
    body,
  );
}

export async function rejectAiJob(id: string, reason?: string) {
  return apiPost<AiJob>(`/ai-intake/jobs/${encodeURIComponent(id)}/reject`, {
    reason,
  });
}

export async function correctAiJobFields(
  id: string,
  fieldOverrides: Record<string, string>,
) {
  return apiPost<AiJob>(`/ai-intake/jobs/${encodeURIComponent(id)}/correct`, {
    fieldOverrides,
  });
}

export async function requestAiManualHandling(id: string, notes?: string) {
  return apiPost<AiJob>(`/ai-intake/jobs/${encodeURIComponent(id)}/manual`, {
    notes,
  });
}

export async function extractPreview(body: {
  storageKey: string;
  mimeHint?: string;
  sourceType?: string;
  customerId?: string;
}): Promise<ExtractPreviewResponse> {
  return apiPost<ExtractPreviewResponse>('/ai-intake/extract-preview', body);
}

export async function linkAiJobToRequest(
  jobId: string,
  requestId: string,
): Promise<unknown> {
  return apiPost(`/ai-intake/jobs/${encodeURIComponent(jobId)}/link-request`, {
    requestId,
  });
}
