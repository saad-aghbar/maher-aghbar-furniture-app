import type { StatusChipKey } from './components/OrdersFilterChips';

export type OrdersStageKey = 'pending' | 'production' | 'ready';

export type OrdersStageFocus = OrdersStageKey | 'all';

const PENDING = new Set([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
  'ON_HOLD',
  'READY_FOR_PRODUCTION',
  'PENDING',
  'PENDING_APPROVAL',
  'SUBMITTED',
  'OPEN',
]);

const PRODUCTION = new Set(['IN_PRODUCTION', 'IN_PROGRESS', 'QUALITY_CHECK']);

const READY = new Set(['READY_FOR_DELIVERY', 'READY', 'OUT_FOR_DELIVERY']);

const DONE = new Set(['DELIVERED', 'COMPLETED', 'INVOICED', 'CANCELLED', 'VOID']);

export type StageCountable = {
  status: string;
  deliveryDate?: string | null;
};

export function classifyOrderStage(item: StageCountable): OrdersStageKey | 'delivered' {
  const status = item.status.toUpperCase();
  if (READY.has(status)) return 'ready';
  if (PRODUCTION.has(status)) return 'production';
  if (PENDING.has(status)) return 'pending';
  if (DONE.has(status)) return 'delivered';
  return 'pending';
}

export function countOrderStages(items: StageCountable[]): Record<OrdersStageKey, number> {
  const counts: Record<OrdersStageKey, number> = {
    pending: 0,
    production: 0,
    ready: 0,
  };
  for (const item of items) {
    const stage = classifyOrderStage(item);
    if (stage === 'delivered') continue;
    counts[stage] += 1;
  }
  return counts;
}

/** Dealer focus rail buckets — includes delivered + total. */
export type DealerFocusCounts = Record<OrdersStageKey, number> & {
  delivered: number;
  total: number;
};

export function countDealerFocusBuckets(items: StageCountable[]): DealerFocusCounts {
  const counts: DealerFocusCounts = {
    pending: 0,
    production: 0,
    ready: 0,
    delivered: 0,
    total: items.length,
  };
  for (const item of items) {
    const stage = classifyOrderStage(item);
    counts[stage] += 1;
  }
  return counts;
}

/** Client-side lane/spine filter — keeps full counts + avoids refetch thrash. */
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

/** Toggle: tap active stage again → all. */
export function toggleStageFocus(
  current: OrdersStageFocus,
  next: OrdersStageKey,
): OrdersStageFocus {
  return current === next ? 'all' : next;
}

/** Map spine tap → status filter (same vocabulary as ON THE LINE). */
export function stageKeyToChip(stage: OrdersStageKey): StatusChipKey {
  return stage;
}

/** Map status filter → spine focus (delivered clears the lane). */
export function chipToStageFocus(chip: StatusChipKey): OrdersStageFocus {
  if (chip === 'pending' || chip === 'production' || chip === 'ready') {
    return chip;
  }
  return 'all';
}

/** Same classification as ON THE LINE — filter status and spine stay aligned. */
export function matchesStatusChip(item: StageCountable, chip: StatusChipKey): boolean {
  if (chip === 'all') return true;
  return classifyOrderStage(item) === chip;
}

export function chipToStageHighlight(chip: StatusChipKey): OrdersStageKey | null {
  return chipToStageFocus(chip) === 'all' ? null : (chip as OrdersStageKey);
}
