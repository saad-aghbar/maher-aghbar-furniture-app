import { useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import {
  MonthCalendar,
  CalendarLegend,
  initialCursorFromValue,
  monthRangeYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { Divider } from '@/components/layout/Divider';
import { useNetwork } from '@/components/network/NetworkProvider';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { formatDate, formatDuration, formatIdentifier, formatTimeRange, useLocale } from '@/i18n';
import { AnimatedPressable, SkeletonShimmer, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { invalidateKeys, queryKeys } from '@/api/queryKeys';
import { OrderCardMedia } from '@/features/sales-orders/components/OrderCardMedia';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { useToast } from '@/components/feedback/Toast';
import {
  addCalendarException,
  approveSchedule,
  dealerDateChange,
  deleteCalendarException,
  getOrderSchedule,
  getReplanRun,
  isOwnOrderSchedule,
  recalculateSchedule,
  resolveAllAtRisk,
  resolveAllConflicts,
  resolveConflict,
  type ProductionScheduleDetail,
  type ResolveAllAtRiskResult,
} from '@/api/modules/scheduling';
import {
  AdminChangeScheduleDateSheet,
  AdminDayExceptionSheet,
  ApproveAllSchedulesSheet,
  ApproveScheduleSheet,
  ConflictHelpSheet,
  ConflictReviewSheet,
  AtRiskDetailSheet,
  AtRiskHelpSheet,
  RecalculateScheduleSheet,
  ResolveAllAtRiskSheet,
  ResolveConflictSheet,
} from './components/AdminScheduleSheets';
import { AtRiskOrderCard, atRiskActionIcon } from './components/AtRiskOrderCard';
import { FactoryCapacitySection } from './components/FactoryCapacitySection';
import { ScheduleExplanation } from './components/ScheduleExplanation';
import {
  useAtRiskQuery,
  useSchedulingCalendarQuery,
  useSchedulingCapacityQuery,
  useSchedulingConflictsQuery,
  useSchedulingDashboardQuery,
} from './query';
import { selectFactoryLoadByDay } from './selectFactoryCapacity';
import {
  filterScheduleCards,
  scheduleSourceFromCard,
  selectAdminCalendarDayMeta,
  selectApprovableScheduleTargets,
  selectApprovalsWaiting,
  selectAtRiskActionKey,
  selectAtRiskCards,
  selectAtRiskReasonGroups,
  selectAtRiskReasonKey,
  selectAtRiskStatusKey,
  selectAvailableActions,
  selectDaysLate,
  selectConflictBarCount,
  selectConflictCards,
  selectDashboardStats,
  selectMonthDayMeta,
  selectOrdersForDay,
  selectOrdersInRange,
  weekRangeFromYmd,
  type AdminScheduleActionMode,
  type AdminScheduleCardModel,
  type ScheduleFocusKey,
} from './selectAdminScheduling';
import {
  filterConflictRows,
  selectConflictRows,
  selectConflictTypeKey,
  selectShowPriority,
  selectUniqueConflictProductionOrderIds,
  type ConflictRowModel,
} from './selectScheduleDates';
import { pollReplanRun, selectReplanResultToast } from './pollReplanRun';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';

const FLOOR_ROW_ESTIMATE = 152;
const AT_RISK_ROW_ESTIMATE = 248;
const OVERLAP_ROW_ESTIMATE = 168;
const FLOOR_LIST_VISIBLE_ROWS = 3;
const SCHEDULE_MEDIA = 88;

function workerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function AdminSchedulingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const canApprove = can(user, 'schedule.approve');
  const canManage = can(user, 'schedule.manage');
  const canAdjustHours = can(user, 'schedule.settings.manage');
  const canViewMaterials = can(user, 'inventory.read');
  const canReviewEstimates = can(user, 'catalog.manage');
  const canManageUsers = can(user, 'user.manage');
  const { t, tPlural, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const today = todayYmd();
  const weekRange = useMemo(() => weekRangeFromYmd(today), [today]);
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [focus, setFocus] = useState<ScheduleFocusKey | null>(null);
  const [orderSearch, setOrderSearch] = useState('');

  const [selectedCard, setSelectedCard] = useState<AdminScheduleCardModel | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changeDateOpen, setChangeDateOpen] = useState(false);
  const [recalculateOpen, setRecalculateOpen] = useState(false);
  const [dayExceptionOpen, setDayExceptionOpen] = useState(false);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveDraft, setResolveDraft] = useState<{ ids: string[]; body: string; all?: boolean } | null>(null);
  const resolveIdsRef = useRef<string[]>([]);
  const resolveAllRef = useRef(false);
  const pageScrollRef = useRef<ScrollView>(null);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [conflictOverlapExpanded, setConflictOverlapExpanded] = useState(false);
  const [conflictHelpOpen, setConflictHelpOpen] = useState(false);
  const [atRiskHelpOpen, setAtRiskHelpOpen] = useState(false);
  const pendingAtRiskSheetRef = useRef<'recalculate' | 'changeDate' | null>(null);
  const [atRiskDetailOpen, setAtRiskDetailOpen] = useState(false);
  const [atRiskResolveOpen, setAtRiskResolveOpen] = useState(false);
  const [atRiskResolveResult, setAtRiskResolveResult] = useState<ResolveAllAtRiskResult | null>(null);
  const [reviewRow, setReviewRow] = useState<ConflictRowModel | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [userPullRefreshing, setUserPullRefreshing] = useState(false);
  const [bulkSnapshot, setBulkSnapshot] = useState<{
    focusCards: AdminScheduleCardModel[];
    conflictRows: ConflictRowModel[];
  } | null>(null);

  const monthRange = useMemo(() => monthRangeYmd(cursor), [cursor]);

  const dashboardQuery = useSchedulingDashboardQuery();
  const calendarQuery = useSchedulingCalendarQuery({
    from: monthRange.from,
    to: monthRange.to,
    view: 'month',
  });
  const atRiskQuery = useAtRiskQuery();
  const conflictsQuery = useSchedulingConflictsQuery();

  /** Always load the current week for today/week focus so lists stay filled while the month cursor resets. */
  const needsWeekWindow = focus === 'today' || focus === 'week' || focus === 'conflicts';

  const weekCalendarQuery = useSchedulingCalendarQuery(
    needsWeekWindow
      ? { from: weekRange.from, to: weekRange.to, view: 'week' }
      : null,
    Boolean(needsWeekWindow),
  );

  const monthCapacityQuery = useSchedulingCapacityQuery({
    from: monthRange.from,
    to: monthRange.to,
    granularity: 'day',
  });

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.all });
    return Promise.all([
      dashboardQuery.refetch(),
      calendarQuery.refetch(),
      atRiskQuery.refetch(),
      conflictsQuery.refetch(),
      monthCapacityQuery.refetch(),
      needsWeekWindow ? weekCalendarQuery.refetch() : Promise.resolve(null),
    ]);
  };

  const onPullRefresh = () => {
    setUserPullRefreshing(true);
    void refetchAll().finally(() => setUserPullRefreshing(false));
  };

  const factoryLoadByDay = useMemo(
    () => selectFactoryLoadByDay(monthCapacityQuery.data, locale),
    [locale, monthCapacityQuery.data],
  );
  const dayMeta = useMemo(
    () =>
      selectAdminCalendarDayMeta(
        calendarQuery.data?.days,
        calendarQuery.data?.orders,
        factoryLoadByDay,
      ),
    [calendarQuery.data, factoryLoadByDay],
  );
  const monthMeta = useMemo(
    () =>
      selectMonthDayMeta(
        calendarQuery.data?.days,
        calendarQuery.data?.orders,
        factoryLoadByDay,
      ),
    [calendarQuery.data, factoryLoadByDay],
  );
  const dayOrders = useMemo(
    () => selectOrdersForDay(calendarQuery.data?.orders, selectedDay, locale),
    [calendarQuery.data?.orders, locale, selectedDay],
  );
  const selectedDayInfo = monthMeta[selectedDay];
  const calendarMeta = calendarQuery.data?.calendar as
    | {
        shiftStart?: string;
        shiftEnd?: string;
        exceptions?: Array<{
          date: string;
          type: string;
          shiftStart?: string | null;
          shiftEnd?: string | null;
        }>;
      }
    | undefined;
  const selectedDayException = (calendarMeta?.exceptions ?? []).find(
    (ex) => String(ex.date).slice(0, 10) === selectedDay,
  );

  const atRisk = useMemo(
    () => selectAtRiskCards(atRiskQuery.data?.data, locale),
    [atRiskQuery.data, locale],
  );
  const conflictRows = useMemo(
    () => selectConflictRows(conflictsQuery.data?.data),
    [conflictsQuery.data],
  );

  const focusSourceOrders = useMemo(() => {
    const monthOrders = calendarQuery.data?.orders ?? [];
    const weekOrders = weekCalendarQuery.data?.orders ?? [];
    if (!weekOrders.length) return monthOrders;
    if (!monthOrders.length) return weekOrders;
    const byId = new Map<string, (typeof monthOrders)[number]>();
    for (const order of [...monthOrders, ...weekOrders]) {
      byId.set(order.productionOrderId, order);
    }
    return [...byId.values()];
  }, [calendarQuery.data?.orders, weekCalendarQuery.data?.orders]);

  const conflictOrderCards = useMemo(
    () => selectConflictCards(focusSourceOrders, locale),
    [focusSourceOrders, locale],
  );
  const approvalCards = useMemo(
    () => selectApprovalsWaiting(focusSourceOrders, locale),
    [focusSourceOrders, locale],
  );
  const stats = useMemo(
    () =>
      selectDashboardStats(dashboardQuery.data, {
        atRiskCount: atRiskQuery.data?.data.length,
        conflictCount: selectConflictBarCount(conflictsQuery.data?.count ?? conflictRows),
        awaitingApprovalCount: approvalCards.length,
      }),
    [
      approvalCards.length,
      atRiskQuery.data?.data.length,
      conflictRows,
      conflictsQuery.data?.count,
      dashboardQuery.data,
    ],
  );
  const focusCards = useMemo(() => {
    if (!focus) return [];
    if (focus === 'today') return selectOrdersForDay(focusSourceOrders, today, locale);
    if (focus === 'week') {
      return selectOrdersInRange(focusSourceOrders, weekRange.from, weekRange.to, locale);
    }
    if (focus === 'awaitingApproval') return approvalCards;
    if (focus === 'atRisk') return atRisk;
    return conflictOrderCards;
  }, [
    approvalCards,
    atRisk,
    conflictOrderCards,
    focus,
    focusSourceOrders,
    locale,
    today,
    weekRange.from,
    weekRange.to,
  ]);

  const conflictLabelCards = useMemo(() => {
    const fromCalendar = (calendarQuery.data?.orders ?? []).map((order) => ({
      productionOrderId: order.productionOrderId,
      number: order.number,
    }));
    return [...fromCalendar, ...focusCards, ...dayOrders, ...atRisk];
  }, [atRisk, calendarQuery.data?.orders, dayOrders, focusCards]);
  const liveFocusCards = useMemo(
    () => filterScheduleCards(focusCards, orderSearch),
    [focusCards, orderSearch],
  );
  const liveConflictRows = useMemo(
    () => filterConflictRows(conflictRows, orderSearch, conflictLabelCards),
    [conflictLabelCards, conflictRows, orderSearch],
  );
  const visibleFocusCards = bulkSnapshot?.focusCards ?? liveFocusCards;
  const visibleConflictRows = bulkSnapshot?.conflictRows ?? liveConflictRows;
  const visibleDayOrders = useMemo(
    () => filterScheduleCards(dayOrders, orderSearch),
    [dayOrders, orderSearch],
  );
  const dayAtRiskCount = useMemo(
    () =>
      dayOrders.filter((order) =>
        atRisk.some((row) => row.productionOrderId === order.productionOrderId),
      ).length,
    [atRisk, dayOrders],
  );
  const dayConflictCount = useMemo(
    () =>
      conflictRows.filter((row) => row.startYmd === selectedDay).length,
    [conflictRows, selectedDay],
  );

  const focusEmptyKey =
    focus === 'today'
      ? 'mobile.adminScheduling.dayEmpty'
      : focus === 'week'
        ? 'mobile.adminScheduling.weekOrdersEmpty'
        : focus === 'awaitingApproval'
          ? 'mobile.adminScheduling.approvalsEmpty'
          : focus === 'atRisk'
            ? 'mobile.adminScheduling.atRiskEmpty'
            : focus === 'conflicts'
              ? 'mobile.adminScheduling.conflictsEmpty'
              : null;

  const onStatPress = (key: ScheduleFocusKey) => {
    void haptics.selection();
    if (focus === key) {
      setFocus(null);
      setOrderSearch('');
      return;
    }
    setFocus(key);
    setOrderSearch('');
    setOrdersExpanded(false);
    setConflictOverlapExpanded(false);
    if (key === 'today' || key === 'week') {
      setCursor(initialCursorFromValue(today));
      setSelectedDay(today);
    }
  };

  const invalidateAfterMutation = (productionOrderId: string) => {
    for (const key of invalidateKeys.afterScheduleMutation(productionOrderId)) {
      void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
    }
  };

  const jumpToScheduleStart = (detail: ProductionScheduleDetail) => {
    const allocations = detail.schedule?.allocations ?? [];
    if (allocations.length === 0) return;
    let minStart = allocations[0]!.plannedStart;
    for (const a of allocations) {
      if (a.plannedStart < minStart) minStart = a.plannedStart;
    }
    const ymd = minStart.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    setFocus(null);
    setSelectedDay(ymd);
    setCursor(initialCursorFromValue(ymd));
  };

  const mutationErrorMessage = (err: unknown) =>
    isApiError(err) || err instanceof Error
      ? toastMessageForError(err)
      : t('mobile.adminScheduling.sheets.genericError');

  const approveMutation = useMutation({
    mutationFn: async (vars: { id: string; version: number }) => {
      // Calendar cards can carry a stale version after replans; approve against latest.
      let version = vars.version;
      try {
        const latest = await getOrderSchedule(vars.id);
        if (!isOwnOrderSchedule(latest) && latest.schedule?.version != null) {
          version = latest.schedule.version;
        }
      } catch {
        // Fall back to the card version if the detail fetch fails.
      }
      return approveSchedule(vars.id, {
        version,
        idempotencyKey: `approve-${vars.id}-${Date.now()}`,
      });
    },
    onSuccess: (_data, vars) => {
      invalidateAfterMutation(vars.id);
      setApproveOpen(false);
      setMutationError(null);
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: t('mobile.adminScheduling.sheets.approveSuccess'),
      });
    },
    onError: (err) => setMutationError(mutationErrorMessage(err)),
  });

  const changeDateMutation = useMutation({
    mutationFn: async (vars: { id: string; isoDate: string; reason?: string }) => {
      await dealerDateChange(vars.id, {
        requestedDeliveryDate: vars.isoDate,
        reason: vars.reason,
        idempotencyKey: `admin-date-${vars.id}-${Date.now()}`,
      });
      return getOrderSchedule(vars.id);
    },
    onSuccess: (detail, vars) => {
      invalidateAfterMutation(vars.id);
      setChangeDateOpen(false);
      setMutationError(null);
      if (!isOwnOrderSchedule(detail)) jumpToScheduleStart(detail);
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: t('mobile.adminScheduling.sheets.changeDateSuccess'),
      });
    },
    onError: (err) => setMutationError(mutationErrorMessage(err)),
  });

  const recalculateMutation = useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      recalculateSchedule(vars.id, { reason: vars.reason }),
    onSuccess: (detail, vars) => {
      invalidateAfterMutation(vars.id);
      setRecalculateOpen(false);
      setMutationError(null);
      const unchanged = !isOwnOrderSchedule(detail) && Boolean(detail.planUnchanged);
      const stillAtRisk = !isOwnOrderSchedule(detail) && Boolean(detail.stillAtRisk);
      if (unchanged || stillAtRisk) {
        showToast({
          variant: 'warning',
          message: t('mobile.adminScheduling.atRisk.recalculateUnchanged'),
        });
        return;
      }
      if (!isOwnOrderSchedule(detail)) jumpToScheduleStart(detail);
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: t('mobile.adminScheduling.sheets.recalculateSuccess'),
      });
    },
    onError: (err) => {
      const message = mutationErrorMessage(err);
      setMutationError(message);
      showToast({ variant: 'error', message });
    },
  });

  const dayExceptionMutation = useMutation({
    mutationFn: async (
      action:
        | { kind: 'open' }
        | { kind: 'close' }
        | { kind: 'overtime'; end: string }
        | { kind: 'clear' },
    ) => {
      if (action.kind === 'clear') {
        return deleteCalendarException(selectedDay);
      }
      if (action.kind === 'close') {
        return addCalendarException({
          date: selectedDay,
          type: 'SHUTDOWN',
          note: 'Closed by admin',
        });
      }
      if (action.kind === 'overtime') {
        return addCalendarException({
          date: selectedDay,
          type: 'EXTRA_SHIFT',
          shiftStart: calendarMeta?.shiftStart ?? '08:00',
          shiftEnd: action.end,
          note: 'Overtime',
        });
      }
      return addCalendarException({
        date: selectedDay,
        type: 'EXTRA_SHIFT',
        shiftStart: calendarMeta?.shiftStart ?? '08:00',
        shiftEnd: calendarMeta?.shiftEnd ?? '16:00',
        note: 'Opened by admin',
      });
    },
    onSuccess: (data) => {
      setDayExceptionOpen(false);
      setMutationError(null);
      // Calendar write already landed. Refetch the month board now so Open /
      // Close / overtime is visible. Do not await the replan poll: React Query
      // keeps isPending true until onSuccess resolves, which left the sheet
      // spinner up and skipped this refresh when the poll threw.
      void calendarQuery.refetch();
      void monthCapacityQuery.refetch();
      if (!data.replanQueued || !data.replanJobId) {
        void refetchAll();
        return;
      }
      showToast({
        variant: 'info',
        message: t('mobile.adminScheduling.replan.recalculating'),
      });
      const runId = data.replanJobId;
      void (async () => {
        try {
          const run = await pollReplanRun(getReplanRun, runId);
          void refetchAll();
          const toast = selectReplanResultToast(run);
          showToast({
            variant: toast.variant,
            message:
              toast.count != null ? tPlural(toast.key, toast.count) : t(toast.key),
          });
        } catch {
          void refetchAll();
          showToast({
            variant: 'error',
            message: t('mobile.adminScheduling.replan.failed'),
          });
        }
      })();
    },
    onError: (err) => setMutationError(mutationErrorMessage(err)),
  });

  const approvableTargets = useMemo(
    () => selectApprovableScheduleTargets(visibleFocusCards),
    [visibleFocusCards],
  );

  const finishBulk = () => {
    setBulkBusy(false);
    setBulkSnapshot(null);
    pageScrollRef.current?.scrollTo({ y: 0, animated: false });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.all });
    void conflictsQuery.refetch();
    void dashboardQuery.refetch();
    void calendarQuery.refetch();
    void atRiskQuery.refetch();
  };

  const finishResolve = () => {
    setBulkBusy(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.conflicts() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.dashboard() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.atRisk() });
    void conflictsQuery.refetch();
    void dashboardQuery.refetch();
    void atRiskQuery.refetch();
  };

  const runApproveAll = async () => {
    const targets = selectApprovableScheduleTargets(visibleFocusCards);
    if (!targets.length) return;
    setBulkSnapshot({ focusCards: visibleFocusCards, conflictRows: visibleConflictRows });
    setBulkBusy(true);
    setMutationError(null);
    let ok = 0;
    let fail = 0;
    for (const target of targets) {
      try {
        let version = target.version;
        try {
          const latest = await getOrderSchedule(target.productionOrderId);
          if (!isOwnOrderSchedule(latest) && latest.schedule?.version != null) {
            version = latest.schedule.version;
          }
        } catch {
          // Keep the card version.
        }
        await approveSchedule(target.productionOrderId, {
          version,
          idempotencyKey: `approve-all-${target.productionOrderId}-${Date.now()}`,
        });
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setApproveAllOpen(false);
    finishBulk();
    if (fail === 0) {
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: tPlural('mobile.adminScheduling.sheets.approveAllSuccess', ok),
      });
    } else if (ok === 0) {
      showToast({
        variant: 'error',
        message: t('mobile.adminScheduling.sheets.approveAllFailed'),
      });
    } else {
      showToast({
        variant: 'warning',
        message: t('mobile.adminScheduling.sheets.approveAllPartial', { ok, fail }),
      });
    }
  };

  const runResolveAllAtRisk = async () => {
    setBulkBusy(true);
    setMutationError(null);
    try {
      const result = await resolveAllAtRisk();
      setAtRiskResolveResult(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduling.all });
      void atRiskQuery.refetch();
      void dashboardQuery.refetch();
      void calendarQuery.refetch();
      if (result.stillNeedsAttention === 0) haptics.completeStrong();
    } catch (err) {
      setMutationError(mutationErrorMessage(err));
      showToast({
        variant: 'error',
        message: mutationErrorMessage(err),
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const openResolve = (ids: string[], body: string, all = false) => {
    const unique = [...new Set(ids.filter(Boolean))];
    resolveIdsRef.current = unique;
    resolveAllRef.current = all;
    setResolveDraft({ ids: unique, body, all });
    setMutationError(unique.length || all ? null : t('mobile.adminScheduling.conflicts.resolveNoTargets'));
    setResolveOpen(true);
  };

  const runResolveConflicts = async (conflictIds: string[]) => {
    const unique = [...new Set((conflictIds.length ? conflictIds : resolveIdsRef.current).filter(Boolean))];
    const resolveAll = resolveAllRef.current || unique.length > 1;
    if (!unique.length && !resolveAll) {
      setMutationError(t('mobile.adminScheduling.conflicts.resolveNoTargets'));
      return;
    }
    setBulkBusy(true);
    setMutationError(null);
    try {
      if (resolveAll) {
        const result = await resolveAllConflicts();
        setResolveOpen(false);
        setResolveDraft(null);
        setReviewRow(null);
        resolveIdsRef.current = [];
        resolveAllRef.current = false;
        if (result.failedCount === 0) {
          haptics.completeStrong();
          showToast({
            variant: 'success',
            message: t('mobile.adminScheduling.conflicts.resolveSuccess'),
          });
        } else if (result.resolvedCount === 0) {
          showToast({
            variant: 'error',
            message: t('mobile.adminScheduling.conflicts.resolveFailed'),
          });
        } else {
          showToast({
            variant: 'warning',
            message: t('mobile.adminScheduling.conflicts.resolvePartial', {
              ok: result.resolvedCount,
              fail: result.failedCount,
            }),
          });
        }
        return;
      }
      const result = await resolveConflict(unique[0]!);
      setResolveOpen(false);
      setResolveDraft(null);
      setReviewRow(null);
      resolveIdsRef.current = [];
      haptics.completeStrong();
      const range = result.moved
        ? formatTimeRange(locale, result.moved.start, result.moved.end)
        : '';
      const message =
        result.action === 'ALREADY_RESOLVED'
          ? t('mobile.adminScheduling.conflicts.alreadyResolved')
          : result.action === 'REASSIGNED' && result.moved
            ? t('mobile.adminScheduling.conflicts.resolveSuccessReassigned', {
                number: formatIdentifier(locale, result.moved.orderNumber),
                name: result.moved.employeeName,
              })
            : result.moved
              ? t('mobile.adminScheduling.conflicts.resolveSuccessMoved', {
                  number: formatIdentifier(locale, result.moved.orderNumber),
                  range,
                })
              : t('mobile.adminScheduling.conflicts.resolveSuccess');
      showToast({ variant: 'success', message });
    } catch (error) {
      const code = isApiError(error) ? error.code : '';
      const orderNumber = isApiError(error)
        ? (error.message.match(/put\s+(.+?)\s+at risk/i)?.[1]?.trim() ?? '')
        : '';
      const message =
        code === 'MANUAL_LOCKED'
          ? t('mobile.adminScheduling.conflicts.bothLocked')
          : code === 'IN_PROGRESS_NO_WORKER'
            ? t('mobile.adminScheduling.conflicts.inProgressNoWorker')
          : code === 'WOULD_MISS_COMMITMENT'
            ? t('mobile.adminScheduling.conflicts.wouldMissCommitment', {
                number: formatIdentifier(
                  locale,
                  orderNumber || t('mobile.adminScheduling.conflicts.emptyDetail'),
                ),
              })
            : code === 'NO_ALTERNATIVE'
              ? t('mobile.adminScheduling.conflicts.resolveFailedAuto')
              : isApiError(error)
                ? toastMessageForError(error)
                : t('mobile.adminScheduling.conflicts.resolveFailed');
      setMutationError(message);
      showToast({ variant: 'error', message });
    } finally {
      finishResolve();
    }
  };

  const hasAnyData = Boolean(dashboardQuery.data || calendarQuery.data || atRiskQuery.data);
  const isInitialLoading =
    !hasAnyData &&
    (dashboardQuery.isLoading || calendarQuery.isLoading || atRiskQuery.isLoading);
  const isError =
    !hasAnyData &&
    (dashboardQuery.isError || calendarQuery.isError || atRiskQuery.isError);

  const calendarUpdating = calendarQuery.isFetching && Boolean(calendarQuery.data);
  const dashboardUpdating = dashboardQuery.isFetching && Boolean(dashboardQuery.data);
  const focusUpdating =
    focus === 'atRisk'
      ? atRiskQuery.isFetching && Boolean(atRiskQuery.data)
      : (calendarQuery.isFetching || weekCalendarQuery.isFetching) &&
        Boolean(calendarQuery.data || weekCalendarQuery.data);

  const focusColdLoading =
    Boolean(focus) &&
    focus !== 'atRisk' &&
    needsWeekWindow &&
    weekCalendarQuery.isLoading &&
    !weekCalendarQuery.data &&
    focusCards.length === 0;

  const atRiskColdLoading =
    focus === 'atRisk' && atRiskQuery.isLoading && !atRiskQuery.data && focusCards.length === 0;

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const openAtRiskFollowUp = (kind: 'recalculate' | 'changeDate', card: AdminScheduleCardModel) => {
    setSelectedCard(card);
    setMutationError(null);
    if (atRiskDetailOpen) {
      pendingAtRiskSheetRef.current = kind;
      setAtRiskDetailOpen(false);
      return;
    }
    if (kind === 'recalculate') setRecalculateOpen(true);
    else setChangeDateOpen(true);
  };

  const runAtRiskAction = (card: AdminScheduleCardModel) => {
    const action = card.recommendedAction;
    if (action === 'RECALCULATE') {
      openAtRiskFollowUp('recalculate', card);
      return;
    }
    if (action === 'REVIEW_COMMITMENT') {
      openAtRiskFollowUp('changeDate', card);
      return;
    }
    setAtRiskDetailOpen(false);
    if (action === 'REVIEW_ESTIMATES' && canReviewEstimates) {
      router.push('/(app)/(admin)/production/workflow' as Href);
      return;
    }
    if (action === 'VIEW_PRODUCTION') {
      router.push(adminProductionFlowHref(card.productionOrderId));
      return;
    }
    if (action === 'MANAGE_WORKERS' && canManageUsers) {
      router.push('/(app)/(admin)/users' as Href);
      return;
    }
    if (action === 'VIEW_MATERIALS' && canViewMaterials) {
      router.push('/(app)/(admin)/(tabs)/inventory' as Href);
    }
  };

  const openActions = (card: AdminScheduleCardModel) => {
    setSelectedCard(card);
    setMutationError(null);
    if (card.riskStatus) {
      setAtRiskDetailOpen(true);
      return;
    }
    setActionSheetOpen(true);
  };

  const actionSheetItems: ActionSheetItem[] = selectedCard
    ? selectAvailableActions(selectedCard, { canApprove, canManage }).map((mode) =>
        buildActionItem(mode, selectedCard, t, {
          onApprove: () => setApproveOpen(true),
          onChangeDate: () => setChangeDateOpen(true),
          onRecalculate: () => setRecalculateOpen(true),
        }),
      )
    : [];

  if (isInitialLoading) {
    return (
      <AppScreen>
        <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
          <SkeletonShimmer height={28} width="42%" />
          <SkeletonShimmer height={18} width="70%" />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonShimmer
                key={i}
                height={72}
                width={i === 4 ? '100%' : '48%'}
                style={{ borderRadius: theme.radius.lg }}
              />
            ))}
          </View>
          <SkeletonShimmer height={220} style={{ borderRadius: theme.radius.lg }} />
        </View>
      </AppScreen>
    );
  }

  if (isError) {
    return (
      <AppScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.adminScheduling.errorTitle')}
          description={t('mobile.adminScheduling.errorBody')}
          retryLabel={t('mobile.adminScheduling.retry')}
          onRetry={refetchAll}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        ref={pageScrollRef}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={!(bulkBusy && approveAllOpen)}
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={userPullRefreshing}
            onRefresh={onPullRefresh}
            enabled={!bulkBusy}
          />
        }
      >
        <View style={{ gap: theme.spacing.xs }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.adminScheduling.eyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {t('mobile.adminScheduling.title')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('mobile.adminScheduling.subtitle')}
          </AppText>
        </View>

        <View
          style={{
            opacity: dashboardUpdating ? 0.72 : 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          {stats.map((stat, index) => (
            <StatChip
              key={stat.key}
              statKey={stat.key}
              value={stat.value}
              tone={stat.tone}
              fullWidth={stats.length % 2 === 1 && index === stats.length - 1}
              active={focus === stat.key}
              onPress={() => onStatPress(stat.key)}
            />
          ))}
        </View>

        {focus && focusEmptyKey ? (
          <View style={{ gap: theme.spacing.sm, opacity: focusUpdating ? 0.72 : 1 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.adminScheduling.clearFocus')}
                onPress={() => {
                  void haptics.selection();
                  setFocus(null);
                  setOrderSearch('');
                }}
                style={{
                  minHeight: 32,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.brandSoft,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                  {t('mobile.adminScheduling.clearFocus')}
                </AppText>
              </AnimatedPressable>
            </View>

            {focus === 'conflicts' ? (
              focusColdLoading ? (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.conflicts.overlapTitle')}
                  count={null}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                >
                  <ScheduleListSkeleton />
                </ScheduleOrdersBoard>
              ) : (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.conflicts.overlapTitle')}
                  caption={tPlural('mobile.adminScheduling.conflicts.affectingOrders', visibleConflictRows.length, {
                    conflicts: visibleConflictRows.length,
                    orders: selectUniqueConflictProductionOrderIds(visibleConflictRows).length,
                  })}
                  count={visibleConflictRows.length}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                  tone="danger"
                  expandKind="overlaps"
                  headerAction={
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.adminScheduling.conflicts.helpTitle')}
                        onPress={() => {
                          void haptics.selection();
                          setConflictHelpOpen(true);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.errorSoft,
                          borderWidth: 1,
                          borderColor: colors.error,
                        }}
                      >
                        <Ionicons name="information" size={14} color={colors.error} />
                      </AnimatedPressable>
                      {canManage && conflictRows.length > 0 ? (
                        <BoardHeaderAction
                          label={t('mobile.adminScheduling.conflicts.resolveAll')}
                          emphasis="filled"
                          onPress={() =>
                            openResolve(
                              conflictRows.map((row) => row.id),
                              tPlural(
                                'mobile.adminScheduling.conflicts.resolveAllBody',
                                conflictRows.length,
                              ),
                              true,
                            )
                          }
                        />
                      ) : null}
                    </View>
                  }
                  expanded={conflictOverlapExpanded}
                  onToggleExpand={() => setConflictOverlapExpanded((open) => !open)}
                  itemCount={visibleConflictRows.length}
                >
                  {visibleConflictRows.length === 0 ? (
                    <EmptyState
                      title={t(
                        conflictRows.length === 0
                          ? 'mobile.adminScheduling.conflicts.overlapEmpty'
                          : 'mobile.adminScheduling.searchEmpty',
                      )}
                    />
                  ) : (
                    <>
                    <CappedNestedScroll
                      itemCount={visibleConflictRows.length}
                      rowEstimate={OVERLAP_ROW_ESTIMATE}
                      gap={theme.spacing.sm}
                      expanded={conflictOverlapExpanded}
                    >
                      {visibleConflictRows.map((row) => (
                        <ConflictFocusRow
                          key={row.id}
                          row={row}
                          canResolve={canManage}
                          onReview={() => setReviewRow(row)}
                          onResolve={() =>
                            openResolve(
                              [row.id],
                              t('mobile.adminScheduling.conflicts.resolveBody', {
                                name:
                                  row.employeeName ||
                                  t('mobile.adminScheduling.conflicts.emptyDetail'),
                              }),
                            )
                          }
                        />
                      ))}
                    </CappedNestedScroll>
                    <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      {t('mobile.adminScheduling.conflicts.caption')}
                    </AppText>
                    </>
                  )}
                </ScheduleOrdersBoard>
              )
            ) : focusColdLoading || atRiskColdLoading ? (
              <ScheduleOrdersBoard
                title={t(`mobile.adminScheduling.focusFilter.${focus}`)}
                count={null}
                search={orderSearch}
                onSearchChange={setOrderSearch}
              >
                <ScheduleListSkeleton />
              </ScheduleOrdersBoard>
            ) : focusCards.length === 0 ? (
              <ScheduleOrdersBoard
                title={t(`mobile.adminScheduling.focusFilter.${focus}`)}
                count={0}
                search={orderSearch}
                onSearchChange={setOrderSearch}
              >
                <EmptyState title={t(focusEmptyKey)} />
              </ScheduleOrdersBoard>
            ) : visibleFocusCards.length === 0 ? (
              <ScheduleOrdersBoard
                title={t(`mobile.adminScheduling.focusFilter.${focus}`)}
                count={0}
                search={orderSearch}
                onSearchChange={setOrderSearch}
              >
                <EmptyState title={t('mobile.adminScheduling.searchEmpty')} />
              </ScheduleOrdersBoard>
            ) : (
              <ScheduleOrdersBoard
                title={t(`mobile.adminScheduling.focusFilter.${focus}`)}
                caption={
                  focus === 'atRisk' ? t('mobile.adminScheduling.atRisk.caption') : undefined
                }
                count={visibleFocusCards.length}
                search={orderSearch}
                onSearchChange={setOrderSearch}
                headerAction={
                  focus === 'awaitingApproval' && canApprove && approvableTargets.length > 0 ? (
                    <BoardHeaderAction
                      label={t('mobile.adminScheduling.sheets.approveAll')}
                      onPress={() => {
                        setMutationError(null);
                        setApproveAllOpen(true);
                      }}
                    />
                  ) : focus === 'atRisk' ? (
                    <View
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.adminScheduling.atRisk.helpTitle')}
                        onPress={() => {
                          void haptics.selection();
                          setAtRiskHelpOpen(true);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.errorSoft,
                          borderWidth: 1,
                          borderColor: colors.error,
                        }}
                      >
                        <Ionicons name="information" size={14} color={colors.error} />
                      </AnimatedPressable>
                      {canManage && atRisk.length > 0 ? (
                        <BoardHeaderAction
                          label={t('mobile.adminScheduling.atRisk.resolveAll')}
                          emphasis="filled"
                          onPress={() => {
                            setAtRiskResolveResult(null);
                            setAtRiskResolveOpen(true);
                          }}
                        />
                      ) : null}
                    </View>
                  ) : null
                }
                expanded={ordersExpanded}
                onToggleExpand={() => setOrdersExpanded((open) => !open)}
                itemCount={visibleFocusCards.length}
              >
                <CappedNestedScroll
                  itemCount={visibleFocusCards.length}
                  rowEstimate={focus === 'atRisk' ? AT_RISK_ROW_ESTIMATE : FLOOR_ROW_ESTIMATE}
                  gap={theme.spacing.sm}
                  expanded={ordersExpanded}
                >
                  {visibleFocusCards.map((card) => (
                    <ScheduleOrderRow
                      key={card.id}
                      card={card}
                      onPress={() => openActions(card)}
                      onAtRiskAction={() => runAtRiskAction(card)}
                      canReview={canManage}
                    />
                  ))}
                </CappedNestedScroll>
              </ScheduleOrdersBoard>
            )}
          </View>
        ) : (
          <>
            <View style={{ gap: theme.spacing.sm, opacity: calendarUpdating ? 0.72 : 1 }}>
              <AppText variant="heading" weight={titleWeight}>
                {t('mobile.adminScheduling.monthTitle')}
              </AppText>
              <CalendarLegend />
              <MonthCalendar
                value={selectedDay}
                onSelect={(ymd) => {
                  void haptics.selection();
                  setSelectedDay(ymd);
                  setOrdersExpanded(false);
                }}
                monthCursor={cursor}
                onMonthChange={(next) => {
                  setCursor(next);
                  const range = monthRangeYmd(next);
                  if (selectedDay < range.from || selectedDay > range.to) {
                    setSelectedDay(range.from);
                  }
                }}
                dayMeta={dayMeta}
                disableUnavailable={false}
                variant="admin"
                showAccentRail={false}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                {canAdjustHours ? (
                  <AnimatedPressable
                    variant="button"
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.adminScheduling.dayCapacity.edit')}
                    onPress={() => {
                      void haptics.selection();
                      setMutationError(null);
                      setDayExceptionOpen(true);
                    }}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.brandSoft,
                      borderWidth: 1,
                      borderColor: colors.brand,
                    }}
                  >
                    <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                      {t('mobile.adminScheduling.dayCapacity.edit')}
                    </AppText>
                  </AnimatedPressable>
                ) : null}
                <Divider compact style={{ flex: 1, paddingHorizontal: 0 }} />
              </View>
            </View>

            <FactoryCapacitySection
              ymd={selectedDay}
              ordersCount={dayOrders.length}
              atRiskCount={dayAtRiskCount}
              conflictCount={dayConflictCount}
              onJumpToday={() => {
                setSelectedDay(today);
                setCursor(initialCursorFromValue(today));
              }}
            />

            <Divider />

            <View style={{ gap: theme.spacing.sm, opacity: calendarUpdating ? 0.72 : 1 }}>
              {selectedDayInfo && !selectedDayInfo.isWorking ? (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.dayOrdersTitle', {
                    date: formatDate(locale, selectedDay),
                  })}
                  count={selectedDayInfo.pinnedOnClosedDayCount > 0 ? selectedDayInfo.pinnedOnClosedDayCount : 0}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                >
                  {selectedDayInfo.pinnedOnClosedDayCount > 0 ? (
                    <EmptyState
                      title={t('mobile.adminScheduling.replan.pinnedClosedDay')}
                      description={tPlural(
                        'mobile.adminScheduling.replan.pinnedClosedDayBody',
                        selectedDayInfo.pinnedOnClosedDayCount,
                      )}
                      actionLabel={t('mobile.adminScheduling.replan.review')}
                      onAction={() => {
                        const first = dayOrders[0];
                        if (first) openActions(first);
                        else setFocus('conflicts');
                      }}
                    />
                  ) : (
                    <EmptyState title={t('mobile.adminScheduling.dayClosed')} />
                  )}
                </ScheduleOrdersBoard>
              ) : dayOrders.length === 0 ? (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.dayOrdersTitle', {
                    date: formatDate(locale, selectedDay),
                  })}
                  count={0}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                >
                  <EmptyState title={t('mobile.adminScheduling.dayEmpty')} />
                </ScheduleOrdersBoard>
              ) : visibleDayOrders.length === 0 ? (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.dayOrdersTitle', {
                    date: formatDate(locale, selectedDay),
                  })}
                  count={0}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                >
                  <EmptyState title={t('mobile.adminScheduling.searchEmpty')} />
                </ScheduleOrdersBoard>
              ) : (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.dayOrdersTitle', {
                    date: formatDate(locale, selectedDay),
                  })}
                  count={visibleDayOrders.length}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                  expanded={ordersExpanded}
                  onToggleExpand={() => setOrdersExpanded((open) => !open)}
                  itemCount={visibleDayOrders.length}
                >
                  <CappedNestedScroll
                    itemCount={visibleDayOrders.length}
                    rowEstimate={FLOOR_ROW_ESTIMATE}
                    gap={theme.spacing.sm}
                    expanded={ordersExpanded}
                  >
                    {visibleDayOrders.map((card) => (
                      <ScheduleOrderRow
                        key={card.id}
                        card={card}
                        onPress={() => openActions(card)}
                        canReview={canManage}
                      />
                    ))}
                  </CappedNestedScroll>
                </ScheduleOrdersBoard>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <ActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        title={selectedCard?.number}
        cancelLabel={t('mobile.production.cancel')}
        actions={actionSheetItems}
      />

      <ApproveScheduleSheet
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        orderNumber={selectedCard?.number ?? ''}
        loading={approveMutation.isPending}
        errorMessage={mutationError}
        onConfirm={() => {
          if (!selectedCard || selectedCard.scheduleVersion == null) return;
          approveMutation.mutate({
            id: selectedCard.productionOrderId,
            version: selectedCard.scheduleVersion,
          });
        }}
      />

      <AdminChangeScheduleDateSheet
        open={changeDateOpen}
        onClose={() => setChangeDateOpen(false)}
        current={selectedCard?.plannedStart ?? selectedCard?.requiredDeliveryDate ?? null}
        workingDays={
          calendarQuery.data?.days
            ? new Set(
                calendarQuery.data.days.filter((d) => d.isWorking).map((d) => d.date.slice(0, 10)),
              )
            : undefined
        }
        loading={changeDateMutation.isPending}
        errorMessage={mutationError}
        onSubmit={(isoDateValue, reason) => {
          if (!selectedCard) return;
          changeDateMutation.mutate({
            id: selectedCard.productionOrderId,
            isoDate: isoDateValue,
            reason,
          });
        }}
      />

      <RecalculateScheduleSheet
        open={recalculateOpen}
        onClose={() => setRecalculateOpen(false)}
        orderNumber={selectedCard?.number ?? ''}
        loading={recalculateMutation.isPending}
        errorMessage={mutationError}
        onSubmit={(reason) => {
          if (!selectedCard) return;
          recalculateMutation.mutate({ id: selectedCard.productionOrderId, reason });
        }}
      />

      <AdminDayExceptionSheet
        open={dayExceptionOpen}
        onClose={() => setDayExceptionOpen(false)}
        dateYmd={selectedDay}
        isWorking={Boolean(selectedDayInfo?.isWorking)}
        hasException={Boolean(selectedDayException)}
        defaultShiftStart={calendarMeta?.shiftStart ?? '08:00'}
        defaultShiftEnd={calendarMeta?.shiftEnd ?? '16:00'}
        currentOvertimeEnd={
          selectedDayException?.type === 'EXTRA_SHIFT' ? selectedDayException.shiftEnd : null
        }
        loading={dayExceptionMutation.isPending && dayExceptionOpen}
        errorMessage={mutationError}
        onOpenDay={() => dayExceptionMutation.mutate({ kind: 'open' })}
        onCloseDay={() => dayExceptionMutation.mutate({ kind: 'close' })}
        onOvertime={(end) => dayExceptionMutation.mutate({ kind: 'overtime', end })}
        onClearException={() => dayExceptionMutation.mutate({ kind: 'clear' })}
      />

      <ApproveAllSchedulesSheet
        open={approveAllOpen}
        onClose={() => setApproveAllOpen(false)}
        count={approvableTargets.length}
        loading={bulkBusy}
        errorMessage={mutationError}
        onConfirm={() => {
          void runApproveAll();
        }}
      />

      <ResolveConflictSheet
        open={resolveOpen}
        onClose={() => {
          setResolveOpen(false);
          setResolveDraft(null);
          resolveIdsRef.current = [];
          resolveAllRef.current = false;
        }}
        title={t('mobile.adminScheduling.conflicts.resolveTitle')}
        body={resolveDraft?.body ?? t('mobile.adminScheduling.conflicts.resolveNoTargets')}
        loading={bulkBusy}
        errorMessage={mutationError}
        onConfirm={() => {
          void runResolveConflicts(resolveDraft?.ids ?? resolveIdsRef.current);
        }}
      />

      <ConflictHelpSheet open={conflictHelpOpen} onClose={() => setConflictHelpOpen(false)} />
      <AtRiskHelpSheet open={atRiskHelpOpen} onClose={() => setAtRiskHelpOpen(false)} />
      <AtRiskDetailSheet
        open={atRiskDetailOpen && Boolean(selectedCard?.riskStatus)}
        onClose={() => setAtRiskDetailOpen(false)}
        onClosed={() => {
          const next = pendingAtRiskSheetRef.current;
          pendingAtRiskSheetRef.current = null;
          if (next === 'recalculate') setRecalculateOpen(true);
          if (next === 'changeDate') setChangeDateOpen(true);
        }}
        orderNumber={selectedCard?.number ?? ''}
        productTitle={
          selectedCard && selectedCard.title !== selectedCard.number ? selectedCard.title : selectedCard?.number
        }
        dealerName={selectedCard?.dealerName}
        imageUrl={selectedCard?.imageUrl}
        statusLabel={t(selectAtRiskStatusKey(selectedCard?.riskStatus))}
        riskStatus={selectedCard?.riskStatus}
        reasonLabel={selectedCard ? t(selectAtRiskReasonKey(selectedCard)) : ''}
        actionLabel={t(selectAtRiskActionKey(selectedCard?.recommendedAction))}
        actionIcon={atRiskActionIcon(selectedCard?.recommendedAction)}
        daysLateLabel={
          selectedCard
            ? (() => {
                const promised = selectedCard.committedDeliveryDate ?? selectedCard.requiredDeliveryDate;
                const projected =
                  selectedCard.projectedCompletion ??
                  selectedCard.earliestAvailableDate ??
                  selectedCard.suggestedDeliveryDate;
                const days = selectDaysLate(promised, projected);
                return days != null ? tPlural('mobile.adminScheduling.atRisk.daysLate', days) : null;
              })()
            : null
        }
        requested={selectedCard?.requiredDeliveryDate ? formatDate(locale, selectedCard.requiredDeliveryDate) : null}
        suggested={selectedCard?.suggestedDeliveryDate ? formatDate(locale, selectedCard.suggestedDeliveryDate) : null}
        committed={selectedCard?.committedDeliveryDate ? formatDate(locale, selectedCard.committedDeliveryDate) : null}
        projected={
          selectedCard?.projectedCompletion || selectedCard?.earliestAvailableDate
            ? formatDate(locale, selectedCard.projectedCompletion ?? selectedCard.earliestAvailableDate ?? '')
            : null
        }
        earliestFeasible={
          selectedCard?.earliestFeasibleDate ? formatDate(locale, selectedCard.earliestFeasibleDate) : null
        }
        stageName={selectedCard?.stageName}
        requiredWip={selectedCard?.requiredWip}
        producedBy={selectedCard?.producedBy}
        currentStage={selectedCard?.currentStage}
        missingMaterial={selectedCard?.missingMaterial}
        stageAtCapacity={selectedCard?.stageAtCapacity}
        requestedInfeasible={
          selectedCard?.requestedDateFeasible === false && !selectedCard?.committedDeliveryDate
        }
        canAct={canManage && selectedCard?.recommendedAction != null && selectedCard.recommendedAction !== 'NONE'}
        onAction={() => {
          if (selectedCard) runAtRiskAction(selectedCard);
        }}
      />
      <ResolveAllAtRiskSheet
        open={atRiskResolveOpen}
        onClose={() => {
          setAtRiskResolveOpen(false);
          setAtRiskResolveResult(null);
        }}
        loading={bulkBusy}
        errorMessage={mutationError}
        result={
          atRiskResolveResult
            ? {
                resolvedAutomatically: atRiskResolveResult.resolvedAutomatically,
                stillNeedsAttention: atRiskResolveResult.stillNeedsAttention,
                alreadyOnTrack: atRiskResolveResult.alreadyOnTrack,
                remaining: atRiskResolveResult.remaining,
                reasonGroups: selectAtRiskReasonGroups(atRiskResolveResult.results).map((group) => ({
                  key: group.key,
                  count: group.count,
                  label: t(group.key),
                })),
              }
            : null
        }
        onConfirm={() => {
          void runResolveAllAtRisk();
        }}
      />

      <ConflictReviewSheet
        open={Boolean(reviewRow)}
        onClose={() => setReviewRow(null)}
        typeLabel={
          reviewRow
            ? t(selectConflictTypeKey(reviewRow.type))
            : t('mobile.adminScheduling.conflicts.typeOverlap')
        }
        workerName={
          reviewRow?.employeeName || t('mobile.adminScheduling.conflicts.emptyDetail')
        }
        task1={{
          title: reviewRow?.allocationA.productName ?? '',
          number: reviewRow?.allocationA.orderNumber ?? '',
          stage: reviewRow?.allocationA.stageName ?? '',
          window: reviewRow
            ? formatTimeRange(locale, reviewRow.allocationA.start, reviewRow.allocationA.end)
            : '',
          priority: reviewRow && selectShowPriority(reviewRow.allocationA.priority, reviewRow.allocationB.priority)
            ? priorityLabel(reviewRow.allocationA.priority, t)
            : null,
          delivery: reviewRow?.allocationA.committedDeliveryDate
            ? formatDate(locale, reviewRow.allocationA.committedDeliveryDate)
            : reviewRow?.allocationA.requestedDeliveryDate
              ? formatDate(locale, reviewRow.allocationA.requestedDeliveryDate)
              : null,
        }}
        task2={{
          title: reviewRow?.allocationB.productName ?? '',
          number: reviewRow?.allocationB.orderNumber ?? '',
          stage: reviewRow?.allocationB.stageName ?? '',
          window: reviewRow
            ? formatTimeRange(locale, reviewRow.allocationB.start, reviewRow.allocationB.end)
            : '',
          priority: reviewRow && selectShowPriority(reviewRow.allocationA.priority, reviewRow.allocationB.priority)
            ? priorityLabel(reviewRow.allocationB.priority, t)
            : null,
          delivery: reviewRow?.allocationB.committedDeliveryDate
            ? formatDate(locale, reviewRow.allocationB.committedDeliveryDate)
            : reviewRow?.allocationB.requestedDeliveryDate
              ? formatDate(locale, reviewRow.allocationB.requestedDeliveryDate)
              : null,
        }}
        overlapWindow={
          reviewRow
            ? formatTimeRange(locale, reviewRow.overlapStart, reviewRow.overlapEnd)
            : ''
        }
        suggested={
          reviewRow
            ? t('mobile.adminScheduling.conflicts.resolveBody', {
                name:
                  reviewRow.employeeName || t('mobile.adminScheduling.conflicts.emptyDetail'),
              })
            : null
        }
        overlapDuration={
          reviewRow ? formatDuration(locale, reviewRow.overlapMinutes) : ''
        }
        errorMessage={mutationError}
        loading={bulkBusy}
        canResolve={canManage}
        onResolve={
          reviewRow
            ? () => {
                resolveAllRef.current = false;
                resolveIdsRef.current = [reviewRow.id];
                void runResolveConflicts([reviewRow.id]);
              }
            : undefined
        }
        onReviewSchedule={
          reviewRow
            ? () => {
                const card = conflictOrderCards.find(
                  (item) =>
                    item.productionOrderId === reviewRow.allocationA.productionOrderId ||
                    item.productionOrderId === reviewRow.allocationB.productionOrderId,
                );
                setReviewRow(null);
                if (card) openActions(card);
              }
            : undefined
        }
      />
    </AppScreen>
  );
}

