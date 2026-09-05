import type { FabricTrackerItem, FabricTrackerPayload } from '@/api/modules/purchasing';
import type { FabricHoldingRow } from '@/api/modules/inventory';

export const FABRIC_QUEUE_LANES = [
  'NEEDS_ORDERING',
  'AWAITING_SUPPLIER',
  'SUPPLIER_CONFIRMED',
  'UNAVAILABLE',
  'WAITING',
  'DELAYED',
  'READY_FOR_PICKUP',
  'ARRIVED',
  'PARTIAL',
  'READY_FOR_PRODUCTION',
  'ISSUED',
] as const;

export type FabricQueueLane = (typeof FABRIC_QUEUE_LANES)[number];

export type FabricTrackerRow = {
  id: string;
  salesOrderId: string | null;
  label: string;
  role: string | null;
  stageCode: string | null;
  derivedStatus: string;
  storedState: string;
  expectedQty: number | null;
  arrivedQty: number;
  issuedQty: number;
  unit: string;
  readyForProduction: boolean;
  overridden: boolean;
  attentionCode: string | null;
  orderNumber: string | null;
  dealerName: string | null;
  productName: string | null;
  productImageUrl: string | null;
  supplierName: string | null;
  imageUrl: string | null;
  locationLabel: string | null;
  qrCodes: string[];
  lots: FabricTrackerItem['lots'];
};

export function fabricLaneOf(item: Pick<FabricTrackerItem, 'readiness'>): string {
  return item.readiness.derivedStatus || item.readiness.storedState || 'NEEDS_ORDERING';
}

export function selectFabricTrackerRow(item: FabricTrackerItem): FabricTrackerRow {
  const loc =
    item.lots.map((l) => l.locationLabel).find((v) => Boolean(v)) ?? null;
  return {
    id: item.id,
    salesOrderId: item.salesOrderId ?? null,
    label: item.readiness.label,
    role: item.readiness.role,
    stageCode: item.readiness.stageCode,
    derivedStatus: item.readiness.derivedStatus,
    storedState: item.readiness.storedState,
    expectedQty: item.readiness.expectedQty,
    arrivedQty: item.readiness.arrivedQty,
    issuedQty: item.readiness.issuedQty,
    unit: item.readiness.unit,
    readyForProduction: item.readiness.readyForProduction,
    overridden: item.readiness.overridden,
    attentionCode: item.readiness.attentionCode,
    orderNumber: item.salesOrderNumber ?? null,
    dealerName: item.dealerName ?? null,
    productName: item.productName ?? null,
    productImageUrl: item.productImageUrl ?? null,
    supplierName: item.supplier?.name ?? null,
    imageUrl: item.imageUrl ?? null,
    locationLabel: loc,
    qrCodes: item.lots.map((l) => l.qrCode).filter((c): c is string => Boolean(c)),
    lots: item.lots,
  };
}

export function selectFabricTrackerRows(payload: FabricTrackerPayload | FabricTrackerItem[]): FabricTrackerRow[] {
  const items = Array.isArray(payload) ? payload : payload.items ?? [];
  return items.map(selectFabricTrackerRow);
}

/**
 * Adapt an inventory fabric-holding row onto the shared tracker row so the
 * holding desk and the order tracker read identically on the floor.
 */
