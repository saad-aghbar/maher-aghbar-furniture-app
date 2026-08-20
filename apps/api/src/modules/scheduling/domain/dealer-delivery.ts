import type { CanonicalScheduleStatus } from './at-risk';
import { ymdInTimezone } from './factory-replan';
import { addDaysYmd, parseYmd } from './working-calendar';

export type CustomerDeliveryStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED_ON_TRACK'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'MAY_BE_DELAYED'
  | 'DELAYED'
  | 'DELIVERED'
  | 'CANCELLED';

export const CUSTOMER_SAFE_PRODUCTION_DELAY = 'Production is taking longer than expected.';
export const CUSTOMER_SAFE_SCHEDULE_UPDATING = 'Schedule being updated';

export type DealerActionRequired = {
  code: 'NEEDS_INFORMATION';
  labelKey: string;
};

const IN_PRODUCTION_PO = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
]);

const CANCELLED = new Set(['CANCELLED']);
const DELIVERED_SO = new Set(['DELIVERED', 'COMPLETED']);

const ACTIVE_LOGISTICS = new Set(['PLANNED', 'READY', 'OUT_FOR_DELIVERY']);

export type DealerDeliveryFacts = {
  salesOrderStatus?: string | null;
  productionOrderStatus?: string | null;
  deliveryStatus?: string | null;
  requestedYmd: string | null;
  suggestedYmd: string | null;
  committedYmd: string | null;
  projectedYmd: string | null;
  plannedYmd?: string | null;
  actualYmd: string | null;
  todayYmd: string;
  canUpdateDeliveryDate?: boolean;
  canRequestDateChange?: boolean;
  /** Admin classifier output — dealer maps this commercially; never leaked as-is. */
  riskStatus?: CanonicalScheduleStatus | null;
  /** RFQ / request status — only NEEDS_INFORMATION is a real dealer CTA. */
  requestStatus?: string | null;
};

export type DealerDeliveryView = {
  customerStatus: CustomerDeliveryStatus;
  calendarDate: string | null;
  requiresDealerAttention: boolean;
  actionRequired: DealerActionRequired | null;
  delayed: boolean;
  customerSafeReason: string | null;
  compactDates: boolean;
  delayDays: number | null;
  /** Sanitized current expected — null when the stored planner date is already past. */
  projectedYmd: string | null;
  plannedYmd: string | null;
  scheduleUpdating: boolean;
};

export type CustomerFacingDateTuple = {
  requestedYmd: string | null;
  suggestedYmd: string | null;
  committedYmd: string | null;
  projectedYmd: string | null;
  plannedYmd: string | null;
  actualYmd: string | null;
  calendarDate: string | null;
  customerStatus: CustomerDeliveryStatus;
};