function buildActionItem(
  mode: AdminScheduleActionMode,
  card: AdminScheduleCardModel,
  t: (key: string, params?: Record<string, string | number>) => string,
  handlers: { onApprove: () => void; onChangeDate: () => void; onRecalculate: () => void },
): ActionSheetItem {
  // Nested BottomSheets must wait for ActionSheet Modal unmount (iOS freezes otherwise).
  if (mode === 'approve') {
    return {
      label: t('mobile.adminScheduling.sheets.approveTitle'),
      icon: 'checkmark-circle-outline',
      deferUntilClosed: true,
      onPress: handlers.onApprove,
    };
  }
  if (mode === 'changeDate') {
    return {
      label: t('mobile.adminScheduling.sheets.changeDateTitle'),
      icon: 'calendar-outline',
      deferUntilClosed: true,
      onPress: handlers.onChangeDate,
    };
  }
  return {
    label: t('mobile.adminScheduling.sheets.recalculateTitle'),
    icon: 'refresh-outline',
    deferUntilClosed: true,
    onPress: handlers.onRecalculate,
  };
}

function StatChip({
  statKey,
  value,
  tone,
  fullWidth = false,
  active = false,
  onPress,
}: {
  statKey: ScheduleFocusKey;
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
  fullWidth?: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const hot = value > 0 && tone !== 'neutral';
  const accent =
    tone === 'danger' ? colors.error : tone === 'warning' ? colors.warning : colors.brand;
  const wash = active
    ? colors.brandSoft
    : tone === 'danger'
      ? colors.errorSoft
      : tone === 'warning'
        ? colors.warningSoft
        : colors.surface;
  const iconName =
    statKey === 'today'
      ? 'today-outline'
      : statKey === 'week'
        ? 'calendar-outline'
        : statKey === 'awaitingApproval'
          ? 'hourglass-outline'
          : statKey === 'atRisk'
            ? 'warning-outline'
            : 'git-compare-outline';
  const labelWeight = locale === 'ar' ? 'regular' : 'medium';
  const label = t(`mobile.adminScheduling.stats.${statKey}`);

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: active ? 2 : StyleSheet.hairlineWidth,
        borderColor: active ? colors.brand : hot ? accent : colors.border,
        backgroundColor: wash,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm + 2,
        ...(fullWidth
          ? {
              width: '100%',
              flexGrow: 0,
              flexBasis: '100%',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }
          : {
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: '47%',
              minWidth: '46%',
              gap: 4,
            }),
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(fullWidth ? { flex: 1 } : null),
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: hot ? accent : colors.brandSoft,
          }}
        >
          <Ionicons
            name={iconName as 'today-outline'}
            size={14}
            color={hot ? colors.onBrand : colors.brand}
          />
        </View>
        {fullWidth ? (
          <AppText
            variant="caption"
            weight={labelWeight}
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.textSecondary,
              letterSpacing: locale === 'ar' ? 0 : 0.2,
              fontSize: 12,
            }}
          >
            {label}
          </AppText>
        ) : null}
        <AppText
          variant="heading"
          weight="semibold"
          dir="ltr"
          style={{
            ...(fullWidth ? null : { flex: 1, textAlign: 'right' }),
            color: hot ? accent : colors.textPrimary,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.3,
            fontSize: 22,
            lineHeight: 26,
          }}
        >
          {value}
        </AppText>
      </View>

      {!fullWidth ? (
        <AppText
          variant="caption"
          weight={labelWeight}
          numberOfLines={2}
          style={{
            color: colors.textSecondary,
            letterSpacing: locale === 'ar' ? 0 : 0.2,
            fontSize: 11,
            lineHeight: 14,
          }}
        >
          {label}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}

function priorityLabel(priority: string, t: (key: string) => string): string {
  const upper = priority.toUpperCase();
  const key = `mobile.production.priority.${upper}`;
  const label = t(key);
  return label === key ? priority : label;
}

function ScheduleOrderRow({
  card,
  onPress,
  canReview,
  onResolve,
  onAtRiskAction,
}: {
  card: AdminScheduleCardModel;
  onPress: () => void;
  canReview?: boolean;
  onResolve?: () => void;
  onAtRiskAction?: () => void;
}) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const priority = (card.priority ?? '').toUpperCase();
  const urgent = priority === 'URGENT' || priority === 'HIGH';
  const atRisk = Boolean(card.riskStatus);
  const alerted = card.hasConflict || card.materialRisk;
  const accent = card.hasConflict
    ? colors.error
    : card.materialRisk
      ? colors.error
      : urgent
        ? colors.warning
        : colors.brand;

  const productTitle = card.title !== card.number ? card.title : card.number;
  const a11y = `${card.number} ${productTitle}`;

  if (atRisk) {
    return (
      <AtRiskOrderCard
        card={card}
        onPress={onPress}
        onAction={onAtRiskAction}
        canAct={canReview}
      />
    );
  }

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: alerted ? colors.error : urgent ? colors.warning : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: alerted || urgent ? 1 : 0.5,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          alignItems: 'flex-start',
        }}
      >
        <View style={{ width: SCHEDULE_MEDIA, gap: theme.spacing.xs }}>
          <OrderCardMedia imageUrl={card.imageUrl} size={SCHEDULE_MEDIA} />
          {urgent && card.priority ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: theme.radius.sm,
                backgroundColor: colors.warningSoft,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: colors.warning, fontSize: 10, lineHeight: 13 }}
              >
                {priorityLabel(card.priority, t)}
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 5,
            alignItems: isRTL ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              width: '100%',
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={2}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {productTitle}
            </AppText>
            {card.status ? <StatusBadge status={card.status} dot /> : null}
          </View>

          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir="ltr"
            style={{ letterSpacing: 0.2, width: '100%' }}
          >
            {card.number}
          </AppText>

          {card.dealerName ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {`${t('mobile.production.dealer')}: ${card.dealerName}`}
            </AppText>
          ) : null}

          <ScheduleExplanation
            source={scheduleSourceFromCard(card)}
            variant="compact"
            canReview={canReview}
            onReview={onPress}
          />

          {card.quantity != null ? (
            <AppText
              variant="caption"
              weight="semibold"
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {tPlural('mobile.adminScheduling.qty', card.quantity, { count: card.quantity })}
            </AppText>
          ) : null}
        </View>
      </View>

      {alerted || card.reason ? (
        <View
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            gap: theme.spacing.sm,
            ...(isRTL
              ? { marginRight: theme.spacing.md + 4 }
              : { marginLeft: theme.spacing.md + 4 }),
          }}
        >
          {alerted ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}
            >
              {card.hasConflict ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.errorSoft,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.error,
                  }}
                >
                  <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.error, fontSize: 11 }}
                  >
                    {t('mobile.adminScheduling.conflict')}
                  </AppText>
                </View>
              ) : null}
              {onResolve ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.adminScheduling.conflicts.resolve')}
                  hitSlop={8}
                  onPress={() => {
                    void haptics.selection();
                    onResolve();
                  }}
                  style={{
                    minHeight: 32,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.brand,
                  }}
                >
                  <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                    {t('mobile.adminScheduling.conflicts.resolve')}
                  </AppText>
                </AnimatedPressable>
              ) : null}
              {card.materialRisk ? (
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: theme.radius.full,
                    backgroundColor: colors.errorSoft,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.error,
                  }}
                >
                  <Ionicons name="warning-outline" size={12} color={colors.error} />
                  <AppText
                    variant="caption"
                    weight="semibold"
                    style={{ color: colors.error, fontSize: 11 }}
                  >
                    {t('mobile.adminScheduling.materialRisk')}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: theme.spacing.sm }} />
      )}
    </AnimatedPressable>
  );
}