export function fabricRowFromHolding(row: FabricHoldingRow): FabricTrackerRow {
  const lot = row.lots[0];
  return {
    id: row.id,
    salesOrderId: row.salesOrderId ?? null,
    label: row.label,
    role: row.role,
    stageCode: row.stageCode ?? null,
    derivedStatus: row.derivedStatus,
    storedState: row.derivedStatus,
    expectedQty: row.expectedQty,
    arrivedQty: row.arrivedQty,
    issuedQty: 0,
    unit: row.unit,
    readyForProduction: row.derivedStatus === 'READY_FOR_PRODUCTION',
    overridden: false,
    attentionCode: null,
    orderNumber: row.orderNumber,
    dealerName: row.dealerName,
    productName: row.productName ?? null,
    productImageUrl: row.productImageUrl ?? null,
    supplierName: null,
    imageUrl: row.imageUrl ?? null,
    locationLabel: lot?.locationLabel ?? null,
    qrCodes: row.lots.map((l) => l.qrCode).filter((c): c is string => Boolean(c)),
    lots: row.lots.map((l) => ({
      id: l.id,
      qrCode: l.qrCode,
      quantity: l.remainingQty,
      remainingQty: l.remainingQty,
      locationLabel: l.locationLabel,
      status: l.status,
      unitCost: l.unitCost,
    })),
  };
}

export function fabricTakeInProgress(rows: Array<{ derivedStatus: string }>): {
  taken: number;
  total: number;
} {
  const total = rows.length;
  const taken = rows.filter((r) => r.derivedStatus === 'ISSUED').length;
  return { taken, total };
}

export function primaryFabricAction(row: FabricTrackerRow): 'order' | 'wait' | 'redirect' | 'receive' | 'open' {
  const s = row.derivedStatus;
  if (s === 'NEEDS_ORDERING') return 'order';
  if (s === 'UNAVAILABLE') return 'redirect';
  if (s === 'AWAITING_SUPPLIER' || s === 'WAITING' || s === 'DELAYED') return 'wait';
  if (s === 'READY_FOR_PICKUP' || s === 'ARRIVED' || s === 'PARTIAL') return 'receive';
  return 'open';
}

/** Floor tone for a fabric lane — olive settled, amber waiting, sienna blocked. */
export type FabricTone = 'ready' | 'waiting' | 'blocked' | 'neutral';

export function fabricToneOf(derivedStatus: string): FabricTone {
  switch (derivedStatus) {
    case 'ISSUED':
    case 'READY_FOR_PRODUCTION':
    case 'ARRIVED':
      return 'ready';
    case 'UNAVAILABLE':
    case 'DELAYED':
      return 'blocked';
    case 'NEEDS_ORDERING':
      return 'neutral';
    default:
      return 'waiting';
  }
}

/**
 * Operational lane grouping for the Inventory Fabric desk.
 * Order matches the floor reading order: what needs action first.
 */
export const FABRIC_DESK_LANES = [
  'NEEDS_ORDERING',
  'AWAITING_SUPPLIER',
  'UNAVAILABLE',
  'WAITING',
  'READY_FOR_PICKUP',
  'ARRIVED',
  'READY_FOR_PRODUCTION',
  'ISSUED',
] as const;

export type FabricDeskLane = (typeof FABRIC_DESK_LANES)[number];

export type FabricLaneCount = {
  lane: string;
  count: number;
  tone: FabricTone;
};

/** Count rows per lane, dropping empty lanes so the rail stays honest. */
export function fabricLaneCounts(rows: Array<{ derivedStatus: string }>): FabricLaneCount[] {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const lane = row.derivedStatus || 'NEEDS_ORDERING';
    tally.set(lane, (tally.get(lane) ?? 0) + 1);
  }
  const ordered: FabricLaneCount[] = [];
  for (const lane of FABRIC_DESK_LANES) {
    const count = tally.get(lane);
    if (count) {
      ordered.push({ lane, count, tone: fabricToneOf(lane) });
      tally.delete(lane);
    }
  }
  // Any lane the backend adds later still shows up rather than vanishing.
  for (const [lane, count] of tally) {
    ordered.push({ lane, count, tone: fabricToneOf(lane) });
  }
  return ordered;
}

/** Rows needing a human decision — drives the Attention lane. */
export function fabricAttentionRows<T extends { derivedStatus: string; attentionCode: string | null }>(
  rows: T[],
): T[] {
  return rows.filter(
    (r) => fabricToneOf(r.derivedStatus) === 'blocked' || Boolean(r.attentionCode),
  );
}

