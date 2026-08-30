import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type {
  AtRiskOrder,
  CalendarDay,
  ScheduleOrderCard,
  SchedulingDashboard,
} from './scheduling';
import { addDays, parseYmd, ymd } from './scheduling';

export type LoadTone = 'closed' | 'empty' | 'light' | 'half' | 'busy';

export type ScheduleFocusKey = 'today' | 'week' | 'awaitingApproval' | 'atRisk' | 'conflicts';

export type AdminScheduleStat = {
  key: ScheduleFocusKey;
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
};

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
  scheduleVersion: number | null;
  requiredDeliveryDate: string | null;
  suggestedDeliveryDate: string | null;
};

export type AdminScheduleActionMode = 'approve' | 'changeDate' | 'recalculate';

export type MonthDayMeta = {
  isWorking: boolean;
  orderCount: number;
  load: LoadTone;
  density: number;
};

const APPROVAL_STATUSES = new Set(['PROPOSED', 'NEEDS_REVIEW']);

function asLocale(locale: string): Locale {
  return locale === 'ar' || locale === 'he' || locale === 'en' ? locale : 'en';
}

export function todayYmd(now = new Date()): string {
  return ymd(now);
}

export function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthRangeYmd(year: number, monthIndex: number): { from: string; to: string } {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return { from: toYmd(year, monthIndex, 1), to: toYmd(year, monthIndex, last) };
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { y: number; m: number } {
  const next = new Date(year, monthIndex + delta, 1);
  return { y: next.getFullYear(), m: next.getMonth() };
}

/** Monday-first month cells (null = padding). */
export function buildMonthCells(year: number, monthIndex: number): Array<number | null> {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function weekRangeFromYmd(anchorYmd: string): { from: string; to: string } {
  const anchor = parseYmd(anchorYmd);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
  const end = addDays(start, 6);
  return { from: ymd(start), to: ymd(end) };
}

export function adminLoadTone(orderCount: number, isWorking: boolean): LoadTone {
  if (!isWorking) return 'closed';
  if (orderCount <= 0) return 'empty';
  if (orderCount <= 2) return 'light';
  if (orderCount <= 5) return 'half';
  return 'busy';
}

export function adminLoadDensity(orderCount: number, isWorking: boolean): number {
  if (!isWorking || orderCount <= 0) return 0;
  if (orderCount <= 2) return 1;
  if (orderCount <= 5) return 2;
  return 3;
}

export function orderIntersectsDay(order: ScheduleOrderCard, dayYmd: string): boolean {
  if (order.occupiedDates) {
    return order.occupiedDates.includes(dayYmd);
  }
  const start = (order.plannedStart ?? '').slice(0, 10);
  const end = (order.plannedEnd ?? order.plannedStart ?? '').slice(0, 10);
  if (!start) return false;
  const endYmd = end || start;
  return dayYmd >= start && dayYmd <= endYmd;
}

function orderIntersectsRange(order: ScheduleOrderCard, fromYmd: string, toYmd: string): boolean {
  if (order.occupiedDates) {
    return order.occupiedDates.some((d) => d >= fromYmd && d <= toYmd);
  }
  const start = (order.plannedStart ?? '').slice(0, 10);
  const end = (order.plannedEnd ?? order.plannedStart ?? '').slice(0, 10) || start;
  if (!start) return false;
  return end >= fromYmd && start <= toYmd;
}

export function countOrdersForDay(orders: ScheduleOrderCard[] | undefined, dayYmd: string): number {
  if (!orders?.length) return 0;
  let n = 0;
  for (const order of orders) {
    if (orderIntersectsDay(order, dayYmd)) n += 1;
  }
  return n;
}

export function formatYmdLabel(value: string | null | undefined, locale: string): string {
  const key = (value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '—';
  return parseYmd(key).toLocaleDateString(
    locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

export function selectDashboardStats(dashboard: SchedulingDashboard | undefined): AdminScheduleStat[] {
  if (!dashboard) return [];
  const awaiting = dashboard.awaitingApproval ?? dashboard.approvalsWaiting ?? 0;
  const atRisk = dashboard.atRisk ?? 0;
  const conflicts = dashboard.conflicts ?? 0;
  return [
    { key: 'today', value: dashboard.todayCount, tone: 'neutral' },
    { key: 'week', value: dashboard.weekCount, tone: 'neutral' },
    {
      key: 'awaitingApproval',
      value: awaiting,
      tone: awaiting > 0 ? 'warning' : 'neutral',
    },
    { key: 'atRisk', value: atRisk, tone: atRisk > 0 ? 'danger' : 'neutral' },
    { key: 'conflicts', value: conflicts, tone: conflicts > 0 ? 'danger' : 'neutral' },
  ];
}

export function selectMonthDayMeta(
  days: CalendarDay[] | undefined,
  orders: ScheduleOrderCard[] | undefined,
): Record<string, MonthDayMeta> {
  const out: Record<string, MonthDayMeta> = {};
  if (!days?.length) return out;
  for (const day of days) {
    const key = day.date.slice(0, 10);
    const orderCount = countOrdersForDay(orders, key);
    out[key] = {
      isWorking: day.isWorking,
      orderCount,
      load: adminLoadTone(orderCount, day.isWorking),
      density: adminLoadDensity(orderCount, day.isWorking),
    };
  }
  return out;
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

export function selectOrdersForDay(
  orders: ScheduleOrderCard[] | undefined,
  dayYmd: string,
  locale = 'en',
): AdminScheduleCardModel[] {
  if (!orders?.length || !dayYmd) return [];
  const seen = new Set<string>();
  const result: AdminScheduleCardModel[] = [];
  for (const order of orders) {
    if (!orderIntersectsDay(order, dayYmd)) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

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
    if (!orderIntersectsRange(order, fromYmd, toYmd)) continue;
    if (seen.has(order.productionOrderId)) continue;
    seen.add(order.productionOrderId);
    result.push(toScheduleCard(order, locale));
  }
  return result.sort((a, b) => (a.plannedStart ?? '').localeCompare(b.plannedStart ?? ''));
}

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
    reason: order.reasonLabel ?? order.reason,
    scheduleVersion: null,
    requiredDeliveryDate: order.requiredDeliveryDate,
    suggestedDeliveryDate: order.suggestedDeliveryDate,
  }));
}

export function selectAvailableActions(card: AdminScheduleCardModel): AdminScheduleActionMode[] {
  const actions: AdminScheduleActionMode[] = [];
  if (card.scheduleVersion != null && APPROVAL_STATUSES.has(card.status ?? '')) {
    actions.push('approve');
  }
  actions.push('changeDate', 'recalculate');
  return actions;
}

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
