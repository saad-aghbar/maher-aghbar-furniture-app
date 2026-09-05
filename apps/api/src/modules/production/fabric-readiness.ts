/**
 * Fabric readiness — store the supplier conversation, derive physical status.
 * Mirrors production-readiness.ts: pure functions, no Prisma.
 */

export type StoredFabricProcurementState =
  | 'NEEDS_ORDERING'
  | 'AWAITING_SUPPLIER'
  | 'SUPPLIER_CONFIRMED'
  | 'PARTIALLY_AVAILABLE'
  | 'UNAVAILABLE'
  | 'WAITING'
  | 'DELAYED'
  | 'READY_FOR_PICKUP'
  | 'CANCELLED';

export type DerivedFabricStatus =
  | StoredFabricProcurementState
  | 'ARRIVED'
  | 'PARTIAL'
  | 'READY_FOR_PRODUCTION'
  | 'ISSUED';

export type FabricAttentionCode =
  | 'FABRIC_NOT_ORDERED'
  | 'FABRIC_AWAITING_SUPPLIER'
  | 'FABRIC_UNAVAILABLE'
  | 'FABRIC_PARTIAL'
  | 'FABRIC_LATE'
  | 'FABRIC_LOCATION_MISSING'
  | 'FABRIC_READY_NOT_TAKEN'
  | 'FABRIC_WRONG_RECEIVED'
  | 'FABRIC_HOLD_OVERRIDDEN';

const BLOCKING_LOT_STATUSES = new Set(['QUARANTINED', 'DAMAGED', 'SCRAPPED']);
const ISSUED_LOT_STATUSES = new Set(['CONSUMED', 'DELIVERED']);
const LIVE_LOT_STATUSES = new Set([
  'AVAILABLE',
  'RESERVED',
  'PARTIALLY_CONSUMED',
  'REQUIRES_REVIEW',
]);

export type FabricLotInput = {
  id: string;
  quantity: number | string | null;
  remainingQty?: number | string | null;
  status: string;
  allocationMode?: string | null;
  salesOrderId?: string | null;
  locationId?: string | null;
  inventoryItemId?: string | null;
  sku?: string | null;
};

export type FabricUsageInput = {
  inventoryLotId?: string | null;
  actualQty?: number | string | null;
};

export type FabricRequirementInput = {
  id: string;
  salesOrderId: string;
  label: string;
  sku?: string | null;
  inventoryItemId?: string | null;
  expectedQty?: number | string | null;
  qtyIsEstimate?: boolean | null;
  unit?: string | null;
  fabricRole?: string | null;
  stageCode?: string | null;
};

export type FabricProcurementInput = {
  state: StoredFabricProcurementState | string;
  fabricHoldOverriddenAt?: Date | string | null;
  expectedAvailableAt?: Date | string | null;
};

export type FabricReadinessResult = {
  requirementId: string;
  label: string;
  sku: string | null;
  role: string | null;
  stageCode: string | null;
  unit: string;
  expectedQty: number | null;
  arrivedQty: number;
  issuedQty: number;
  storedState: StoredFabricProcurementState;
  derivedStatus: DerivedFabricStatus;
  readyForProduction: boolean;
  overridden: boolean;
  missing: string[];
  attentionCode: FabricAttentionCode | null;
  expectedAvailableAt: string | null;
};

