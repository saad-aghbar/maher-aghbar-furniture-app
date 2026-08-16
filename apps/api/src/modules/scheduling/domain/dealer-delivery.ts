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

const IN_PRODUCTION_PO = new Set([
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
]);

const CANCELLED = new Set(['CANCELLED']);
const DELIVERED_SO = new Set(['DELIVERED', 'COMPLETED']);

export type DealerDeliveryFacts = {
  salesOrderStatus?: string | null;
  productionOrderStatus?: string | null;
  deliveryStatus?: string | null;
  requestedYmd: string | null;
  suggestedYmd: string | null;
  committedYmd: string | null;
  projectedYmd: string | null;
  actualYmd: string | null;
  todayYmd: string;
  canUpdateDeliveryDate?: boolean;
  canRequestDateChange?: boolean;
};

export type DealerDeliveryView = {
  customerStatus: CustomerDeliveryStatus;
  calendarDate: string | null;
  requiresDealerAttention: boolean;
  customerSafeReason: string | null;
  compactDates: boolean;
  delayDays: number | null;
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

  if (committed) {
    if (today > committed) return 'DELAYED';
    if (projected && projected > committed && today <= committed) return 'MAY_BE_DELAYED';
    if (IN_PRODUCTION_PO.has(po) || so === 'IN_PRODUCTION') return 'IN_PRODUCTION';
    return 'CONFIRMED_ON_TRACK';
  }

  return 'AWAITING_CONFIRMATION';
}

export function calendarDateForDealer(facts: {
  customerStatus: CustomerDeliveryStatus;
  actualYmd: string | null;
  committedYmd: string | null;
  suggestedYmd: string | null;
  requestedYmd: string | null;
}): string | null {
  if (facts.customerStatus === 'DELIVERED') return facts.actualYmd ?? facts.committedYmd;
  if (facts.committedYmd) return facts.committedYmd;
  if (facts.suggestedYmd) return facts.suggestedYmd;
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

export function buildDealerDeliveryView(facts: DealerDeliveryFacts): DealerDeliveryView {
  const customerStatus = mapCustomerDeliveryStatus(facts);
  const calendarDate = calendarDateForDealer({
    customerStatus,
    actualYmd: facts.actualYmd,
    committedYmd: facts.committedYmd,
    suggestedYmd: facts.suggestedYmd,
    requestedYmd: facts.requestedYmd,
  });
  const delayed = customerStatus === 'MAY_BE_DELAYED' || customerStatus === 'DELAYED';
  const delayDays =
    delayed && facts.committedYmd && facts.projectedYmd && facts.projectedYmd > facts.committedYmd
      ? daysBetweenYmd(facts.committedYmd, facts.projectedYmd)
      : null;
  const requiresDealerAttention = customerStatus === 'AWAITING_CONFIRMATION' || delayed;
  return {
    customerStatus,
    calendarDate,
    requiresDealerAttention,
    customerSafeReason: delayed ? CUSTOMER_SAFE_PRODUCTION_DELAY : null,
    compactDates: datesAreCompact(facts) && !delayed,
    delayDays,
  };
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
