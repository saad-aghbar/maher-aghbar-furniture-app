import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { queryKeys } from '@/api/queryKeys';
import {
  catalogPreviewSheetPhase,
  invalidateAfterCatalogSeed,
  isCatalogPreviewNetworkError,
} from '../catalogTemplateSheet';

describe('catalog preview sheet phase', () => {
  it('exits loading on success', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: false,
        hasPreview: true,
        applying: false,
      }),
    ).toBe('content');
  });

  it('exits loading on error', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: false,
        hasPreview: false,
        error: new Error('fail'),
        applying: false,
      }),
    ).toBe('error');
  });

  it('stays loading only while fetching without data', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: true,
        hasPreview: false,
        applying: false,
      }),
    ).toBe('loading');
  });

  it('treats WORKFLOW_CHANGE_REQUIRED as content, not applying, once first mutate settles', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: false,
        hasPreview: true,
        applying: false,
      }),
    ).toBe('content');
  });

  it('marks applying only while the mutation is pending with preview data', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: false,
        hasPreview: true,
        applying: true,
      }),
    ).toBe('applying');
  });

  it('closes cleanly', () => {
    expect(
      catalogPreviewSheetPhase({
        open: false,
        loading: true,
        hasPreview: true,
        applying: true,
      }),
    ).toBe('closed');
  });

  it('never leaves a missing preview in loading once fetch stopped', () => {
    expect(
      catalogPreviewSheetPhase({
        open: true,
        loading: false,
        hasPreview: false,
        applying: false,
      }),
    ).toBe('error');
  });
});

describe('catalog preview error mapping', () => {
  it('maps network/timeout to the preview retry copy path', () => {
    expect(isCatalogPreviewNetworkError(new ApiError('offline', { status: 0, code: 'OFFLINE' }))).toBe(
      true,
    );
    expect(isCatalogPreviewNetworkError(new ApiError('timeout', { status: 0, code: 'TIMEOUT' }))).toBe(
      true,
    );
    expect(
      isCatalogPreviewNetworkError(new ApiError('net', { status: 0, code: 'NETWORK_ERROR' })),
    ).toBe(true);
  });

  it('leaves domain codes for toastMessageForError', () => {
    expect(
      isCatalogPreviewNetworkError(new ApiError('locked', { status: 400, code: 'SETUP_LOCKED' })),
    ).toBe(false);
    expect(
      isCatalogPreviewNetworkError(
        new ApiError('custom', { status: 400, code: 'CUSTOM_NO_TEMPLATE' }),
      ),
    ).toBe(false);
  });
});

describe('catalog seed invalidation', () => {
  it('removes the preview key and does not invalidate the productionSetup prefix', () => {
    const qc = {
      removeQueries: jest.fn(),
      invalidateQueries: jest.fn(),
    };
    invalidateAfterCatalogSeed(qc as unknown as QueryClient, {
      salesOrderId: 'so-1',
      productionOrderId: 'po-1',
      lineId: 'line-1',
    });
    expect(qc.removeQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.salesOrders.catalogSeedPreview('so-1', 'line-1'),
    });
    const keys = qc.invalidateQueries.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
    expect(keys).toContain(JSON.stringify(queryKeys.production.planSetup('po-1')));
    expect(keys).toContain(JSON.stringify(queryKeys.production.detail('po-1')));
    expect(keys).toContain(JSON.stringify(queryKeys.salesOrders.detail('so-1')));
    expect(keys).toContain(JSON.stringify(queryKeys.salesOrders.lists()));
    expect(keys.some((k) => k.includes('production-setup'))).toBe(false);
  });
});