export type FabricReadinessBlock = {
  required: number;
  ready: number;
  missing: Array<{
    label: string;
    qty: number | null;
    unit: string;
    derivedStatus: DerivedFabricStatus;
    attentionCode: FabricAttentionCode | null;
    stageCode: string | null;
  }>;
  overridden: boolean;
  items: FabricReadinessResult[];
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function qtyOf(lot: FabricLotInput): number {
  const remaining = num(lot.remainingQty);
  if (remaining != null) return Math.max(0, remaining);
  return Math.max(0, num(lot.quantity) ?? 0);
}

function isAllocatedToOrder(lot: FabricLotInput, salesOrderId: string): boolean {
  return (
    String(lot.allocationMode ?? '').toUpperCase() === 'ORDER_ALLOCATED' &&
    lot.salesOrderId === salesOrderId
  );
}

function identityMatches(req: FabricRequirementInput, lot: FabricLotInput): boolean {
  if (req.inventoryItemId && lot.inventoryItemId) {
    return req.inventoryItemId === lot.inventoryItemId;
  }
  if (req.sku && lot.sku) {
    return req.sku.trim().toLowerCase() === lot.sku.trim().toLowerCase();
  }
  return true;
}

const STORED: StoredFabricProcurementState[] = [
  'NEEDS_ORDERING',
  'AWAITING_SUPPLIER',
  'SUPPLIER_CONFIRMED',
  'PARTIALLY_AVAILABLE',
  'UNAVAILABLE',
  'WAITING',
  'DELAYED',
  'READY_FOR_PICKUP',
  'CANCELLED',
];

export function parseStoredFabricState(
  value: string | null | undefined,
): StoredFabricProcurementState {
  const raw = String(value ?? '').toUpperCase();
  return (STORED as string[]).includes(raw)
    ? (raw as StoredFabricProcurementState)
    : 'NEEDS_ORDERING';
}

/**
 * Order-allocated fabric lots must never count as free stock for another order.
 */
export function isOrderAllocatedFabricLot(lot: {
  allocationMode?: string | null;
  fabricProcurementId?: string | null;
}): boolean {
  return (
    String(lot.allocationMode ?? '').toUpperCase() === 'ORDER_ALLOCATED' ||
    Boolean(lot.fabricProcurementId)
  );
}

export function expectedQtyNumber(value: unknown): number | null {
  return num(value);
}

export function assessFabricReadiness(input: {
  requirement: FabricRequirementInput;
  procurement?: FabricProcurementInput | null;
  lots?: FabricLotInput[];
  usages?: FabricUsageInput[];
  now?: Date;
}): FabricReadinessResult {
  const req = input.requirement;
  const storedState = parseStoredFabricState(input.procurement?.state);
  const overridden = Boolean(input.procurement?.fabricHoldOverriddenAt);
  const expectedQty = expectedQtyNumber(req.expectedQty);
  const unit = req.unit?.trim() || 'm';
  const now = input.now ?? new Date();
  const eta = input.procurement?.expectedAvailableAt
    ? new Date(input.procurement.expectedAvailableAt)
    : null;
  const lots = input.lots ?? [];
  const usages = input.usages ?? [];

  const issuedQty = usages.reduce((s, u) => s + Math.max(0, num(u.actualQty) ?? 0), 0);

  const ownLots = lots.filter((lot) => isAllocatedToOrder(lot, req.salesOrderId));
  const matchingLive = ownLots.filter(
    (lot) =>
      identityMatches(req, lot) &&
      LIVE_LOT_STATUSES.has(String(lot.status).toUpperCase()) &&
      !BLOCKING_LOT_STATUSES.has(String(lot.status).toUpperCase()),
  );
  const wrongLots = ownLots.filter(
    (lot) =>
      !identityMatches(req, lot) &&
      !ISSUED_LOT_STATUSES.has(String(lot.status).toUpperCase()),
  );
  const arrivedQty = matchingLive.reduce((s, lot) => s + qtyOf(lot), 0);
  const locatedQty = matchingLive
    .filter((lot) => Boolean(lot.locationId))
    .reduce((s, lot) => s + qtyOf(lot), 0);

  const consumedQty = ownLots
    .filter((lot) => ISSUED_LOT_STATUSES.has(String(lot.status).toUpperCase()))
    .reduce((s, lot) => s + Math.max(0, num(lot.quantity) ?? 0), 0);
  const totalIssued = Math.max(issuedQty, consumedQty);

  const qtySatisfied =
    expectedQty == null || expectedQty <= 0
      ? arrivedQty > 0
      : arrivedQty + 1e-9 >= expectedQty;
  const partialApproved = storedState === 'PARTIALLY_AVAILABLE';
  const qtyOk = qtySatisfied || (partialApproved && arrivedQty > 0);
  const locationOk = locatedQty > 0 && (expectedQty == null || locatedQty + 1e-9 >= Math.min(expectedQty, arrivedQty) || locatedQty + 1e-9 >= arrivedQty);
  const hasLocation = matchingLive.some((lot) => Boolean(lot.locationId));

  const missing: string[] = [];
  if (wrongLots.length) missing.push('wrong_received');
  if (!matchingLive.length && storedState !== 'CANCELLED') missing.push('not_arrived');
  if (matchingLive.length && !hasLocation) missing.push('location');
  if (matchingLive.length && expectedQty != null && expectedQty > 0 && !qtyOk) {
    missing.push('quantity');
  }

  let derivedStatus: DerivedFabricStatus = storedState;
  if (totalIssued > 0 && (expectedQty == null || totalIssued + 1e-9 >= (qtySatisfied ? expectedQty : arrivedQty || totalIssued))) {
    derivedStatus = 'ISSUED';
  } else if (qtyOk && hasLocation && !wrongLots.length && matchingLive.length) {
    derivedStatus = 'READY_FOR_PRODUCTION';
  } else if (matchingLive.length && expectedQty != null && expectedQty > 0 && arrivedQty + 1e-9 < expectedQty) {
    derivedStatus = 'PARTIAL';
  } else if (matchingLive.length) {
    derivedStatus = 'ARRIVED';
  }

  const readyForProduction = derivedStatus === 'READY_FOR_PRODUCTION' || derivedStatus === 'ISSUED';

  let attentionCode: FabricAttentionCode | null = null;
  if (overridden && !readyForProduction) {
    attentionCode = 'FABRIC_HOLD_OVERRIDDEN';
  } else if (wrongLots.length) {
    attentionCode = 'FABRIC_WRONG_RECEIVED';
  } else if (derivedStatus === 'READY_FOR_PRODUCTION') {
    attentionCode = 'FABRIC_READY_NOT_TAKEN';
  } else if (matchingLive.length && !hasLocation) {
    attentionCode = 'FABRIC_LOCATION_MISSING';
  } else if (derivedStatus === 'PARTIAL' || (matchingLive.length && !qtyOk)) {
    attentionCode = 'FABRIC_PARTIAL';
  } else if (storedState === 'UNAVAILABLE') {
    attentionCode = 'FABRIC_UNAVAILABLE';
  } else if (
    eta &&
    !Number.isNaN(eta.getTime()) &&
    eta.getTime() < now.getTime() &&
    !matchingLive.length &&
    storedState !== 'CANCELLED' &&
    storedState !== 'NEEDS_ORDERING'
  ) {
    attentionCode = 'FABRIC_LATE';
  } else if (storedState === 'AWAITING_SUPPLIER' || storedState === 'WAITING' || storedState === 'DELAYED') {
    attentionCode = storedState === 'AWAITING_SUPPLIER' ? 'FABRIC_AWAITING_SUPPLIER' : 'FABRIC_LATE';
  } else if (storedState === 'NEEDS_ORDERING') {
    attentionCode = 'FABRIC_NOT_ORDERED';
  } else if (!readyForProduction && storedState !== 'CANCELLED') {
    if (storedState === 'SUPPLIER_CONFIRMED' || storedState === 'READY_FOR_PICKUP') {
      attentionCode = 'FABRIC_AWAITING_SUPPLIER';
    }
  }
  if (derivedStatus === 'ISSUED') attentionCode = null;

  return {
    requirementId: req.id,
    label: req.label,
    sku: req.sku ?? null,
    role: req.fabricRole ?? null,
    stageCode: req.stageCode ?? null,
    unit,
    expectedQty,
    arrivedQty,
    issuedQty: totalIssued,
    storedState,
    derivedStatus,
    readyForProduction,
    overridden,
    missing,
    attentionCode,
    expectedAvailableAt: eta && !Number.isNaN(eta.getTime()) ? eta.toISOString() : null,
  };
}

export function summarizeFabricReadiness(
  items: FabricReadinessResult[],
): FabricReadinessBlock {
  const live = items.filter((i) => i.storedState !== 'CANCELLED');
  const missing = live
    .filter((i) => !i.readyForProduction)
    .map((i) => ({
      label: i.label,
      qty: i.expectedQty,
      unit: i.unit,
      derivedStatus: i.derivedStatus,
      attentionCode: i.attentionCode,
      stageCode: i.stageCode,
    }));
  return {
    required: live.length,
    ready: live.filter((i) => i.readyForProduction).length,
    missing,
    overridden: live.some((i) => i.overridden),
    items,
  };
}

export function fabricStageIsReady(
  items: FabricReadinessResult[],
  stageCode: string | null | undefined,
  opts?: { applyUnscoped?: boolean },
): { ready: boolean; missing: FabricReadinessResult[] } {
  const code = String(stageCode ?? '').toUpperCase();
  const applyUnscoped = opts?.applyUnscoped !== false;
  const forStage = items.filter((i) => {
    if (i.storedState === 'CANCELLED') return false;
    const itemCode = String(i.stageCode ?? '').toUpperCase();
    if (itemCode) return !code || itemCode === code;
    return applyUnscoped;
  });
  const missing = forStage.filter((i) => !i.readyForProduction && !i.overridden);
  return { ready: missing.length === 0, missing };
}

export function buildFabricProcurementWhatsAppBody(input: {
  orderNumber: string;
  productName?: string | null;
  dealerName?: string | null;
  lines: Array<{
    procurementId: string;
    label: string;
    role?: string | null;
    qty?: number | null;
    unit?: string | null;
  }>;
}): string {
  const header = [`Fabric request for order ${input.orderNumber}`];
  if (input.productName?.trim()) header.push(`Product: ${input.productName.trim()}`);
  if (input.dealerName?.trim()) header.push(`Dealer: ${input.dealerName.trim()}`);
  const lines = input.lines.map((l) => {
    const qty = l.qty != null && Number.isFinite(l.qty) ? String(l.qty) : 'qty TBC';
    const unit = l.unit?.trim() ? ` ${l.unit.trim()}` : '';
    const role = l.role?.trim() ? ` (${l.role.trim()})` : '';
    return `• ${l.label}${role}: ${qty}${unit} [${l.procurementId.slice(0, 8)}]`;
  });
  return `${header.join('\n')}\nPlease confirm availability:\n${lines.join('\n')}\nThank you.`;
}
