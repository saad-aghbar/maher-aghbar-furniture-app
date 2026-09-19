import {
  classifyDealerLifecycle,
  dealerLifecycleLabelKey,
  isConfirmReceiptVisible,
  mapConfirmReceiptErrorCode,
  type DealerLifecycleTab,
} from '@maher/types';

export {
  classifyDealerLifecycle,
  dealerLifecycleLabelKey,
  isConfirmReceiptVisible,
  mapConfirmReceiptErrorCode,
};
export type { DealerLifecycleTab };

/** Customer-portal order hub tabs — aligned with classifyDealerLifecycle intake chips. */
export type OrderLifecycleTab =
  | 'all'
  | 'draft'
  | 'waiting'
  | 'needsInformation'
  | 'inProduction'
  | 'ready'
  | 'shipped'
  | 'delivered';

export const ORDER_LIFECYCLE_TABS: OrderLifecycleTab[] = [
  'all',
  'draft',
  'waiting',
  'needsInformation',
  'inProduction',
  'ready',
  'shipped',
  'delivered',
];

export type ProductionOrderSnippet = {
  status?: string;
  currentStageCode?: string | null;
  progressPercent?: number | null;
};

export type LifecycleClassifiable = {
  kind: 'rfq' | 'sales_order';
  status: string;
  deliveryStatus?: string | null;
  productionOrders?: ProductionOrderSnippet[];
};

/** Map own-deliveries customerStatus to deliveryStatus for lifecycle classification. */
export function deliveryStatusFromCustomerStatus(
  customerStatus?: string | null,
): string | null {
  if (!customerStatus) return null;
  const s = customerStatus.toUpperCase();
  if (s === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (s === 'DELIVERED') return 'DELIVERED';
  if (s === 'READY_FOR_DELIVERY') return 'READY';
  if (s === 'PLANNED' || s === 'CONFIRMED_ON_TRACK') return 'PLANNED';
  return null;
}

export function hasStartedProduction(row: { productionOrders?: ProductionOrderSnippet[] }) {
  return (row.productionOrders ?? []).some((po) => {
    const status = (po.status ?? '').toUpperCase();
    if (!status || status === 'CANCELLED' || status === 'VOID') return false;
    // Piece 2 release creates PLANNED / WAITING_FOR_MATERIALS POs — dealers see In production
    return true;
  });
}

export function classifyHubLifecycle(row: LifecycleClassifiable): DealerLifecycleTab {
  if (row.kind === 'rfq') {
    return classifyDealerLifecycle({
      requestStatus: row.status,
      isDraft: row.status.toUpperCase() === 'DRAFT',
    });
  }
  return classifyDealerLifecycle({
    salesOrderStatus: row.status,
    deliveryStatus: row.deliveryStatus,
    productionStarted: hasStartedProduction(row),
    productionSetupRequired: row.status.toUpperCase() === 'DRAFT',
  });
}

export function matchesLifecycleTab(row: LifecycleClassifiable, tab: OrderLifecycleTab): boolean {
  if (tab === 'all') return true;
  return classifyHubLifecycle(row) === tab;
}

export function lifecycleEmptyMessageKey(
  tab: OrderLifecycleTab,
  hasSearch: boolean,
): string {
  if (hasSearch) return 'noSearchResults';
  switch (tab) {
    case 'all':
      return 'noOrders';
    case 'draft':
      return 'noDrafts';
    case 'waiting':
      return 'noWaiting';
    case 'needsInformation':
      return 'noNeedsInformation';
    case 'inProduction':
      return 'noInProduction';
    case 'ready':
      return 'noReady';
    case 'shipped':
      return 'noShipped';
    case 'delivered':
      return 'noDelivered';
    default:
      return 'noOrders';
  }
}

export type OrderSearchable = {
  number?: string | null;
  title?: string | null;
  externalOrderNumber?: string | null;
  endCustomerName?: string | null;
};

export function matchOrderSearch(item: OrderSearchable, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  const hay: string[] = [];
  for (const value of [
    item.number,
    item.title,
    item.externalOrderNumber,
    item.endCustomerName,
  ]) {
    const v = value?.trim();
    if (v) hay.push(v);
  }

  return hay.some((h) => h.toLowerCase().includes(needle));
}

export function countLifecycleTabs(
  rows: LifecycleClassifiable[],
): Record<OrderLifecycleTab, number> {
  const counts: Record<OrderLifecycleTab, number> = {
    all: rows.length,
    draft: 0,
    waiting: 0,
    needsInformation: 0,
    inProduction: 0,
    ready: 0,
    shipped: 0,
    delivered: 0,
  };
  for (const row of rows) {
    const tab = classifyHubLifecycle(row);
    if (tab === 'draft') counts.draft += 1;
    else if (tab === 'waiting') counts.waiting += 1;
    else if (tab === 'needsInformation') counts.needsInformation += 1;
    else if (tab === 'inProduction') counts.inProduction += 1;
    else if (tab === 'ready') counts.ready += 1;
    else if (tab === 'shipped') counts.shipped += 1;
    else if (tab === 'delivered') counts.delivered += 1;
  }
  return counts;
}
