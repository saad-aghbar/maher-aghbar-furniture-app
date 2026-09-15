/** Pure Slice 6 transition helpers — no Nest, no Prisma. */

export type LowStockCross = {
  itemId: string;
  sku: string;
  before: number;
  after: number;
  minStock: number;
};

export function stockCrossedBelowMin(before: number, after: number, minStock: number): boolean {
  if (!Number.isFinite(before) || !Number.isFinite(after) || !Number.isFinite(minStock)) return false;
  if (minStock < 0) return false;
  return before > minStock && after <= minStock;
}

export function inventoryTopicForTxType(type: string): string | null {
  switch (type) {
    case 'PURCHASE_RECEIPT':
      return 'inventory.received';
    case 'PRODUCTION_ISSUE':
    case 'SEMI_FINISHED_ISSUE':
    case 'DELIVERY_ISSUE':
      return 'inventory.issued';
    case 'WAREHOUSE_TRANSFER':
      return 'inventory.transferred';
    case 'INVENTORY_ADJUSTMENT':
      return 'inventory.adjusted';
    default:
      return null;
  }
}

export function fabricTopicForState(state: string): string | null {
  switch (state) {
    case 'NEEDS_ORDERING':
      return 'fabric.needsOrdering';
    case 'AWAITING_SUPPLIER':
      return 'fabric.awaitingSupplier';
    case 'READY_FOR_PICKUP':
      return 'fabric.readyForPickup';
    case 'UNAVAILABLE':
      return 'fabric.unavailable';
    default:
      return null;
  }
}

export function fabricTopicForEventKind(kind: string): string | null {
  switch (kind) {
    case 'RECEIVED':
      return 'fabric.arrived';
    case 'SUPPLIER_UNAVAILABLE':
      return 'fabric.unavailable';
    case 'READY_FOR_PICKUP':
      return 'fabric.readyForPickup';
    case 'REQUESTED':
      return 'fabric.awaitingSupplier';
    default:
      return null;
  }
}

const RETURN_CASE_TOPICS: Record<string, string> = {
  RETURN_SUBMITTED: 'return.submitted',
  RETURN_APPROVED: 'return.approved',
  RETURN_REJECTED: 'return.rejected',
  RETURN_NEED_INFO: 'return.needInfo',
  RETURN_RECEIVED: 'return.received',
  RETURN_DECISION: 'return.decision',
  RETURN_WORK_STARTED: 'return.workStarted',
  RETURN_READY: 'return.ready',
  RETURN_RESHIP_SCHEDULED: 'return.reshipScheduled',
  RETURN_DELIVERED: 'return.delivered',
  RETURN_CHARGE_PROPOSED: 'return.chargeProposed',
  RETURN_CHARGED: 'return.charged',
  RETURN_CHARGE_REJECTED: 'return.chargeRejected',
};

export function returnTopicFromTemplate(templateCode: string): string | null {
  return RETURN_CASE_TOPICS[templateCode] ?? null;
}

const CLOSED_INVOICE = new Set(['PAID', 'VOID', 'CANCELLED', 'DRAFT']);

export function invoiceIsOverdueCandidate(input: {
  status: string;
  outstandingAmount: number;
  dueDate: Date | string | null | undefined;
  now: Date;
}): boolean {
  if (CLOSED_INVOICE.has(input.status)) return false;
  if (!(input.outstandingAmount > 0.001)) return false;
  if (!input.dueDate) return false;
  const due = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < input.now.getTime();
}

const OPEN_PO_FOR_LATE = new Set(['SENT', 'PARTIALLY_RECEIVED']);

export function purchaseOrderIsLate(input: {
  status: string;
  expectedDeliveryDate: Date | string | null | undefined;
  now: Date;
}): boolean {
  if (!OPEN_PO_FOR_LATE.has(input.status)) return false;
  if (!input.expectedDeliveryDate) return false;
  const expected =
    input.expectedDeliveryDate instanceof Date
      ? input.expectedDeliveryDate
      : new Date(input.expectedDeliveryDate);
  if (Number.isNaN(expected.getTime())) return false;
  return expected.getTime() < input.now.getTime();
}

const CLOSED_TASK = new Set(['COMPLETED', 'CANCELLED']);

export function taskIsEligibleScheduledToday(input: {
  status: string;
  assignedEmployeeId: string | null | undefined;
  plannedStart: Date | string | null | undefined;
  todayYmd: string;
  timezoneYmd: (date: Date, timeZone: string) => string;
  timeZone: string;
}): boolean {
  if (CLOSED_TASK.has(input.status)) return false;
  if (!input.assignedEmployeeId) return false;
  if (!input.plannedStart) return false;
  const start = input.plannedStart instanceof Date ? input.plannedStart : new Date(input.plannedStart);
  if (Number.isNaN(start.getTime())) return false;
  return input.timezoneYmd(start, input.timeZone) === input.todayYmd;
}

export function dueYmd(date: Date | string, timeZoneYmd: (d: Date, tz: string) => string, tz: string): string {
  const d = date instanceof Date ? date : new Date(date);
  return timeZoneYmd(d, tz);
}