export type FabricStatusKind =
  | 'NEEDS_ORDERING'
  | 'WAITING'
  | 'READY_FOR_PICKUP'
  | 'PARTIAL'
  | 'READY'
  | 'UNAVAILABLE'
  | 'OVERRIDDEN'
  | 'ISSUED';

export type FabricStatusSurface = 'desk' | 'ops' | 'plan' | 'worker';

type StatusFields = Pick<
  FabricTrackerRow,
  'derivedStatus' | 'overridden' | 'readyForProduction' | 'expectedQty' | 'arrivedQty' | 'attentionCode'
>;

export function fabricIsPartial(row: Pick<FabricTrackerRow, 'derivedStatus' | 'expectedQty' | 'arrivedQty' | 'readyForProduction'>): boolean {
  if (row.derivedStatus === 'ISSUED') return false;
  if (row.derivedStatus === 'PARTIAL') return true;
  // Some quantity on the floor, but not the full requirement — never READY.
  // Zero arrived is WAITING, not PARTIAL.
  if (
    row.expectedQty != null &&
    row.expectedQty > 0 &&
    row.arrivedQty > 0 &&
    row.arrivedQty + 1e-9 < row.expectedQty
  ) {
    return true;
  }
  return false;
}

/**
 * Canonical meaning for every Fabric surface. Context-specific copy is fine;
 * WAITING must not become four unrelated words.
 */
export function fabricStatusKind(row: StatusFields): FabricStatusKind {
  if (row.overridden && !row.readyForProduction) return 'OVERRIDDEN';
  if (fabricIsPartial(row)) return 'PARTIAL';
  const s = row.derivedStatus;
  if (s === 'NEEDS_ORDERING') return 'NEEDS_ORDERING';
  if (s === 'READY_FOR_PICKUP') return 'READY_FOR_PICKUP';
  if (s === 'UNAVAILABLE' || s === 'DELAYED') return 'UNAVAILABLE';
  if (s === 'ISSUED') return 'ISSUED';
  if (s === 'READY_FOR_PRODUCTION' || s === 'ARRIVED' || row.readyForProduction) return 'READY';
  return 'WAITING';
}

export function fabricStatusLabelKey(kind: FabricStatusKind, surface: FabricStatusSurface): string {
  if (surface === 'desk') {
    switch (kind) {
      case 'NEEDS_ORDERING':
        return 'mobile.fabricStatus.needsOrdering';
      case 'WAITING':
        return 'mobile.fabricStatus.waitingSupplier';
      case 'READY_FOR_PICKUP':
        return 'mobile.fabricStatus.readyForPickup';
      case 'PARTIAL':
        return 'mobile.fabricStatus.partial';
      case 'READY':
        return 'mobile.fabricStatus.inHolding';
      case 'UNAVAILABLE':
        return 'mobile.fabricStatus.attention';
      case 'OVERRIDDEN':
        return 'mobile.fabricStatus.overridden';
      case 'ISSUED':
        return 'mobile.fabricStatus.taken';
    }
  }
  switch (kind) {
    case 'NEEDS_ORDERING':
      return 'mobile.fabricStatus.needsOrdering';
    case 'WAITING':
      return 'mobile.fabricStatus.waiting';
    case 'READY_FOR_PICKUP':
      return 'mobile.fabricStatus.readyForPickup';
    case 'PARTIAL':
      return 'mobile.fabricStatus.partial';
    case 'READY':
      return 'mobile.fabricStatus.ready';
    case 'UNAVAILABLE':
      return 'mobile.fabricStatus.unavailable';
    case 'OVERRIDDEN':
      return 'mobile.fabricStatus.overridden';
    case 'ISSUED':
      return 'mobile.fabricStatus.taken';
  }
}

