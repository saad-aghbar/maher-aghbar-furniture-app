import type { ReturnWorkOrderRow } from '@/api/modules/sales-orders';
import type { AdminOrderCardModel } from './selectOrderCard';

export function selectReturnCaseCard(
  row: ReturnWorkOrderRow,
  t: (key: string, vars?: Record<string, string | number>) => string,
): AdminOrderCardModel {
  const dealerName =
    row.customer?.nameEn ||
    row.customer?.name ||
    row.customer?.nameAr ||
    row.customer?.code ||
    '—';
  const summary = row.pieceSummary;
  const counts = [
    summary?.repair ? t('mobile.returns.pieceCount.repair', { count: summary.repair }) : null,
    summary?.replacement
      ? t('mobile.returns.pieceCount.replace', { count: summary.replacement })
      : null,
    summary?.scrapRecovery
      ? t('mobile.returns.pieceCount.scrap', { count: summary.scrapRecovery })
      : null,
  ].filter(Boolean);
  return {
    id: row.id,
    number: row.number,
    status: row.lifecycleState || row.status || 'REQUESTED',
    priority: 'NORMAL',
    title: row.originalOrder?.number
      ? `${row.number} · ${row.originalOrder.number}`
      : row.number,
    imageUrl: null,
    dealerId: row.customer?.id ?? '',
    dealerName,
    progressPercent: summary?.progressPercent ?? row.progressPercent ?? null,
    progressLabel: counts.length ? counts.join(' · ') : row.productDescription ?? null,
    deliveryDate: null,
    arrivedAt: row.createdAt ?? null,
    externalOrderNumber: row.originalOrder?.number ?? null,
    productionOrderNumbers: [],
    manufacturingCost: null,
    sellerPrice: null,
    profit: null,
    quantity: row.quantity != null ? Number(row.quantity) : summary?.total ?? null,
    kind: 'returnWork',
    hasReturn: true,
    returnSummary: {
      id: row.id,
      number: row.number,
      lifecycleState: row.lifecycleState ?? null,
    },
    originKind: undefined,
    originalOrderNumber: row.originalOrder?.number ?? null,
    primaryProductionOrderId: null,
    plannedStartDate: null,
    releasedToFactoryAt: null,
  };
}

export function returnCaseHref(row: { id: string }): string {
  return `/(app)/(admin)/returns/${row.id}`;
}

/** @deprecated Use selectReturnCaseCard — Orders Returned is now one row per Return Case. */
export const selectReturnWorkCard = selectReturnCaseCard;
/** @deprecated Use returnCaseHref */
export const returnWorkHref = returnCaseHref;
