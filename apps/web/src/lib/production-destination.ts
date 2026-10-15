const FLOOR_STATUSES = new Set([
  'IN_PROGRESS',
  'IN_PRODUCTION',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
  'PAUSED',
  'BLOCKED',
]);

const RETURN_ORIGINS = new Set(['RETURN_WORK', 'REPLACEMENT']);

export type ProductionDestinationInput = {
  id: string;
  salesOrderId?: string | null;
  salesOrderLineId?: string | null;
  releasedToFactoryAt?: string | null;
  actualStartDate?: string | null;
  status?: string | null;
  originType?: string | null;
};

/** Released or already-on-floor work opens the production order. Unreleased work opens that line's sales-order plan. */
export function isProductionOnFloor(item: Pick<ProductionDestinationInput, 'releasedToFactoryAt' | 'actualStartDate' | 'status'>): boolean {
  if (item.releasedToFactoryAt || item.actualStartDate) return true;
  return FLOOR_STATUSES.has(String(item.status ?? '').toUpperCase());
}

export function adminProductionDestination(item: ProductionDestinationInput): string {
  if (!isProductionOnFloor(item) && item.salesOrderId) {
    return salesOrderPlanHref(item.salesOrderId, item.salesOrderLineId);
  }
  return `/admin/production/${item.id}`;
}

export function salesOrderPlanHref(salesOrderId: string, salesOrderLineId?: string | null): string {
  const line = salesOrderLineId ? `?lineId=${encodeURIComponent(salesOrderLineId)}` : '';
  return `/admin/sales-orders/${salesOrderId}/production-plan${line}`;
}

/** Sales-origin plans open the parent line. Other origins stay on the production-order plan. */
export function productionPlanHref(item: ProductionDestinationInput): string | null {
  if (!item.salesOrderId) return null;
  return salesOrderPlanHref(item.salesOrderId, item.salesOrderLineId);
}

/** Legacy setup links follow the same release rule as the phone. */
export function productionSetupHref(item: ProductionDestinationInput): string {
  if (!isProductionOnFloor(item) && item.salesOrderId) {
    return salesOrderPlanHref(item.salesOrderId, item.salesOrderLineId);
  }
  if (!isProductionOnFloor(item) && RETURN_ORIGINS.has(String(item.originType ?? ''))) {
    return `/admin/production/${item.id}/plan`;
  }
  return `/admin/production/${item.id}`;
}
