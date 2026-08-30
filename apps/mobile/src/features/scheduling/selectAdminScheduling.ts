import { localizedName } from '@maher/i18n';
import type { Locale } from '@maher/types';
import type {
  AtRiskOrder,
  AtRiskRecommendedAction,
  CalendarDay,
  CanonicalRiskStatus,
  ScheduleOrderCard,
  SchedulingDashboard,
} from '@/api/modules/scheduling';
import {
  adminFactoryLoadDensity,
  adminFactoryLoadTone,
  type DayMeta,
} from '@/components/calendar';

export type AdminScheduleStat = {
  key: 'today' | 'week' | 'awaitingApproval' | 'atRisk' | 'conflicts';
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
};

export type ScheduleFocusKey = AdminScheduleStat['key'];

/** Chip count for Conflicts: unique active operational overlaps only. */
export function selectConflictBarCount(
  uniqueConflicts: { length: number } | number | undefined,
): number {
  if (typeof uniqueConflicts === 'number') return uniqueConflicts;
  return uniqueConflicts?.length ?? 0;
}

/** Stat chips for the top of the admin scheduling dashboard. */
export function selectDashboardStats(
  dashboard: SchedulingDashboard | undefined,
  opts?: { atRiskCount?: number; conflictCount?: number; awaitingApprovalCount?: number },
): AdminScheduleStat[] {
  if (!dashboard) return [];
  const atRisk = opts?.atRiskCount ?? dashboard.atRisk;
  const conflicts = opts?.conflictCount ?? dashboard.conflicts;
  const awaiting = opts?.awaitingApprovalCount ?? dashboard.awaitingApproval;
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
  pinnedOnClosedDayCount: number;
};

