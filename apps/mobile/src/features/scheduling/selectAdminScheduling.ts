import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type { AtRiskOrder, CalendarDay, ScheduleOrderCard, SchedulingDashboard } from '@/api/modules/scheduling';
import {
  adminLoadDensity,
  adminLoadTone,
  type DayMeta,
} from '@/components/calendar';

export type AdminScheduleStat = {
  key: 'today' | 'week' | 'awaitingApproval' | 'atRisk' | 'conflicts';
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
};

export type ScheduleFocusKey = AdminScheduleStat['key'];

/** Stat chips for the top of the admin scheduling dashboard. */
export function selectDashboardStats(dashboard: SchedulingDashboard | undefined): AdminScheduleStat[] {
  if (!dashboard) return [];
  return [
    { key: 'today', value: dashboard.todayCount, tone: 'neutral' },
    { key: 'week', value: dashboard.weekCount, tone: 'neutral' },
    {
      key: 'awaitingApproval',
      value: dashboard.awaitingApproval,
      tone: dashboard.awaitingApproval > 0 ? 'warning' : 'neutral',
    },
    { key: 'atRisk', value: dashboard.atRisk, tone: dashboard.atRisk > 0 ? 'danger' : 'neutral' },
    { key: 'conflicts', value: dashboard.conflicts, tone: dashboard.conflicts > 0 ? 'danger' : 'neutral' },
  ];
}

/**
 * Sunday–Saturday week range in local calendar days (matches dashboard weekCount).
 */
