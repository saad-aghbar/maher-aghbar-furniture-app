export type LedgerBucketKey = 'today' | 'tomorrow' | 'later' | 'nodate' | 'past';

/** Floor-board sections: orders that arrived today vs earlier. */
export type FloorBoardSectionKey = 'today' | 'past';

export type LedgerGroupable = {
  id: string;
  deliveryDate: string | null;
};

export type FloorBoardGroupable = {
  id: string;
  /** When the order arrived in the factory/admin book (createdAt). */
  arrivedAt: string | null;
};

export type LedgerGroup<T extends LedgerGroupable> = {
  key: LedgerBucketKey;
  items: T[];
};

export type FloorBoardGroup<T extends FloorBoardGroupable> = {
  key: FloorBoardSectionKey;
  items: T[];
};

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketFor(deliveryDate: string | null, now: Date): LedgerBucketKey {
  if (!deliveryDate) return 'nodate';
  const t = Date.parse(deliveryDate);
  if (!Number.isFinite(t)) return 'nodate';
  const day = startOfDay(new Date(t));
  const today = startOfDay(now);
  const tomorrow = today + 86_400_000;
  if (day < today) return 'past';
  if (day === today) return 'today';
  if (day === tomorrow) return 'tomorrow';
  return 'later';
}

const ORDER: LedgerBucketKey[] = ['past', 'today', 'tomorrow', 'later', 'nodate'];

/** Group by required delivery day (ledger / other compositions). */
export function groupOrdersByDay<T extends LedgerGroupable>(
  items: T[],
  now = new Date(),
): LedgerGroup<T>[] {
  const map = new Map<LedgerBucketKey, T[]>();
  for (const key of ORDER) map.set(key, []);
  for (const item of items) {
    const key = bucketFor(item.deliveryDate, now);
    map.get(key)!.push(item);
  }
  return ORDER.filter((key) => (map.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    items: map.get(key)!,
  }));
}

function arrivalBucket(arrivedAt: string | null, now: Date): FloorBoardSectionKey {
  if (!arrivedAt) return 'past';
  const t = Date.parse(arrivedAt);
  if (!Number.isFinite(t)) return 'past';
  const day = startOfDay(new Date(t));
  const today = startOfDay(now);
  return day === today ? 'today' : 'past';
}

const FLOOR_ORDER: FloorBoardSectionKey[] = ['today', 'past'];

/**
 * Orders tab: dealer orders that arrived today, then everything that arrived before.
 * Always returns both sections (empty lists allowed) so the floor board stays stable.
 */
export function groupOrdersFloorBoard<T extends FloorBoardGroupable>(
  items: T[],
  now = new Date(),
): FloorBoardGroup<T>[] {
  const map = new Map<FloorBoardSectionKey, T[]>();
  for (const key of FLOOR_ORDER) map.set(key, []);
  for (const item of items) {
    map.get(arrivalBucket(item.arrivedAt, now))!.push(item);
  }
  return FLOOR_ORDER.map((key) => ({
    key,
    items: map.get(key)!,
  }));
}
