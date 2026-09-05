import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { isApiError } from '@/api/errors';

export type CatalogPreviewSheetPhase =
  | 'closed'
  | 'loading'
  | 'error'
  | 'content'
  | 'applying';

export function catalogPreviewSheetPhase(input: {
  open: boolean;
  loading: boolean;
  hasPreview: boolean;
  error?: unknown;
  applying: boolean;
}): CatalogPreviewSheetPhase {
  if (!input.open) return 'closed';
  if (input.applying && input.hasPreview) return 'applying';
  if (input.hasPreview) return 'content';
  if (input.loading) return 'loading';
  return 'error';
}

export function isCatalogPreviewNetworkError(error: unknown): boolean {
  if (!isApiError(error)) return error instanceof Error && /network|timeout|offline/i.test(error.message);
  return (
    error.isOffline ||
    error.isTimeout ||
    error.code === 'NETWORK' ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT'
  );
}

export function invalidateAfterCatalogSeed(
  qc: QueryClient,
  input: { salesOrderId: string; productionOrderId: string; lineId?: string },
) {
  if (input.lineId) {
    qc.removeQueries({
      queryKey: queryKeys.salesOrders.catalogSeedPreview(input.salesOrderId, input.lineId),
    });
  }
  void qc.invalidateQueries({
    queryKey: queryKeys.production.planSetup(input.productionOrderId),
  });
  void qc.invalidateQueries({ queryKey: queryKeys.production.detail(input.productionOrderId) });
  void qc.invalidateQueries({ queryKey: queryKeys.production.all });
  void qc.invalidateQueries({ queryKey: queryKeys.salesOrders.detail(input.salesOrderId) });
  void qc.invalidateQueries({ queryKey: queryKeys.salesOrders.lists() });
}