export function weekRangeFromYmd(anchorYmd: string): { from: string; to: string } {
  const [ys, ms, ds] = anchorYmd.split('-').map(Number);
  const anchor = new Date(ys!, (ms ?? 1) - 1, ds ?? 1);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

/** Shift a YMD date by `delta` local calendar days. */
export function addDaysToYmd(anchorYmd: string, delta: number): string {
  const [ys, ms, ds] = anchorYmd.split('-').map(Number);
  const dt = new Date(ys!, (ms ?? 1) - 1, ds ?? 1);
  dt.setDate(dt.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export type WeekStripDay = {
  date: string;
  isToday: boolean;
  isWorking: boolean;
  orderCount: number;
};

/** 7-day count strip — deliberately NOT a Gantt: just per-day order load. */
export function selectWeekStrip(
  days: CalendarDay[] | undefined,
  orders: ScheduleOrderCard[] | undefined,
  todayIso: string,
): WeekStripDay[] {
  if (!days?.length) return [];
  const countsByDay = new Map<string, number>();
  for (const order of orders ?? []) {
    if (!order.plannedStart) continue;
    const day = order.plannedStart.slice(0, 10);
    countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
  }
  const today = todayIso.slice(0, 10);
  return days.map((d) => ({
    date: d.date,
    isToday: d.date === today,
    isWorking: d.isWorking,
    orderCount: countsByDay.get(d.date) ?? 0,
  }));
}

export type MonthDayLoad = 'closed' | 'empty' | 'light' | 'half' | 'busy';

export type MonthDayMetaModel = {
  isWorking: boolean;
  orderCount: number;
  load: MonthDayLoad;
};

function orderIntersectsDay(order: ScheduleOrderCard, ymd: string): boolean {
  const start = (order.plannedStart ?? '').slice(0, 10);
  const end = (order.plannedEnd ?? order.plannedStart ?? '').slice(0, 10);
  if (!start) return false;
  const endYmd = end || start;
  return ymd >= start && ymd <= endYmd;
}

/** Count orders whose planned window intersects the day. */
export function countOrdersForDay(
  orders: ScheduleOrderCard[] | undefined,
  ymd: string,
): number {
  if (!orders?.length) return 0;
  let n = 0;
  for (const order of orders) {
    if (orderIntersectsDay(order, ymd)) n += 1;
  }
  return n;
}

/**
 * Per-day load for the admin month board.
 * closed → empty(0) → light(1–2) → half(3–5) → busy(6+)
 */
export function selectMonthDayMeta(
  days: CalendarDay[] | undefined,
  orders: ScheduleOrderCard[] | undefined,
): Record<string, MonthDayMetaModel & { dayMeta: DayMeta }> {
  const out: Record<string, MonthDayMetaModel & { dayMeta: DayMeta }> = {};
  if (!days?.length) return out;
  for (const day of days) {
    const ymd = day.date.slice(0, 10);
    const orderCount = countOrdersForDay(orders, ymd);
    const tone = adminLoadTone(orderCount, day.isWorking);
    const load = tone as MonthDayLoad;
    out[ymd] = {
      isWorking: day.isWorking,
      orderCount,
      load,
      dayMeta: {
        tone,
        density: adminLoadDensity(orderCount, day.isWorking),
        disabled: !day.isWorking,
      },
    };
  }
  return out;
}

/** Orders whose planned window intersects `ymd`, for the day-detail panel. */
export function selectOrdersForDay(
  orders: ScheduleOrderCard[] | undefined,
  ymd: string,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!orders?.length || !ymd) return [];
  const seen = new Set<string>();
  const result: AdminScheduleCardModel[] = [];
  for (const order of orders) {
    if (!orderIntersectsDay(order, ymd)) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

/** Orders whose planned window intersects any day in `[fromYmd, toYmd]` (inclusive). */
export function selectOrdersInRange(
  orders: ScheduleOrderCard[] | undefined,
  fromYmd: string,
  toYmd: string,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!orders?.length || !fromYmd || !toYmd) return [];
  const seen = new Set<string>();
  const result: AdminScheduleCardModel[] = [];
  for (const order of orders) {
    const start = (order.plannedStart ?? '').slice(0, 10);
    const end = (order.plannedEnd ?? order.plannedStart ?? '').slice(0, 10) || start;
    if (!start) continue;
    if (end < fromYmd || start > toYmd) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

/** Orders flagged with a schedule conflict in the calendar payload. */
export function selectConflictCards(
  orders: ScheduleOrderCard[] | undefined,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!orders?.length) return [];
  const seen = new Set<string>();
  const result: AdminScheduleCardModel[] = [];
  for (const order of orders) {
    if (!order.hasConflict) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

/** Flatten month meta into MonthCalendar dayMeta map. */
export function selectAdminCalendarDayMeta(
  days: CalendarDay[] | undefined,
  orders: ScheduleOrderCard[] | undefined,
): Record<string, DayMeta> {
  const month = selectMonthDayMeta(days, orders);
  const out: Record<string, DayMeta> = {};
  for (const [ymd, row] of Object.entries(month)) {
    out[ymd] = row.dayMeta;
  }
  return out;
}

export type AdminScheduleCardModel = {
  id: string;
  productionOrderId: string;
  number: string;
  title: string;
  dealerName: string | null;
  imageUrl: string | null;
  priority: string | null;
  quantity: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  status: string | null;
  promiseState: string | null;
  materialRisk: boolean;
  hasConflict: boolean;
  reason: string | null;
  /** Present only when the source card carries a schedule version (approvals list). */
  scheduleVersion: number | null;
  requiredDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
};

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

function toScheduleCard(order: ScheduleOrderCard, locale: string): AdminScheduleCardModel {
  return {
    id: order.id,
    productionOrderId: order.productionOrderId,
    number: order.number,
    title: localizedName(
      asLocale(locale),
      { nameEn: order.productName, nameAr: order.productNameAr, nameHe: order.productNameHe },
      order.number,
    ),
    dealerName:
      localizedName(
        asLocale(locale),
        { nameEn: order.dealerName, nameAr: order.dealerNameAr, nameHe: order.dealerNameHe },
        '',
      ) || null,
    imageUrl: order.imageUrl ?? null,
    priority: order.priority ?? null,
    quantity: order.quantity ?? null,
    plannedStart: order.plannedStart ?? null,
    plannedEnd: order.plannedEnd ?? null,
    status: order.status ?? null,
    promiseState: order.promiseState ?? null,
    materialRisk: Boolean(order.materialRisk),
    hasConflict: Boolean(order.hasConflict),
    reason: order.conflictReason ?? null,
    scheduleVersion: order.version ?? null,
    requiredDeliveryDate: null,
    suggestedDeliveryDate: null,
  };
}

const APPROVAL_STATUSES = new Set(['PROPOSED', 'NEEDS_REVIEW']);

/** Orders whose latest schedule needs an admin decision — sourced from the calendar window. */
export function selectApprovalsWaiting(
  orders: ScheduleOrderCard[] | undefined,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!orders?.length) return [];
  const seen = new Set<string>();
  const result: AdminScheduleCardModel[] = [];
  for (const order of orders) {
    if (!order.status || !APPROVAL_STATUSES.has(order.status)) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

/** May-be-late orders (material risk, needs review, or admin-estimate-review) from the dedicated endpoint. */
export function selectAtRiskCards(
  atRisk: AtRiskOrder[] | undefined,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!atRisk?.length) return [];
  return atRisk.map((order) => ({
    id: order.productionOrderId,
    productionOrderId: order.productionOrderId,
    number: order.number,
    title: localizedName(
      asLocale(locale),
      { nameEn: order.productName, nameAr: order.productNameAr, nameHe: order.productNameHe },
      order.number,
    ),
    dealerName:
      localizedName(
        asLocale(locale),
        { nameEn: order.dealerName, nameAr: order.dealerNameAr, nameHe: order.dealerNameHe },
        '',
      ) || null,
    imageUrl: order.imageUrl ?? null,
    priority: order.priority ?? null,
    quantity: null,
    plannedStart: null,
    plannedEnd: null,
    status: order.scheduleStatus,
    promiseState: null,
    materialRisk: order.materialRisk,
    hasConflict: false,
    reason: order.reason,
    scheduleVersion: null,
    requiredDeliveryDate: order.requiredDeliveryDate,
    suggestedDeliveryDate: order.suggestedDeliveryDate,
  }));
}

export type AdminScheduleActionMode = 'approve' | 'changeDate' | 'recalculate';

/** Which actions make sense for a given card — approve requires a known schedule version. */
export function selectAvailableActions(card: AdminScheduleCardModel): AdminScheduleActionMode[] {
  const actions: AdminScheduleActionMode[] = [];
  if (card.scheduleVersion != null && APPROVAL_STATUSES.has(card.status ?? '')) {
    actions.push('approve');
  }
  actions.push('changeDate', 'recalculate');
  return actions;
}

/** Client filter for schedule order boards — number, product, dealer, status, reason. */
export function filterScheduleCards(
  cards: AdminScheduleCardModel[],
  query: string,
): AdminScheduleCardModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;
  return cards.filter((card) => {
    const haystack = [
      card.number,
      card.title,
      card.dealerName,
      card.status,
      card.priority,
      card.reason,
      card.promiseState,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
