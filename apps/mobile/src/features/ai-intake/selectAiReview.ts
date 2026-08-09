import type { AiJob, AiJobReview, AiReviewPhase } from './api';

const PHASE_ORDER: AiReviewPhase[] = [
  'uploading',
  'reading',
  'extracting',
  'preparing',
  'needs_review',
  'ready',
  'failed',
  'manual',
  'approved',
];

/** Client-only upload phase before the job exists. */
export function localUploadingReview(): AiJobReview {
  return {
    phase: 'uploading',
    orderNumber: '—',
    extractedModel: null,
    dealer: null,
    customer: null,
    fabric: null,
    notes: null,
    confidence: null,
    missingFields: [],
    fields: [],
    originalDownloadPath: null,
    storageKey: null,
    requestNumber: null,
    canApprove: false,
    canReject: false,
    canRequestManual: false,
    canCorrect: false,
  };
}

export function selectAiJobReview(job: AiJob | null | undefined): AiJobReview | null {
  if (!job) return null;
  if (job.review) return job.review;
  // Fallback if API is older
  const status = job.status;
  let phase: AiReviewPhase = 'needs_review';
  if (status === 'UPLOADED') phase = 'uploading';
  else if (status === 'QUEUED') phase = 'reading';
  else if (status === 'PROCESSING') phase = 'extracting';
  else if (status === 'COMPLETED') phase = 'approved';
  else if (status === 'FAILED') {
    phase = job.errorMessage?.startsWith('MANUAL:') ? 'manual' : 'failed';
  }
  return {
    phase,
    orderNumber: job.request?.number ?? job.number,
    extractedModel: null,
    dealer: null,
    customer: null,
    fabric: null,
    notes: job.translatedText ?? job.originalText ?? null,
    confidence: null,
    missingFields: [],
    fields: [],
    originalDownloadPath: job.originalDownloadPath ?? null,
    storageKey: job.storageKey ?? null,
    requestNumber: job.request?.number ?? null,
    canApprove: status === 'NEEDS_REVIEW',
    canReject: status === 'NEEDS_REVIEW',
    canRequestManual: status === 'NEEDS_REVIEW',
    canCorrect: status === 'NEEDS_REVIEW',
  };
}

export function isProcessingPhase(phase: AiReviewPhase): boolean {
  return (
    phase === 'uploading' ||
    phase === 'reading' ||
    phase === 'extracting' ||
    phase === 'preparing'
  );
}

export function processingSteps(active: AiReviewPhase): Array<{
  key: AiReviewPhase;
  done: boolean;
  active: boolean;
}> {
  const pipeline: AiReviewPhase[] = ['uploading', 'reading', 'extracting', 'preparing'];
  const idx = pipeline.indexOf(active);
  return pipeline.map((key, i) => ({
    key,
    done: idx > i || (!isProcessingPhase(active) && true),
    active: key === active,
  }));
}

export function phaseSortRank(phase: AiReviewPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function confidenceLabel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  // Display as high/medium/low — never a fake live progress bar.
  if (value >= 0.85) return 'high';
  if (value >= 0.55) return 'medium';
  return 'low';
}
