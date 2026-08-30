import {
  aiIntakeListBadgeStatus,
  confidenceLabel,
  isProcessingPhase,
  localUploadingReview,
  processingSteps,
  selectAiJobReview,
} from '../selectAiReview';
import type { AiJob } from '../api';

describe('selectAiReview', () => {
  it('uses API review payload when present', () => {
    const job = {
      id: '1',
      number: 'AI-1',
      status: 'NEEDS_REVIEW',
      review: {
        ...localUploadingReview(),
        phase: 'ready' as const,
        extractedModel: 'Sofa',
        canApprove: true,
      },
    } satisfies AiJob;
    expect(selectAiJobReview(job)?.phase).toBe('ready');
    expect(selectAiJobReview(job)?.extractedModel).toBe('Sofa');
  });

  it('maps failed + MANUAL prefix to manual phase', () => {
    const job: AiJob = {
      id: '2',
      number: 'AI-2',
      status: 'FAILED',
      errorMessage: 'MANUAL: needs sales',
    };
    expect(selectAiJobReview(job)?.phase).toBe('manual');
  });

  it('builds processing steps without percentages', () => {
    const steps = processingSteps('extracting');
    expect(steps.map((s) => s.key)).toEqual([
      'uploading',
      'reading',
      'extracting',
      'preparing',
    ]);
    expect(steps.find((s) => s.key === 'extracting')?.active).toBe(true);
    expect(steps.find((s) => s.key === 'reading')?.done).toBe(true);
    expect(JSON.stringify(steps)).not.toMatch(/%|percent/i);
  });

  it('classifies processing vs terminal phases', () => {
    expect(isProcessingPhase('uploading')).toBe(true);
    expect(isProcessingPhase('ready')).toBe(false);
    expect(isProcessingPhase('approved')).toBe(false);
  });

  it('maps confidence to bands not fake live progress', () => {
    expect(confidenceLabel(0.9)).toBe('high');
    expect(confidenceLabel(0.6)).toBe('medium');
    expect(confidenceLabel(0.2)).toBe('low');
    expect(confidenceLabel(null)).toBeNull();
  });
});

describe('aiIntakeListBadgeStatus', () => {
  it('warms approved COMPLETED to quiet wood-cream chrome, not mint success', () => {
    expect(aiIntakeListBadgeStatus('COMPLETED', 'approved')).toBe('DRAFT');
    expect(aiIntakeListBadgeStatus('COMPLETED')).toBe('DRAFT');
  });

  it('leaves other intake list statuses on their existing StatusBadge keys', () => {
    expect(aiIntakeListBadgeStatus('NEEDS_REVIEW', 'ready')).toBe('NEEDS_REVIEW');
    expect(aiIntakeListBadgeStatus('NEEDS_REVIEW', 'needs_review')).toBe('NEEDS_REVIEW');
    expect(aiIntakeListBadgeStatus('PROCESSING', 'extracting')).toBe('PROCESSING');
    expect(aiIntakeListBadgeStatus('QUEUED', 'reading')).toBe('QUEUED');
    expect(aiIntakeListBadgeStatus('FAILED', 'failed')).toBe('FAILED');
    expect(aiIntakeListBadgeStatus('FAILED', 'manual')).toBe('FAILED');
  });
});