export function fabricToneForKind(kind: FabricStatusKind): FabricTone {
  switch (kind) {
    case 'READY':
    case 'ISSUED':
      return 'ready';
    case 'UNAVAILABLE':
      return 'blocked';
    case 'OVERRIDDEN':
    case 'PARTIAL':
    case 'WAITING':
    case 'READY_FOR_PICKUP':
      return 'waiting';
    default:
      return 'neutral';
  }
}

export function formatFabricQty(
  row: Pick<FabricTrackerRow, 'arrivedQty' | 'expectedQty' | 'unit'>,
  opts?: { requiredOnly?: boolean },
): string {
  if (opts?.requiredOnly && row.expectedQty != null) {
    return `${row.expectedQty} ${row.unit}`.trim();
  }
  if (row.expectedQty != null) return `${row.arrivedQty}/${row.expectedQty} ${row.unit}`;
  return `${row.arrivedQty} ${row.unit}`;
}

const STAGE_LIBRARY_KEY = 'production.stageLibrary';

export function fabricStageI18nKey(stageCode: string | null | undefined): string | null {
  const code = String(stageCode ?? '').trim().toUpperCase();
  if (!code) return null;
  return `${STAGE_LIBRARY_KEY}.${code}`;
}

export type FabricDeskBucket =
  | 'needs_ordering'
  | 'waiting_supplier'
  | 'ready_for_pickup'
  | 'in_holding'
  | 'attention';

export const FABRIC_DESK_BUCKETS: FabricDeskBucket[] = [
  'needs_ordering',
  'waiting_supplier',
  'ready_for_pickup',
  'in_holding',
  'attention',
];

const ATTENTION_CODES = new Set([
  'FABRIC_UNAVAILABLE',
  'FABRIC_PARTIAL',
  'FABRIC_LATE',
  'FABRIC_LOCATION_MISSING',
  'FABRIC_WRONG_RECEIVED',
  'FABRIC_HOLD_OVERRIDDEN',
]);

export function fabricDeskBucketOf(row: StatusFields): FabricDeskBucket {
  const kind = fabricStatusKind(row);
  if (kind === 'NEEDS_ORDERING') return 'needs_ordering';
  if (kind === 'READY_FOR_PICKUP') return 'ready_for_pickup';
  if (kind === 'PARTIAL' || kind === 'UNAVAILABLE' || kind === 'OVERRIDDEN') return 'attention';
  if (row.attentionCode && ATTENTION_CODES.has(row.attentionCode)) return 'attention';
  if (kind === 'READY' || kind === 'ISSUED') return 'in_holding';
  return 'waiting_supplier';
}

export function fabricDeskBucketLabelKey(bucket: FabricDeskBucket): string {
  switch (bucket) {
    case 'needs_ordering':
      return 'mobile.fabricStatus.needsOrdering';
    case 'waiting_supplier':
      return 'mobile.fabricStatus.waitingSupplier';
    case 'ready_for_pickup':
      return 'mobile.fabricStatus.readyForPickup';
    case 'in_holding':
      return 'mobile.fabricStatus.inHolding';
    case 'attention':
      return 'mobile.fabricStatus.attention';
  }
}

export function fabricDeskBucketTone(bucket: FabricDeskBucket): FabricTone {
  switch (bucket) {
    case 'in_holding':
      return 'ready';
    case 'attention':
      return 'blocked';
    case 'needs_ordering':
      return 'neutral';
    default:
      return 'waiting';
  }
}

export type FabricDeskBucketCount = {
  bucket: FabricDeskBucket;
  count: number;
  tone: FabricTone;
};

export function fabricDeskBucketCounts(rows: StatusFields[]): FabricDeskBucketCount[] {
  const tally: Record<FabricDeskBucket, number> = {
    needs_ordering: 0,
    waiting_supplier: 0,
    ready_for_pickup: 0,
    in_holding: 0,
    attention: 0,
  };
  for (const row of rows) {
    tally[fabricDeskBucketOf(row)] += 1;
  }
  return FABRIC_DESK_BUCKETS.map((bucket) => ({
    bucket,
    count: tally[bucket],
    tone: fabricDeskBucketTone(bucket),
  }));
}

