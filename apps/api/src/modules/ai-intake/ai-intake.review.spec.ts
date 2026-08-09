import { AIJobStatus } from '@maher/database';
import {
  buildReviewFromJob,
  mapJobStatusToPhase,
  validateApprovePayload,
} from './ai-intake.review';

describe('ai-intake.review', () => {
  describe('mapJobStatusToPhase', () => {
    it('maps processing pipeline without percentages', () => {
      expect(mapJobStatusToPhase({ status: 'UPLOADED', missingCritical: false })).toBe(
        'uploading',
      );
      expect(mapJobStatusToPhase({ status: 'QUEUED', missingCritical: false })).toBe('reading');
      expect(mapJobStatusToPhase({ status: 'PROCESSING', missingCritical: false })).toBe(
        'extracting',
      );
    });

    it('splits needs_review vs ready by missing critical fields', () => {
      expect(
        mapJobStatusToPhase({ status: AIJobStatus.NEEDS_REVIEW, missingCritical: true }),
      ).toBe('needs_review');
      expect(
        mapJobStatusToPhase({ status: AIJobStatus.NEEDS_REVIEW, missingCritical: false }),
      ).toBe('ready');
    });

    it('maps approved, failed, and manual handling', () => {
      expect(mapJobStatusToPhase({ status: 'COMPLETED', missingCritical: false })).toBe(
        'approved',
      );
      expect(mapJobStatusToPhase({ status: 'FAILED', missingCritical: false })).toBe('failed');
      expect(
        mapJobStatusToPhase({
          status: 'FAILED',
          errorMessage: 'MANUAL: needs sales review',
          missingCritical: false,
        }),
      ).toBe('manual');
    });
  });

  describe('validateApprovePayload', () => {
    it('rejects missing customer (AI never auto-approves)', () => {
      const result = validateApprovePayload({
        fields: [{ fieldName: 'product', fieldValue: 'Sofa' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('CUSTOMER_REQUIRED');
    });

    it('rejects invalid extraction without product', () => {
      const result = validateApprovePayload({
        customerId: 'cust-1',
        fields: [{ fieldName: 'quantity', fieldValue: '2' }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_EXTRACTION');
    });

    it('rejects invalid quantity', () => {
      const result = validateApprovePayload({
        customerId: 'cust-1',
        fieldOverrides: { product: 'Sofa', quantity: '0' },
        fields: [],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_EXTRACTION');
    });

    it('accepts valid human-corrected payload', () => {
      const result = validateApprovePayload({
        customerId: 'cust-1',
        fieldOverrides: { product: 'Dining Table', quantity: '4' },
        fields: [{ fieldName: 'product', fieldValue: null, isMissing: true } as never],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('buildReviewFromJob', () => {
    it('exposes original document path and structured review fields', () => {
      const review = buildReviewFromJob({
        id: 'job-1',
        number: 'AI-1',
        status: AIJobStatus.NEEDS_REVIEW,
        storageKey: 'uploads/a.png',
        originalDownloadPath: '/api/v1/uploads/download?token=x',
        fields: [
          { fieldName: 'product', fieldValue: 'Sofa', confidence: 0.9, isMissing: false },
          { fieldName: 'fabric', fieldValue: null, confidence: 0.2, isMissing: true },
          { fieldName: 'quantity', fieldValue: '2', confidence: 0.95, isMissing: false },
          { fieldName: 'customer', fieldValue: 'Cedar', confidence: 0.7, isMissing: false },
        ],
      });
      expect(review.phase).toBe('ready');
      expect(review.extractedModel).toBe('Sofa');
      expect(review.fabric).toBeNull();
      expect(review.missingFields).toContain('fabric');
      expect(review.originalDownloadPath).toContain('token=');
      expect(review.canApprove).toBe(true);
      expect(review.confidence).toBeGreaterThan(0.5);
    });

    it('marks needs_review when product missing', () => {
      const review = buildReviewFromJob({
        id: 'job-2',
        number: 'AI-2',
        status: AIJobStatus.NEEDS_REVIEW,
        fields: [{ fieldName: 'product', fieldValue: '', isMissing: true }],
      });
      expect(review.phase).toBe('needs_review');
      expect(review.canApprove).toBe(false);
    });
  });
});
