import { classifyDealerLifecycle, type DealerLifecycleTab } from '@maher/types';
import type { StatusChipKey } from './components/OrdersFilterChips';

export type OrdersStageKey = 'pending' | 'production' | 'ready' | 'shipped';

export type OrdersStageFocus = OrdersStageKey | 'all';

export type OrderClassifyResult =
  | OrdersStageKey
  | 'delivered'
  | 'drafts'
  | 'waiting'
  | 'needsInformation';

const RFQ_ONLY_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'READY_FOR_QUOTATION',
  'QUOTED',
]);

export type StageCountable = {
  status: string;
  deliveryDate?: string | null;
  deliveryStatus?: string | null;
  productionStarted?: boolean;
  /** Hub rows: rfq vs sales order */
  kind?: 'rfq' | 'order' | string | null;
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

function isRfqRow(item: StageCountable): boolean {
  if (item.kind === 'rfq') return true;
  if (item.kind === 'order') return false;
  // DRAFT is shared with SalesOrder — only treat as RFQ when explicitly tagged.
  return RFQ_ONLY_STATUSES.has(item.status.toUpperCase());
}

function lifecycleToChip(lifecycle: DealerLifecycleTab): OrderClassifyResult {
  switch (lifecycle) {
    case 'draft':
      return 'drafts';
    case 'waiting':
      return 'waiting';
    case 'needsInformation':
      return 'needsInformation';
    case 'pending':
      return 'pending';
    case 'inProduction':
      return 'production';
    case 'ready':
      return 'ready';
    case 'shipped':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    default:
      return 'pending';
  }
}

export function classifyOrderStage(item: StageCountable): OrderClassifyResult {
  if (isRfqRow(item)) {
    return lifecycleToChip(
      classifyDealerLifecycle({
        requestStatus: item.status,
        isDraft: item.status.toUpperCase() === 'DRAFT',
      }),
    );
  }
  return lifecycleToChip(
    classifyDealerLifecycle({
      salesOrderStatus: item.status,
      deliveryStatus: item.deliveryStatus,
      productionStarted: item.productionStarted,
      productionSetupRequired: item.status.toUpperCase() === 'DRAFT',
    }),
  );
}

export function countOrderStages(items: StageCountable[]): Record<OrdersStageKey, number> {
  const counts: Record<OrdersStageKey, number> = {
    pending: 0,
    production: 0,
    ready: 0,
    shipped: 0,
  };
  for (const item of items) {
    const stage = classifyOrderStage(item);
    if (
      stage === 'delivered' ||
      stage === 'drafts' ||
      stage === 'waiting' ||
      stage === 'needsInformation'
    ) {
      continue;
    }
    if (stage in counts) counts[stage as OrdersStageKey] += 1;
  }
  return counts;
}

export type DealerFocusCounts = Record<OrdersStageKey, number> & {
  drafts: number;
  waiting: number;
  needsInformation: number;
  delivered: number;
  total: number;
};

export function countDealerFocusBuckets(items: StageCountable[]): DealerFocusCounts {
  const counts: DealerFocusCounts = {
    drafts: 0,
    waiting: 0,
    needsInformation: 0,
    pending: 0,
    production: 0,
    ready: 0,
    shipped: 0,
    delivered: 0,
    total: items.length,
  };
  for (const item of items) {
    const stage = classifyOrderStage(item);
    if (stage in counts) counts[stage as keyof DealerFocusCounts] += 1;
  }
  return counts;
}

export function matchesStageFocus(item: StageCountable, focus: OrdersStageFocus): boolean {
  if (focus === 'all') return true;
  return classifyOrderStage(item) === focus;
}

export function filterByStageFocus<T extends StageCountable>(
  items: T[],
  focus: OrdersStageFocus,
): T[] {
  if (focus === 'all') return items;
  return items.filter((item) => matchesStageFocus(item, focus));
}

export function toggleStageFocus(
  current: OrdersStageFocus,
  next: OrdersStageKey,
): OrdersStageFocus {
  return current === next ? 'all' : next;
}

export function stageKeyToChip(stage: OrdersStageKey): StatusChipKey {
  return stage;
}

export function chipToStageFocus(chip: StatusChipKey): OrdersStageFocus {
  if (
    chip === 'pending' ||
    chip === 'production' ||
    chip === 'ready' ||
    chip === 'shipped'
  ) {
    return chip;
  }
  return 'all';
}

export function matchesStatusChip(item: StageCountable, chip: StatusChipKey): boolean {
  if (chip === 'all') return true;
  return classifyOrderStage(item) === chip;
}

export function chipToStageHighlight(chip: StatusChipKey): OrdersStageKey | null {
  return chipToStageFocus(chip) === 'all' ? null : (chip as OrdersStageKey);
}
