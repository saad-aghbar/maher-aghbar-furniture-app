/**
 * Canonical Admin Order Journey classifier (server).
 * COUNT and LIST must use this same function — never client page tallies.
 *
 * Preparing → Ready to start = Release to factory (complete approved plan).
 * Ready to start → In production = first real executable task actual start.
 * Ready for delivery = packaging/FIN ready (SO READY_FOR_DELIVERY or delivery PLANNED/READY).
 * Shipped = truck departed (OUT_FOR_DELIVERY).
 * Delivered = dealer confirm (DELIVERED).
 */

export const ADMIN_ORDER_JOURNEY_BUCKETS = [
  'preparing',
  'ready_to_start',
  'in_production',
  'ready_to_ship',
  'shipped',
  'delivered',
] as const;

export type AdminOrderJourneyBucket = (typeof ADMIN_ORDER_JOURNEY_BUCKETS)[number];

export type AdminOrderJourneyCounts = Record<AdminOrderJourneyBucket | 'all', number>;

export type JourneyPoSignal = {
  releasedToFactoryAt?: Date | string | null;
  actualStartDate?: Date | string | null;
  status?: string | null;
};

export type JourneyDeliverySignal = {
  status?: string | null;
  createdAt?: Date | string | null;
};

export type JourneyClassifyInput = {
  status: string;
  productionOrders?: JourneyPoSignal[] | null;
  /** Prefer latest delivery only (createdAt desc). */
  deliveries?: JourneyDeliverySignal[] | null;
  deliveryStatus?: string | null;
};

const EXECUTION_PO_STATUSES = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
]);

const PREPARING_SO_STATUSES = new Set([
  'DRAFT',
  'CONFIRMED',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
]);

export function emptyJourneyCounts(): AdminOrderJourneyCounts {
  return {
    all: 0,
    preparing: 0,
    ready_to_start: 0,
    in_production: 0,
    ready_to_ship: 0,
    shipped: 0,
    delivered: 0,
  };
}

export function isExecutionStartedFromPos(pos: JourneyPoSignal[] | null | undefined): boolean {
  if (!pos?.length) return false;
  return pos.some(
    (po) =>
      Boolean(po.actualStartDate) ||
      EXECUTION_PO_STATUSES.has(String(po.status ?? '').toUpperCase()),
  );
}

export function isReleasedToFactoryFromPos(pos: JourneyPoSignal[] | null | undefined): boolean {
  if (!pos?.length) return false;
  if (isExecutionStartedFromPos(pos)) return true;
  return pos.some((po) => Boolean(po.releasedToFactoryAt));
}

function latestDeliveryStatus(input: JourneyClassifyInput): string {
  if (input.deliveryStatus) return String(input.deliveryStatus).toUpperCase();
  const rows = input.deliveries ?? [];
  if (!rows.length) return '';
  const sorted = [...rows].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  return String(sorted[0]?.status ?? '').toUpperCase();
}

/**
 * Single source of truth for Orders journey lane.
 * Evaluation order matches mobile desk (terminal logistics first).
 */
export function classifyAdminOrderJourneyBucket(
  input: JourneyClassifyInput,
): AdminOrderJourneyBucket {
  const so = String(input.status ?? '').toUpperCase();
  const del = latestDeliveryStatus(input);
  const pos = input.productionOrders ?? [];
  const released = isReleasedToFactoryFromPos(pos);
  const started = isExecutionStartedFromPos(pos) || so === 'IN_PRODUCTION';

  if (so === 'DELIVERED' || so === 'COMPLETED' || del === 'DELIVERED') {
    return 'delivered';
  }
  if (del === 'OUT_FOR_DELIVERY') {
    return 'shipped';
  }
  if (so === 'READY_FOR_DELIVERY' || del === 'PLANNED' || del === 'READY') {
    return 'ready_to_ship';
  }
  if (released && !started) {
    return 'ready_to_start';
  }
  if (started) {
    return 'in_production';
  }
  if (PREPARING_SO_STATUSES.has(so)) {
    return 'preparing';
  }
  return 'preparing';
}

export function tallyJourneyCounts(
  rows: JourneyClassifyInput[],
): AdminOrderJourneyCounts {
  const counts = emptyJourneyCounts();
  for (const row of rows) {
    const bucket = classifyAdminOrderJourneyBucket(row);
    counts[bucket] += 1;
    counts.all += 1;
  }
  return counts;
}

export function isAdminOrderJourneyBucket(
  value: string | null | undefined,
): value is AdminOrderJourneyBucket {
  return Boolean(value && (ADMIN_ORDER_JOURNEY_BUCKETS as readonly string[]).includes(value));
}