export function toCalendarYmd(
  value: Date | string | null | undefined,
  timeZone: string,
): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const sliced = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sliced) && trimmed.length <= 10) return sliced;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return /^\d{4}-\d{2}-\d{2}$/.test(sliced) ? sliced : null;
    return ymdInTimezone(parsed, timeZone);
  }
  return ymdInTimezone(value, timeZone);
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = Date.parse(`${fromYmd}T00:00:00.000Z`);
  const to = Date.parse(`${toYmd}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Actual commercial delivery day — `deliveryDate`, never `updatedAt`. */
export function actualDeliveryValue(
  delivery: { status?: string | null; deliveryDate?: Date | string | null } | null | undefined,
): Date | string | null {
  if (!delivery || delivery.status !== 'DELIVERED') return null;
  return delivery.deliveryDate ?? null;
}

/** Logistics appointment — truck day, not production completion. */
export function plannedDeliveryValue(
  delivery: { status?: string | null; deliveryDate?: Date | string | null } | null | undefined,
): Date | string | null {
  if (!delivery || !delivery.status || !ACTIVE_LOGISTICS.has(delivery.status)) return null;
  return delivery.deliveryDate ?? null;
}

export function isIncompleteDealerOrder(status: CustomerDeliveryStatus): boolean {
  return status !== 'DELIVERED' && status !== 'CANCELLED';
}

/** A stored planner date is not “current expected” once it has already passed. */
export function isTrustworthyCurrentExpected(
  ymd: string | null,
  todayYmd: string,
  incomplete: boolean,
): boolean {
  if (!ymd) return false;
  if (!incomplete) return true;
  return ymd >= todayYmd;
}

export function customerSafeProjectedYmd(
  projectedYmd: string | null,
  todayYmd: string,
  incomplete: boolean,
): string | null {
  return isTrustworthyCurrentExpected(projectedYmd, todayYmd, incomplete) ? projectedYmd : null;
}

export function mapCustomerDeliveryStatus(facts: DealerDeliveryFacts): CustomerDeliveryStatus {
  const so = facts.salesOrderStatus ?? '';
  const po = facts.productionOrderStatus ?? '';
  const delivery = facts.deliveryStatus ?? '';

  if (CANCELLED.has(so) || CANCELLED.has(po) || delivery === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (delivery === 'DELIVERED' || DELIVERED_SO.has(so)) {
    return 'DELIVERED';
  }
  if (delivery === 'OUT_FOR_DELIVERY') {
    return 'OUT_FOR_DELIVERY';
  }
  if (delivery === 'READY' || so === 'READY_FOR_DELIVERY' || po === 'READY_FOR_DELIVERY') {
    return 'READY_FOR_DELIVERY';
  }

  const committed = facts.committedYmd;
  const projected = facts.projectedYmd;
  const today = facts.todayYmd;
  const risk = facts.riskStatus ?? null;
  const inProduction = IN_PRODUCTION_PO.has(po) || so === 'IN_PRODUCTION';

  if (committed) {
    if (risk === 'LATE') return 'DELAYED';
    if (risk === 'AT_RISK') return 'MAY_BE_DELAYED';
    if (risk === 'BLOCKED') {
      return inProduction ? 'IN_PRODUCTION' : 'CONFIRMED_ON_TRACK';
    }
    if (!risk) {
      if (today > committed) return 'DELAYED';
      if (projected && projected > committed && today <= committed) return 'MAY_BE_DELAYED';
    }
    if (inProduction) return 'IN_PRODUCTION';
    return 'CONFIRMED_ON_TRACK';
  }

  return 'AWAITING_CONFIRMATION';
}

/**
 * Dealer delivery calendar: the day the dealer should expect physical delivery.
 * Production suggested/projected never outranks a logistics appointment.
 */
export function calendarDateForDealer(facts: {
  customerStatus: CustomerDeliveryStatus;
  actualYmd: string | null;
  plannedYmd?: string | null;
  committedYmd: string | null;
  suggestedYmd: string | null;
  projectedYmd?: string | null;
  requestedYmd: string | null;
  todayYmd?: string | null;
}): string | null {
  if (facts.customerStatus === 'DELIVERED') return facts.actualYmd ?? facts.committedYmd;
  if (facts.plannedYmd) return facts.plannedYmd;
  if (facts.committedYmd) return facts.committedYmd;
  const incomplete = isIncompleteDealerOrder(facts.customerStatus);
  const today = facts.todayYmd ?? null;
  const suggestedOk =
    !today || isTrustworthyCurrentExpected(facts.suggestedYmd, today, incomplete);
  if (facts.suggestedYmd && suggestedOk) return facts.suggestedYmd;
  const projectedOk =
    !today || isTrustworthyCurrentExpected(facts.projectedYmd ?? null, today, incomplete);
  if (facts.projectedYmd && projectedOk) return facts.projectedYmd;
  return facts.requestedYmd;
}

export function datesAreCompact(facts: {
  requestedYmd: string | null;
  suggestedYmd: string | null;
  committedYmd: string | null;
  projectedYmd: string | null;
}): boolean {
  if (!facts.committedYmd) return false;
  const vals = [facts.requestedYmd, facts.suggestedYmd, facts.committedYmd, facts.projectedYmd].filter(
    Boolean,
  ) as string[];
  return vals.length > 0 && vals.every((v) => v === facts.committedYmd);
}

export function resolveDealerActionRequired(
  facts: DealerDeliveryFacts,
): DealerActionRequired | null {
  if (facts.requestStatus === 'NEEDS_INFORMATION') {
    return {
      code: 'NEEDS_INFORMATION',
      labelKey: 'mobile.orders.actionNeedsInformation',
    };
  }
  return null;
}

export function buildDealerDeliveryView(facts: DealerDeliveryFacts): DealerDeliveryView {
  const customerStatus = mapCustomerDeliveryStatus(facts);
  const incomplete = isIncompleteDealerOrder(customerStatus);
  const plannedYmd = facts.plannedYmd ?? null;
  const projectedYmd = customerSafeProjectedYmd(facts.projectedYmd, facts.todayYmd, incomplete);
  const calendarDate = calendarDateForDealer({
    customerStatus,
    actualYmd: facts.actualYmd,
    plannedYmd,
    committedYmd: facts.committedYmd,
    suggestedYmd: facts.suggestedYmd,
    projectedYmd: facts.projectedYmd,
    requestedYmd: facts.requestedYmd,
    todayYmd: facts.todayYmd,
  });
  const delayed = customerStatus === 'MAY_BE_DELAYED' || customerStatus === 'DELAYED';
  const delayDays =
    delayed && facts.committedYmd && projectedYmd && projectedYmd > facts.committedYmd
      ? daysBetweenYmd(facts.committedYmd, projectedYmd)
      : null;
  const actionRequired = resolveDealerActionRequired(facts);
  const scheduleUpdating =
    (delayed && !projectedYmd) ||
    (facts.riskStatus === 'BLOCKED' && !delayed && !actionRequired);
  const blockedSafeCopy =
    facts.riskStatus === 'BLOCKED' && !delayed && !actionRequired
      ? CUSTOMER_SAFE_SCHEDULE_UPDATING
      : null;
  return {
    customerStatus,
    calendarDate,
    actionRequired,
    delayed,
    requiresDealerAttention: Boolean(actionRequired),
    customerSafeReason: delayed
      ? CUSTOMER_SAFE_PRODUCTION_DELAY
      : scheduleUpdating
        ? CUSTOMER_SAFE_SCHEDULE_UPDATING
        : blockedSafeCopy,
    compactDates: datesAreCompact({ ...facts, projectedYmd }) && !delayed,
    delayDays,
    projectedYmd,
    plannedYmd,
    scheduleUpdating,
  };
}

export function selectCustomerFacingDateTuple(
  facts: DealerDeliveryFacts,
  view: DealerDeliveryView,
): CustomerFacingDateTuple {
  return {
    requestedYmd: facts.requestedYmd,
    suggestedYmd: facts.suggestedYmd,
    committedYmd: facts.committedYmd,
    projectedYmd: view.projectedYmd,
    plannedYmd: view.plannedYmd,
    actualYmd: facts.actualYmd,
    calendarDate: view.calendarDate,
    customerStatus: view.customerStatus,
  };
}

/**
 * Physical-delivery calendar day: actual, else planned logistics, else committed promise.
 * Projected production completion never owns the day.
 */
export function committedCalendarDateIsFrozen(tuple: CustomerFacingDateTuple): boolean {
  if (tuple.customerStatus === 'DELIVERED') {
    return tuple.calendarDate === (tuple.actualYmd ?? tuple.committedYmd);
  }
  if (tuple.plannedYmd) {
    return tuple.calendarDate === tuple.plannedYmd;
  }
  if (tuple.committedYmd) {
    return tuple.calendarDate === tuple.committedYmd;
  }
  if (tuple.suggestedYmd) {
    return tuple.calendarDate === tuple.suggestedYmd;
  }
  return tuple.calendarDate === tuple.requestedYmd;
}

export function customerFacingTuplesAgree(
  a: CustomerFacingDateTuple,
  b: CustomerFacingDateTuple,
): boolean {
  return (
    a.requestedYmd === b.requestedYmd &&
    a.suggestedYmd === b.suggestedYmd &&
    a.committedYmd === b.committedYmd &&
    a.projectedYmd === b.projectedYmd &&
    a.plannedYmd === b.plannedYmd &&
    a.actualYmd === b.actualYmd &&
    a.calendarDate === b.calendarDate &&
    a.customerStatus === b.customerStatus
  );
}

export function tupleFromDealerDto(row: {
  requestedDeliveryDate?: Date | string | null;
  suggestedDeliveryDate?: Date | string | null;
  committedDeliveryDate?: Date | string | null;
  projectedDeliveryDate?: Date | string | null;
  plannedDeliveryDate?: Date | string | null;
  actualDeliveryDate?: Date | string | null;
  calendarDate?: string | null;
  customerStatus?: string | null;
  timeZone?: string;
}): CustomerFacingDateTuple {
  const tz = row.timeZone ?? 'UTC';
  return {
    requestedYmd: toCalendarYmd(row.requestedDeliveryDate ?? null, tz),
    suggestedYmd: toCalendarYmd(row.suggestedDeliveryDate ?? null, tz),
    committedYmd: toCalendarYmd(row.committedDeliveryDate ?? null, tz),
    projectedYmd: toCalendarYmd(row.projectedDeliveryDate ?? null, tz),
    plannedYmd: toCalendarYmd(row.plannedDeliveryDate ?? null, tz),
    actualYmd: toCalendarYmd(row.actualDeliveryDate ?? null, tz),
    calendarDate: row.calendarDate ?? null,
    customerStatus: (row.customerStatus as CustomerDeliveryStatus) ?? 'AWAITING_CONFIRMATION',
  };
}

/** True when a UI label would present requested/expected as a confirmed promise. */
export function labelTreatsDateAsConfirmed(label: string): boolean {
  return /confirm|مؤكد|מאושר/i.test(label);
}

export function isNearingCalendarDate(
  calendarDate: string | null,
  todayYmd: string,
  withinDays = 7,
): boolean {
  if (!calendarDate) return false;
  const end = addDaysYmd(todayYmd, withinDays);
  return calendarDate >= todayYmd && calendarDate <= end;
}

export function filterByCalendarDateRange<
  T extends { calendarDate: string | null; actionRequired?: unknown },
>(rows: T[], from?: string | null, to?: string | null): T[] {
  if (!from && !to) return rows;
  return rows.filter((row) => {
    if (row.actionRequired && !row.calendarDate) return true;
    if (!row.calendarDate) return false;
    if (from && row.calendarDate < from) return false;
    if (to && row.calendarDate > to) return false;
    return true;
  });
}

export function shouldNotifyCustomerFacing(
  beforeFingerprint: string | null,
  afterFingerprint: string | null,
): boolean {
  if (!afterFingerprint) return false;
  return beforeFingerprint !== afterFingerprint;
}

export type DealerNotifyTemplate =
  | 'DELIVERY_DATE_UPDATED'
  | 'DELIVERY_MAY_BE_DELAYED'
  | 'DELIVERY_COMPLETED';

export function selectDealerNotifyTemplate(
  status: CustomerDeliveryStatus,
  opts?: { alreadySentConfirmed?: boolean },
): DealerNotifyTemplate | null {
  if (status === 'CANCELLED') return null;
  if (status === 'DELIVERED') return 'DELIVERY_COMPLETED';
  if (status === 'MAY_BE_DELAYED' || status === 'DELAYED') return 'DELIVERY_MAY_BE_DELAYED';
  if (status === 'CONFIRMED_ON_TRACK' && opts?.alreadySentConfirmed) return null;
  if (status === 'READY_FOR_DELIVERY' || status === 'OUT_FOR_DELIVERY') return null;
  return 'DELIVERY_DATE_UPDATED';
}

export function customerFacingFingerprint(input: {
  committedYmd: string | null;
  suggestedYmd: string | null;
  projectedYmd: string | null;
  customerStatus: CustomerDeliveryStatus;
  actualYmd: string | null;
}): string {
  return [
    input.committedYmd ?? '',
    input.suggestedYmd ?? '',
    input.projectedYmd ?? '',
    input.customerStatus,
    input.actualYmd ?? '',
  ].join('|');
}

export function startOfWeekSunday(ymd: string): string {
  const parsed = parseYmd(ymd) ?? { year: 1970, month: 1, day: 1 };
  const dt = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function summarizeDealerDeliveries(
  rows: Array<{ customerStatus: CustomerDeliveryStatus; calendarDate: string | null }>,
  todayYmd: string,
) {
  const weekStart = startOfWeekSunday(todayYmd);
  const weekEnd = addDaysYmd(weekStart, 6);
  let upcoming = 0;
  let thisWeek = 0;
  let awaitingConfirmation = 0;
  let mayBeDelayed = 0;
  for (const row of rows) {
    if (row.customerStatus === 'CANCELLED' || row.customerStatus === 'DELIVERED') continue;
    if (row.calendarDate && row.calendarDate >= todayYmd) upcoming += 1;
    if (row.calendarDate && row.calendarDate >= weekStart && row.calendarDate <= weekEnd) thisWeek += 1;
    if (row.customerStatus === 'AWAITING_CONFIRMATION') awaitingConfirmation += 1;
    if (row.customerStatus === 'MAY_BE_DELAYED' || row.customerStatus === 'DELAYED') mayBeDelayed += 1;
  }
  return { upcoming, thisWeek, awaitingConfirmation, mayBeDelayed };
}
