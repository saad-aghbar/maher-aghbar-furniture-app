import { AIJobStatus } from '@maher/database';
import { ITEMS_FIELD } from './ai-intake.mapper';

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

const CORRECTABLE = new Set([
  'product',
  'quantity',
  'fabric',
  'material',
  'notes',
  'customer',
  'dealer',
  'endCustomerName',
  'deliveryDate',
  'deliveryAddress',
  'projectName',
  'width',
  'height',
  'depth',
]);

const CRITICAL_MISSING = new Set(['product', 'quantity']);

export function mapJobStatusToPhase(input: {
  status: AIJobStatus | string;
  errorMessage?: string | null;
  missingCritical: boolean;
}): AiReviewPhase {
  const status = String(input.status);
  if (status === AIJobStatus.COMPLETED || status === 'COMPLETED') return 'approved';
  if (status === AIJobStatus.FAILED || status === 'FAILED') {
    if (input.errorMessage?.startsWith('MANUAL:')) return 'manual';
    return 'failed';
  }
  if (status === AIJobStatus.UPLOADED || status === 'UPLOADED') return 'uploading';
  if (status === AIJobStatus.QUEUED || status === 'QUEUED') return 'reading';
  if (status === AIJobStatus.PROCESSING || status === 'PROCESSING') return 'extracting';
  if (status === AIJobStatus.NEEDS_REVIEW || status === 'NEEDS_REVIEW') {
    return input.missingCritical ? 'needs_review' : 'ready';
  }
  return 'needs_review';
}

export function buildReviewFromJob(job: {
  id: string;
  number: string;
  status: AIJobStatus | string;
  storageKey?: string | null;
  originalText?: string | null;
  translatedText?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
  request?: { id: string; number: string } | null;
  fields?: Array<{
    fieldName: string;
    fieldValue?: string | null;
    reviewedValue?: string | null;
    confidence?: unknown;
    isMissing?: boolean;
  }>;
  originalDownloadPath?: string | null;
}): {
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
} {
  const rawFields = job.fields ?? [];
  const fields: AiReviewField[] = rawFields
    .filter((f) => f.fieldName !== ITEMS_FIELD)
    .map((f) => {
      const confidence =
        f.confidence == null || f.confidence === ''
          ? null
          : Number(f.confidence);
      const value = String(f.reviewedValue ?? f.fieldValue ?? '');
      const isMissing = Boolean(f.isMissing) || !value.trim();
      return {
        fieldName: f.fieldName,
        label: f.fieldName,
        value,
        confidence: Number.isFinite(confidence) ? confidence : null,
        isMissing,
        correctable: CORRECTABLE.has(f.fieldName),
      };
    });

  const get = (name: string) =>
    fields.find((f) => f.fieldName === name)?.value?.trim() || null;

  const missingFields = fields.filter((f) => f.isMissing).map((f) => f.fieldName);
  const missingCritical = [...CRITICAL_MISSING].some((name) => {
    const field = fields.find((f) => f.fieldName === name);
    return !field || field.isMissing || !field.value.trim();
  });

  const confidences = fields
    .map((f) => f.confidence)
    .filter((c): c is number => c != null && Number.isFinite(c));
  const confidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;

  const phase = mapJobStatusToPhase({
    status: job.status,
    errorMessage: job.errorMessage,
    missingCritical,
  });

  const reviewable = phase === 'needs_review' || phase === 'ready';

  return {
    phase,
    orderNumber: job.request?.number ?? job.number,
    extractedModel: get('product'),
    dealer: get('dealer') ?? get('customer'),
    customer: get('endCustomerName') ?? get('customer'),
    fabric: get('fabric'),
    notes: get('notes') ?? job.translatedText ?? job.originalText ?? null,
    confidence,
    missingFields,
    fields,
    originalDownloadPath: job.originalDownloadPath ?? null,
    storageKey: job.storageKey ?? null,
    requestNumber: job.request?.number ?? null,
    canApprove: reviewable && !missingCritical,
    canReject: reviewable || phase === 'manual',
    canRequestManual: reviewable,
    canCorrect: reviewable,
  };
}

/** Backend gate before approve — AI never auto-approves; human must supply customer + model. */
export function validateApprovePayload(input: {
  customerId?: string;
  fieldOverrides?: Record<string, string>;
  fields: Array<{ fieldName: string; fieldValue?: string | null; reviewedValue?: string | null }>;
}): { ok: true } | { ok: false; code: string; message: string } {
  if (!input.customerId?.trim()) {
    return {
      ok: false,
      code: 'CUSTOMER_REQUIRED',
      message: 'Select a dealer/customer before approving the draft.',
    };
  }
  const map: Record<string, string> = {};
  for (const f of input.fields) {
    map[f.fieldName] = String(f.reviewedValue ?? f.fieldValue ?? '');
  }
  Object.assign(map, input.fieldOverrides ?? {});
  if (!map.product?.trim()) {
    return {
      ok: false,
      code: 'INVALID_EXTRACTION',
      message: 'Product/model is required. Correct the field before approving.',
    };
  }
  const qty = Number(String(map.quantity ?? '1').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      ok: false,
      code: 'INVALID_EXTRACTION',
      message: 'Quantity must be a positive number.',
    };
  }
  return { ok: true };
}