function orderIntersectsDay(order: ScheduleOrderCard, ymd: string): boolean {
  if (order.occupiedDates) {
    return order.occupiedDates.includes(ymd);
  }
  const start = (order.plannedStart ?? '').slice(0, 10);
  const end = (order.plannedEnd ?? order.plannedStart ?? '').slice(0, 10);
  if (!start) return false;
  const endYmd = end || start;
  return ymd >= start && ymd <= endYmd;
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
 * Per-day load for the admin month board from factory load %
 * (working-minute allocated / available), not order count.
 * closed → empty(0%) → light(1–49%) → half(50–84%) → busy(85–100%)
 */
export function selectMonthDayMeta(
  days: CalendarDay[] | undefined,
  orders: ScheduleOrderCard[] | undefined,
  factoryLoadByDay: Record<string, number | null> = {},
): Record<string, MonthDayMetaModel & { dayMeta: DayMeta }> {
  const out: Record<string, MonthDayMetaModel & { dayMeta: DayMeta }> = {};
  if (!days?.length) return out;
  for (const day of days) {
    const ymd = day.date.slice(0, 10);
    const orderCount = countOrdersForDay(orders, ymd);
    const loadPercent = factoryLoadByDay[ymd];
    const tone = adminFactoryLoadTone(loadPercent, day.isWorking);
    const load = tone as MonthDayLoad;
    out[ymd] = {
      isWorking: day.isWorking,
      orderCount,
      load,
      pinnedOnClosedDayCount: day.isWorking ? 0 : (day.pinnedOnClosedDayCount ?? 0),
      dayMeta: {
        tone,
        density: adminFactoryLoadDensity(loadPercent, day.isWorking),
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
    if (!orderIntersectsRange(order, fromYmd, toYmd)) continue;
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
  factoryLoadByDay: Record<string, number | null> = {},
): Record<string, DayMeta> {
  const month = selectMonthDayMeta(days, orders, factoryLoadByDay);
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
  committedDeliveryDate?: string | null;
  earliestAvailableDate?: string | null;
  requestedDateFeasible?: boolean | null;
  unschedulableReason?: string | null;
  requiresAdminEstimateReview?: boolean;
  planningMode?: string | null;
  materialReadyAt?: string | null;
  committedCompletionDate?: string | null;
  productionDeadline?: string | null;
  deliveryBufferWorkingDays?: number | null;
  riskStatus?: CanonicalRiskStatus | string | null;
  reasonCode?: string | null;
  reasonLabel?: string | null;
  recommendedAction?: AtRiskRecommendedAction | string | null;
  recoverableAutomatically?: boolean;
  projectedCompletion?: string | null;
  earliestFeasibleDate?: string | null;
  stageName?: string | null;
  requiredWip?: string | null;
  producedBy?: string | null;
  currentStage?: string | null;
  missingMaterial?: string | null;
  stageAtCapacity?: string | null;
  productId?: string | null;
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
    requiredDeliveryDate: order.requestedDeliveryDate ?? null,
    suggestedDeliveryDate: order.suggestedDeliveryDate ?? null,
    committedDeliveryDate: order.committedDeliveryDate ?? null,
    earliestAvailableDate: order.earliestAvailableDate ?? null,
    requestedDateFeasible: order.requestedDateFeasible ?? null,
    unschedulableReason: order.unschedulableReason ?? null,
    requiresAdminEstimateReview: Boolean(order.requiresAdminEstimateReview),
    planningMode: order.planningMode ?? null,
    materialReadyAt: order.materialReadyAt ?? null,
    committedCompletionDate: order.committedCompletionDate ?? null,
    productionDeadline: order.productionDeadline ?? null,
    deliveryBufferWorkingDays: order.deliveryBufferWorkingDays ?? null,
  };
}

const APPROVAL_STATUSES = new Set(['PROPOSED']);

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

/** May-be-late orders from GET /scheduling/at-risk (canonical LATE | AT_RISK | BLOCKED). */
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
    scheduleVersion: order.scheduleVersion ?? order.version ?? null,
    riskStatus: order.riskStatus ?? null,
    reasonCode: order.reasonCode ?? null,
    reasonLabel: order.reasonLabel ?? null,
    recommendedAction: order.recommendedAction ?? null,
    recoverableAutomatically: Boolean(order.recoverableAutomatically),
    projectedCompletion: order.projectedCompletion ?? order.earliestAvailableDate ?? null,
    earliestFeasibleDate: order.earliestFeasibleDate ?? order.earliestAvailableDate ?? null,
    stageName: order.stageName ?? null,
    requiredWip: order.requiredWip ?? null,
    producedBy: order.producedBy ?? null,
    currentStage: order.currentStage ?? null,
    missingMaterial: order.missingMaterial ?? null,
    stageAtCapacity: order.stageAtCapacity ?? null,
    productId: order.productId ?? null,
    requiredDeliveryDate: order.requestedDeliveryDate ?? order.requiredDeliveryDate,
    suggestedDeliveryDate: order.suggestedDeliveryDate,
    committedDeliveryDate: order.committedDeliveryDate ?? null,
    earliestAvailableDate: order.earliestAvailableDate ?? null,
    requestedDateFeasible: order.requestedDateFeasible ?? null,
    unschedulableReason: order.unschedulableReason ?? null,
    requiresAdminEstimateReview: Boolean(order.requiresAdminEstimateReview),
    planningMode: order.planningMode ?? null,
    materialReadyAt: order.materialReadyAt ?? null,
    committedCompletionDate: order.committedCompletionDate ?? null,
    productionDeadline: order.productionDeadline ?? null,
    deliveryBufferWorkingDays: order.deliveryBufferWorkingDays ?? null,
  }));
}

export type ApprovableScheduleTarget = {
  productionOrderId: string;
  version: number;
};

/** Approve-all only includes PROPOSED cards that still have a version. */
export function selectApprovableScheduleTargets(
  cards: AdminScheduleCardModel[],
): ApprovableScheduleTarget[] {
  const seen = new Set<string>();
  const out: ApprovableScheduleTarget[] = [];
  for (const card of cards) {
    if (card.scheduleVersion == null) continue;
    if (!APPROVAL_STATUSES.has(card.status ?? '')) continue;
    if (seen.has(card.productionOrderId)) continue;
    seen.add(card.productionOrderId);
    out.push({ productionOrderId: card.productionOrderId, version: card.scheduleVersion });
  }
  return out;
}

export function scheduleSourceFromCard(card: AdminScheduleCardModel) {
  return {
    requestedDeliveryDate: card.requiredDeliveryDate,
    suggestedDeliveryDate: card.suggestedDeliveryDate,
    committedDeliveryDate: card.committedDeliveryDate,
    earliestAvailableDate: card.earliestAvailableDate,
    requestedDateFeasible: card.requestedDateFeasible,
    unschedulableReason: card.unschedulableReason,
    materialRisk: card.materialRisk,
    requiresAdminEstimateReview: card.requiresAdminEstimateReview,
    scheduleStatus: card.status,
    promiseState: card.promiseState,
    planningMode: card.planningMode,
    materialReadyAt: card.materialReadyAt,
    committedCompletionDate: card.committedCompletionDate,
    productionDeadline: card.productionDeadline,
    deliveryBufferWorkingDays: card.deliveryBufferWorkingDays,
    plannedStart: card.plannedStart,
    plannedEnd: card.plannedEnd,
    riskStatus: card.riskStatus,
    reasonCode: card.reasonCode,
  };
}

