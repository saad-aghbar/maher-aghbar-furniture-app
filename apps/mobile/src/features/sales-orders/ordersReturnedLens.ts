import type { SalesOrderListFilters } from './api';
import type { OrderTypeFocus } from './components/OrderTypeLensBar';

/**
 * Admin Sales Orders desk filters.
 * Returned is no longer `returned=true` (original SOs with a ReturnRequest).
 * The Returned cell loads `/sales-orders/return-work` instead.
 */
export function buildAdminOrderListFilters(opts: {
  sortBy?: SalesOrderListFilters['sortBy'];
  sortDir?: SalesOrderListFilters['sortDir'];
  q?: string;
  journeyBucket?: SalesOrderListFilters['journeyBucket'] | 'all' | null;
  orderType: OrderTypeFocus;
}): SalesOrderListFilters {
  const journey =
    opts.journeyBucket && opts.journeyBucket !== 'all'
      ? (opts.journeyBucket as SalesOrderListFilters['journeyBucket'])
      : undefined;
  const orderType =
    opts.orderType !== 'all' && opts.orderType !== 'returned'
      ? (opts.orderType.toUpperCase() as 'STANDARD' | 'MODIFIED' | 'CUSTOM')
      : undefined;
  return {
    sortBy: opts.sortBy,
    sortDir: opts.sortDir,
    ...(opts.q ? { q: opts.q } : {}),
    ...(journey ? { journeyBucket: journey } : {}),
    ...(orderType ? { orderType } : {}),
  };
}

export function isReturnedOrderFocus(focus: OrderTypeFocus): boolean {
  return focus === 'returned';
}

export function orderProgressChipFlags(order: {
  manufacturingKind?: 'standard' | 'modified' | 'custom' | null;
  hasReturn?: boolean;
  originKind?: 'RETURN_WORK' | 'REPLACEMENT' | null;
  kind?: 'order' | 'rfq' | 'returnWork';
}): {
  manufacturingKind: 'standard' | 'modified' | 'custom' | null;
  returned: boolean;
  originKind: 'RETURN_WORK' | 'REPLACEMENT' | null;
} {
  return {
    manufacturingKind: order.manufacturingKind ?? null,
    returned: Boolean(order.hasReturn) && order.kind !== 'returnWork',
    originKind: order.originKind ?? null,
  };
}