export function filterRowsByDeskBucket<T extends StatusFields>(
  rows: T[],
  bucket: FabricDeskBucket | null,
): T[] {
  if (!bucket) return rows;
  return rows.filter((row) => fabricDeskBucketOf(row) === bucket);
}

export type FabricOrderGroup = {
  id: string;
  key: string;
  salesOrderId: string | null;
  orderNumber: string | null;
  productName: string | null;
  dealerName: string | null;
  productImageUrl: string | null;
  rows: FabricTrackerRow[];
  readyCount: number;
  requiredCount: number;
  attention: boolean;
  overridden: boolean;
  tone: FabricTone;
};

function groupSortKey(group: FabricOrderGroup): string {
  return group.orderNumber ?? group.key;
}

function pickGroupImage(rows: FabricTrackerRow[]): string | null {
  return rows.map((r) => r.productImageUrl).find((v) => Boolean(v))
    ?? rows.map((r) => r.imageUrl).find((v) => Boolean(v))
    ?? null;
}

export function fabricGroupReadiness(rows: FabricTrackerRow[]): { ready: number; required: number } {
  const live = rows.filter((r) => r.storedState !== 'CANCELLED');
  return {
    required: live.length,
    ready: live.filter((r) => {
      const kind = fabricStatusKind(r);
      return kind === 'READY' || kind === 'ISSUED';
    }).length,
  };
}