export function selectAtRiskStatusKey(status?: string | null): string {
  if (status === 'LATE') return 'mobile.adminScheduling.atRisk.statusLate';
  if (status === 'BLOCKED') return 'mobile.adminScheduling.blocked.title';
  return 'mobile.adminScheduling.atRisk.statusMayBeLate';
}

export function selectAtRiskActionKey(action?: string | null): string {
  switch (action) {
    case 'RECALCULATE':
      return 'mobile.adminScheduling.sheets.recalculateTitle';
    case 'REVIEW_ESTIMATES':
      return 'mobile.adminScheduling.atRisk.reviewEstimates';
    case 'VIEW_PRODUCTION':
      return 'mobile.adminScheduling.atRisk.viewProduction';
    case 'MANAGE_WORKERS':
      return 'mobile.adminScheduling.atRisk.manageWorkers';
    case 'REVIEW_COMMITMENT':
      return 'mobile.adminScheduling.atRisk.reviewCommitment';
    case 'VIEW_MATERIALS':
      return 'mobile.adminScheduling.atRisk.viewMaterials';
    default:
      return 'mobile.adminScheduling.atRisk.recommendedAction';
  }
}

export function selectAtRiskReasonKey(card: AdminScheduleCardModel): string {
  if (card.reasonLabel) return card.reasonLabel;
  if (card.reasonCode === 'DURATION_ESTIMATE_REVIEW') return 'mobile.adminScheduling.reasons.estimateReview';
  if (card.reasonCode === 'COMMITTED_DATE_TOO_EARLY') return 'mobile.adminScheduling.atRisk.committedCannotBeMet';
  if (card.reasonCode === 'LATE') return 'mobile.adminScheduling.atRisk.statusLate';
  if (card.unschedulableReason) {
    const mapped: Record<string, string> = {
      NO_ELIGIBLE_WORKER: 'mobile.adminScheduling.reasons.noEligibleWorker',
      MATERIAL_NOT_READY: 'mobile.adminScheduling.reasons.materialNotReady',
      WIP_NOT_READY: 'mobile.adminScheduling.reasons.wipNotReady',
      NO_RESOURCE_CAPACITY: 'mobile.adminScheduling.reasons.capacity',
    };
    return mapped[card.unschedulableReason] ?? 'mobile.adminScheduling.reasons.unknown';
  }
  return 'mobile.adminScheduling.reasons.unknown';
}

/** Group remaining resolve-all reasons so list keys stay unique. */
export function selectAtRiskReasonGroups(
  rows: Array<{ stillNeedsAttention?: boolean; reasonLabel?: string | null }>,
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.stillNeedsAttention || !row.reasonLabel) continue;
    counts.set(row.reasonLabel, (counts.get(row.reasonLabel) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

export function selectDaysLate(promisedIso?: string | null, projectedIso?: string | null): number | null {
  if (!promisedIso || !projectedIso) return null;
  const promised = promisedIso.slice(0, 10);
  const projected = projectedIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(promised) || !/^\d{4}-\d{2}-\d{2}$/.test(projected)) return null;
  const [py, pm, pd] = promised.split('-').map(Number);
  const [ty, tm, td] = projected.split('-').map(Number);
  const delta = Math.round(
    (Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1) - Date.UTC(py!, (pm ?? 1) - 1, pd ?? 1)) / 86_400_000,
  );
  return delta > 0 ? delta : null;
}

export type AdminScheduleActionMode = 'approve' | 'changeDate' | 'recalculate';

/** Which actions make sense for a given card — approve requires a known schedule version. */
export function selectAvailableActions(
  card: AdminScheduleCardModel,
  perms?: { canApprove?: boolean; canManage?: boolean },
): AdminScheduleActionMode[] {
  const actions: AdminScheduleActionMode[] = [];
  const canApprove = perms?.canApprove !== false;
  const canManage = perms?.canManage !== false;
  if (canApprove && card.scheduleVersion != null && APPROVAL_STATUSES.has(card.status ?? '')) {
    actions.push('approve');
  }
  if (canManage && card.recommendedAction === 'RECALCULATE') {
    actions.push('recalculate');
  } else if (canManage && card.recommendedAction === 'REVIEW_COMMITMENT') {
    actions.push('changeDate');
  } else if (canManage && !card.riskStatus) {
    actions.push('changeDate', 'recalculate');
  }
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