function MetaChip({
  label,
  ink,
  wash,
  border,
  ltr = false,
}: {
  label: string;
  ink: string;
  wash: string;
  border: string;
  ltr?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: wash,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: border,
        maxWidth: '100%',
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        numberOfLines={1}
        dir={ltr ? 'ltr' : 'auto'}
        style={{ color: ink, fontSize: 10, lineHeight: 13 }}
      >
        {label}
      </AppText>
    </View>
  );
}

function ConflictFocusRow({
  row,
  canResolve,
  onResolve,
  onReview,
}: {
  row: ConflictRowModel;
  canResolve?: boolean;
  onResolve?: () => void;
  onReview?: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = row.employeeName || t('mobile.adminScheduling.conflicts.emptyDetail');
  const typeLabel = t(selectConflictTypeKey(row.type));
  const stage = row.stageName || row.allocationA.stageName || row.allocationB.stageName;
  const windowA = formatTimeRange(locale, row.allocationA.start, row.allocationA.end);
  const windowB = formatTimeRange(locale, row.allocationB.start, row.allocationB.end);
  const overlap = formatTimeRange(locale, row.overlapStart, row.overlapEnd);
  const duration = formatDuration(locale, row.overlapMinutes);
  const showPriority = selectShowPriority(row.allocationA.priority, row.allocationB.priority);

  return (
    <View
      accessibilityLabel={t('mobile.adminScheduling.conflicts.workerOverlap', { name })}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.error,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.error,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm + 2,
          paddingBottom: 8,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.errorSoft,
            borderWidth: 1,
            borderColor: colors.error,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: colors.error, fontSize: 13, letterSpacing: locale === 'ar' ? 0 : 0.3 }}
          >
            {workerInitials(name)}
          </AppText>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            dir="auto"
            style={{ textAlign: isRTL ? 'right' : 'left', width: '100%' }}
          >
            {name}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            <MetaChip
              label={typeLabel}
              ink={colors.error}
              wash={colors.errorSoft}
              border={colors.error}
            />
            {stage ? (
              <MetaChip
                label={stage}
                ink={colors.textSecondary}
                wash={colors.surfaceSecondary}
                border={colors.border}
              />
            ) : null}
          </View>
        </View>
      </View>

      <View
        style={{
          gap: 8,
          paddingHorizontal: theme.spacing.md,
          paddingBottom: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View style={{ gap: 6 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {row.allocationA.orderNumber ? (
            <MetaChip
              label={row.allocationA.orderNumber}
              ink={colors.brand}
              wash={colors.brandSoft}
              border={colors.brand}
              ltr
            />
            ) : null}
            <AppText variant="caption" weight="semibold" dir="ltr" style={{ fontSize: 11 }}>
              {windowA}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {row.allocationB.orderNumber ? (
            <MetaChip
              label={row.allocationB.orderNumber}
              ink={colors.brand}
              wash={colors.brandSoft}
              border={colors.brand}
              ltr
            />
            ) : null}
            <AppText variant="caption" weight="semibold" dir="ltr" style={{ fontSize: 11 }}>
              {windowB}
            </AppText>
          </View>
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: colors.errorSoft,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.error,
              maxWidth: '100%',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: colors.error, fontSize: 10, lineHeight: 13 }}
            >
              {t('mobile.adminScheduling.conflicts.overlap')}
            </AppText>
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: colors.error, fontSize: 10, lineHeight: 13 }}
            >
              {overlap}
            </AppText>
          </View>
          <MetaChip
            label={duration}
            ink={colors.warning}
            wash={colors.warningSoft}
            border={colors.warning}
          />
          {showPriority ? (
            <MetaChip
              label={priorityLabel(row.allocationA.priority, t)}
              ink={colors.textSecondary}
              wash={colors.surfaceSecondary}
              border={colors.border}
            />
          ) : null}
        </View>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {onReview ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminScheduling.conflicts.review')}
              onPress={() => {
                void haptics.selection();
                onReview();
              }}
              style={{
                minHeight: 32,
                paddingHorizontal: 12,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ fontSize: 11 }}>
                {t('mobile.adminScheduling.conflicts.review')}
              </AppText>
            </AnimatedPressable>
          ) : null}
          {canResolve && onResolve ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.adminScheduling.conflicts.resolve')}
              onPress={() => {
                void haptics.selection();
                onResolve();
              }}
              style={{
                minHeight: 32,
                paddingHorizontal: 12,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{ color: colors.brand, fontSize: 11 }}
              >
                {t('mobile.adminScheduling.conflicts.resolve')}
              </AppText>
            </AnimatedPressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function BoardHeaderAction({
  label,
  onPress,
  emphasis = 'soft',
}: {
  label: string;
  onPress: () => void;
  emphasis?: 'soft' | 'filled';
}) {
  const { colors, theme } = useTheme();
  const filled = emphasis === 'filled';
  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 28,
        paddingHorizontal: 10,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.brand : colors.brandSoft,
        borderWidth: filled ? 0 : 1,
        borderColor: colors.brand,
      }}
    >
      <AppText
        variant="caption"
        weight="semibold"
        style={{ color: filled ? colors.onBrand : colors.brand, fontSize: 11 }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

function ScheduleOrdersBoard({
  title,
  caption,
  count,
  search,
  onSearchChange,
  headerAction,
  expanded,
  onToggleExpand,
  itemCount,
  showSearch = true,
  tone = 'brand',
  expandKind = 'orders',
  children,
}: {
  title: string;
  caption?: string;
  count: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  headerAction?: ReactNode;
  expanded?: boolean;
  onToggleExpand?: () => void;
  itemCount?: number;
  showSearch?: boolean;
  tone?: 'brand' | 'danger';
  expandKind?: 'orders' | 'overlaps';
  children: ReactNode;
}) {
  const { locale, isRTL, t, tPlural } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const total = itemCount ?? count ?? 0;
  const showExpand = Boolean(onToggleExpand && total > FLOOR_LIST_VISIBLE_ROWS);
  const accent = tone === 'danger' ? colors.error : colors.brand;
  const accentSoft = tone === 'danger' ? colors.errorSoft : colors.brandSoft;
  const expandMore =
    expandKind === 'overlaps'
      ? tPlural('mobile.adminScheduling.conflicts.viewAllOverlaps', total)
      : tPlural('mobile.adminScheduling.viewAllOrders', total);
  const expandFewer =
    expandKind === 'overlaps'
      ? t('mobile.adminScheduling.conflicts.showFewerOverlaps')
      : t('mobile.adminScheduling.showFewerOrders');

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: tone === 'danger' ? 1 : 0.55,
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={2}
          style={{
            flex: 1,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.7,
            fontSize: 11,
            color: accent,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {headerAction}
        {count != null ? (
          <View
            style={{
              minWidth: 28,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: accentSoft,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: accent,
              alignItems: 'center',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: accent, fontVariant: ['tabular-nums'], fontSize: 12 }}
            >
              {String(count)}
            </AppText>
          </View>
        ) : null}
      </View>
      {caption ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm + 4,
            paddingBottom: theme.spacing.sm + 4,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <AppText
            variant="caption"
            color="secondary"
            style={{
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {caption}
          </AppText>
        </View>
      ) : null}

      {showSearch ? (
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.sm,
            paddingBottom: theme.spacing.sm,
            ...(isRTL
              ? { paddingRight: theme.spacing.md + 4 }
              : { paddingLeft: theme.spacing.md + 4 }),
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
        >
          <SearchBarShell>
            <AppTextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder={t('mobile.adminScheduling.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel={t('mobile.adminScheduling.searchPlaceholder')}
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: theme.spacing.sm,
                fontSize: 16,
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                ...resolveAppFontStyle(locale, { variant: 'body' }),
              }}
            />
          </SearchBarShell>
        </View>
      ) : null}

      <View
        style={{
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 2 }
            : { paddingLeft: theme.spacing.sm + 2 }),
        }}
      >
        {children}
      </View>

      {showExpand ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={expanded ? expandFewer : expandMore}
          onPress={() => {
            void haptics.selection();
            onToggleExpand?.();
          }}
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: theme.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
            {expanded ? expandFewer : expandMore}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

function CappedNestedScroll({
  itemCount,
  rowEstimate,
  gap,
  visibleRows = FLOOR_LIST_VISIBLE_ROWS,
  expanded,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  visibleRows?: number;
  expanded?: boolean;
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const scrollable = !expanded && itemCount > visibleRows;
  const capHeight = visibleRows * rowEstimate + Math.max(0, visibleRows - 1) * gap;

  if (!scrollable) {
    return <View style={{ gap }}>{children}</View>;
  }

  return (
    <View
      style={{
        height: capHeight,
        overflow: 'hidden',
        borderRadius: theme.radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap, padding: theme.spacing.sm, paddingBottom: theme.spacing.md }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function ScheduleListSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <SurfaceCard key={i} style={{ minHeight: FLOOR_ROW_ESTIMATE - 8, opacity: 0.85 }}>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <SkeletonShimmer
              width={SCHEDULE_MEDIA}
              height={SCHEDULE_MEDIA}
              style={{ borderRadius: theme.radius.lg }}
            />
            <View style={{ flex: 1, gap: theme.spacing.sm }}>
              <SkeletonShimmer height={14} width="70%" />
              <SkeletonShimmer height={12} width="45%" />
              <SkeletonShimmer height={12} width="55%" />
              <SkeletonShimmer height={12} width="40%" />
            </View>
          </View>
        </SurfaceCard>
      ))}
    </View>
  );
}
