import {
  classifyOrderStage,
  countDealerFocusBuckets,
  type StageCountable,
} from './stageCounts';

export type DealerOrderTileKey = 'active' | 'production' | 'ready' | 'attention';

/** Desk subsections — equal-flex wood bar, no scroll. */
export type DealerOrdersRailKey =
  | 'all'
  | 'drafts'
  | 'waiting'
  | 'needsInformation'
  | 'pending'
  | 'production'
  | 'ready'
  | 'shipped';

const REVIEW_RAIL: DealerOrdersRailKey[] = ['all', 'drafts', 'waiting', 'needsInformation'];
const LINE_RAIL: DealerOrdersRailKey[] = ['all', 'pending', 'production'];
const OUT_RAIL: DealerOrdersRailKey[] = ['all', 'ready', 'shipped'];

/** Active / cleared stamp: no bar. Review / On line / Out: All + that desk’s stops. */
export function railStopsForTile(tile: DealerOrderTileKey | null): DealerOrdersRailKey[] {
  if (tile === 'attention') return REVIEW_RAIL;
  if (tile === 'production') return LINE_RAIL;
  if (tile === 'ready') return OUT_RAIL;
  return [];
}

export type OrderStationStubKind =
  | 'preparing'
  | 'production'
  | 'ready'
  | 'shipped'
  | 'delivered'
  | 'review';

export type DealerOrderStampCounts = Record<DealerOrderTileKey, number>;

/** 2×2 hub stamps — Active / On line / Out / Review. */
export function countDealerOrderStamps(items: StageCountable[]): DealerOrderStampCounts {
  const buckets = countDealerFocusBuckets(items);
  return {
    active: Math.max(0, buckets.total - buckets.delivered),
    production: buckets.pending + buckets.production,
    ready: buckets.ready + buckets.shipped,
    attention: buckets.drafts + buckets.waiting + buckets.needsInformation,
  };
}

export function matchesDealerOrderTile(
  item: StageCountable,
  tile: DealerOrderTileKey,
): boolean {
  const stage = classifyOrderStage(item);
  if (tile === 'active') return stage !== 'delivered';
  if (tile === 'production') return stage === 'pending' || stage === 'production';
  if (tile === 'ready') return stage === 'ready' || stage === 'shipped';
  return stage === 'drafts' || stage === 'waiting' || stage === 'needsInformation';
}

export function filterByDealerOrderTile<T extends StageCountable>(
  items: T[],
  tile: DealerOrderTileKey,
): T[] {
  return items.filter((item) => matchesDealerOrderTile(item, tile));
}

export function matchesDealerOrdersRail(
  item: StageCountable,
  rail: DealerOrdersRailKey,
): boolean {
  if (rail === 'all') return true;
  return classifyOrderStage(item) === rail;
}

export function filterByDealerOrdersRail<T extends StageCountable>(
  items: T[],
  rail: DealerOrdersRailKey,
): T[] {
  if (rail === 'all') return items;
  return items.filter((item) => matchesDealerOrdersRail(item, rail));
}

export const ORDER_STATION_CAPTION_KEY: Record<OrderStationStubKind, string> = {
  preparing: 'mobile.orders.stationPreparing',
  production: 'mobile.orders.stationOnLine',
  ready: 'mobile.orders.stationReady',
  shipped: 'mobile.orders.stationShipped',
  delivered: 'mobile.orders.stationDone',
  review: 'mobile.orders.stationReview',
};

/** Ticket stub — station + progress %, not a delivery day or quote expiry. */
export function selectOrderStationStub(item: {
  kind?: string | null;
  status: string;
  deliveryStatus?: string | null;
  progressPercent?: number | null;
}): {
  kind: OrderStationStubKind;
  progressLabel: string;
} {
  const stage = classifyOrderStage(item);
  let kind: OrderStationStubKind = 'preparing';
  if (stage === 'waiting' || stage === 'needsInformation') kind = 'review';
  else if (stage === 'production') kind = 'production';
  else if (stage === 'ready') kind = 'ready';
  else if (stage === 'shipped') kind = 'shipped';
  else if (stage === 'delivered') kind = 'delivered';

  const isRfq = item.kind === 'rfq';
  const pct = Math.max(0, Math.min(100, Math.round(item.progressPercent || 0)));
  return {
    kind,
    progressLabel: isRfq ? '—' : `${pct}%`,
  };
}