export function groupFabricRowsBySalesOrder(rows: FabricTrackerRow[]): FabricOrderGroup[] {
  const map = new Map<string, FabricTrackerRow[]>();
  for (const row of rows) {
    const key = row.salesOrderId || row.orderNumber || `row:${row.id}`;
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  const groups: FabricOrderGroup[] = [];
  for (const [key, groupRows] of map) {
    const first = groupRows[0]!;
    const { ready, required } = fabricGroupReadiness(groupRows);
    const attention = groupRows.some(
      (r) =>
        fabricDeskBucketOf(r) === 'attention' ||
        fabricToneForKind(fabricStatusKind(r)) === 'blocked',
    );
    const overridden = groupRows.some((r) => r.overridden);
    const allReady = required > 0 && ready === required && !overridden;
    const tone: FabricTone = attention ? 'blocked' : allReady ? 'ready' : ready > 0 ? 'waiting' : 'neutral';
    groups.push({
      id: key,
      key,
      salesOrderId: first.salesOrderId,
      orderNumber: first.orderNumber,
      productName: groupRows.map((r) => r.productName).find((v) => Boolean(v)) ?? null,
      dealerName: groupRows.map((r) => r.dealerName).find((v) => Boolean(v)) ?? null,
      productImageUrl: pickGroupImage(groupRows),
      rows: groupRows,
      readyCount: ready,
      requiredCount: required,
      attention,
      overridden,
      tone,
    });
  }
  groups.sort((a, b) => groupSortKey(b).localeCompare(groupSortKey(a), undefined, { numeric: true }));
  return groups;
}

/**
 * One list for the inventory desk: procurements lead, holding fills location/QR,
 * holding-only rows still appear (no procurement permission / unmatched lots).
 */
export function mergeFabricDeskRows(
  queue: FabricTrackerRow[],
  holding: FabricTrackerRow[],
): FabricTrackerRow[] {
  const byId = new Map(holding.map((h) => [h.id, h]));
  const used = new Set<string>();
  const merged = queue.map((q) => {
    const h = byId.get(q.id);
    if (!h) return q;
    used.add(q.id);
    return {
      ...q,
      locationLabel: q.locationLabel ?? h.locationLabel,
      qrCodes: q.qrCodes.length ? q.qrCodes : h.qrCodes,
      lots: q.lots.length ? q.lots : h.lots,
      productName: q.productName ?? h.productName,
      productImageUrl: q.productImageUrl ?? h.productImageUrl,
      imageUrl: q.imageUrl ?? h.imageUrl,
      salesOrderId: q.salesOrderId ?? h.salesOrderId,
      dealerName: q.dealerName ?? h.dealerName,
    };
  });
  for (const h of holding) {
    if (!used.has(h.id)) merged.push(h);
  }
  return merged;
}

export function fabricRowDestination(
  row: FabricTrackerRow,
): { kind: 'bundle'; code: string } | { kind: 'procurement'; id: string } {
  const code = row.qrCodes[0];
  if (code) return { kind: 'bundle', code };
  return { kind: 'procurement', id: row.id };
}

/** Path for a fabric tap: physical bundle when a QR exists, otherwise procurement. */
export function fabricRowHref(row: FabricTrackerRow): string {
  const dest = fabricRowDestination(row);
  if (dest.kind === 'bundle') {
    return `/(app)/(admin)/inventory/fabric-bundle/${encodeURIComponent(dest.code)}`;
  }
  return `/(app)/(admin)/purchasing/fabric/${dest.id}`;
}

/**
 * First fabric that still blocks a fabric-dependent stage.
 * Prefer “not arrived” over a short quantity so the note matches the floor.
 */
export function pickFabricBlockingRow(rows: FabricTrackerRow[]): FabricTrackerRow | null {
  const order: FabricStatusKind[] = [
    'UNAVAILABLE',
    'NEEDS_ORDERING',
    'WAITING',
    'PARTIAL',
    'READY_FOR_PICKUP',
  ];
  for (const kind of order) {
    const hit = rows.find((r) => fabricStatusKind(r) === kind);
    if (hit) return hit;
  }
  return null;
}

export function filterFabricRowsByPurchasingStatus(
  rows: FabricTrackerRow[],
  status: string,
): FabricTrackerRow[] {
  if (!status || status === 'ALL') return rows;
  if (status === 'PARTIAL') return rows.filter((r) => fabricStatusKind(r) === 'PARTIAL');
  if (status === 'WAITING') return rows.filter((r) => fabricStatusKind(r) === 'WAITING');
  return rows.filter((r) => r.derivedStatus === status);
}

export function fabricRowFromTaskItem(
  item: {
    id: string;
    label: string;
    role: string | null;
    stageCode: string | null;
    derivedStatus: string;
    readyForProduction: boolean;
    expectedQty: number | null;
    arrivedQty: number;
    issuedQty: number;
    unit: string;
    imageUrl?: string | null;
    lots: Array<{
      id: string;
      qrCode?: string | null;
      remainingQty: number | null;
      status: string;
      locationLabel?: string | null;
    }>;
  },
  ctx?: { salesOrderId?: string | null; salesOrderNumber?: string | null },
): FabricTrackerRow {
  return {
    id: item.id,
    salesOrderId: ctx?.salesOrderId ?? null,
    label: item.label,
    role: item.role,
    stageCode: item.stageCode,
    derivedStatus: item.derivedStatus,
    storedState: item.derivedStatus,
    expectedQty: item.expectedQty,
    arrivedQty: item.arrivedQty,
    issuedQty: item.issuedQty,
    unit: item.unit,
    readyForProduction: item.readyForProduction,
    overridden: false,
    attentionCode: null,
    orderNumber: ctx?.salesOrderNumber ?? null,
    dealerName: null,
    productName: null,
    productImageUrl: null,
    supplierName: null,
    imageUrl: item.imageUrl ?? null,
    locationLabel: item.lots.map((l) => l.locationLabel).find((v) => Boolean(v)) ?? null,
    qrCodes: item.lots.map((l) => l.qrCode).filter((c): c is string => Boolean(c)),
    lots: item.lots.map((l) => ({
      id: l.id,
      qrCode: l.qrCode,
      quantity: l.remainingQty ?? 0,
      remainingQty: l.remainingQty,
      locationLabel: l.locationLabel,
      status: l.status,
      unitCost: null,
    })),
  };
}
