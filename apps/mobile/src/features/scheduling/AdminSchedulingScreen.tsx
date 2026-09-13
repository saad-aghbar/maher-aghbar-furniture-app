import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import {
  initialCursorFromValue,
  monthRangeYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useToast } from '@/components/feedback/Toast';
import { isApiError } from '@/api/errors';
import { toastMessageForError } from '@/api/queryClient';
import { invalidateKeys, queryKeys } from '@/api/queryKeys';
import {
  addCalendarException,
  approveSchedule,
  unapproveSchedule,
  dealerDateChange,
  deleteCalendarException,
  getDayExceptionImpact,
  getOrderSchedule,
  getScheduleHistory,
  isOwnOrderSchedule,
  type ScheduleOrderCard,
  type UnscheduledOrderCard,
} from '@/api/modules/scheduling';
import { assignTask } from '@/api/modules/production';
import { useLocale } from '@/i18n';
import { haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { ProductionTaskSheet } from '@/features/production/components/ProductionTaskSheet';
import {
  useAssignableWorkersQuery,
  useProductionDealersQuery,
  useProductionOrderQuery,
} from '@/features/production/query';
import { selectProductionDetail, type ProductionTaskRow } from '@/features/production/selectProduction';
import { adminProductionFlowHref } from '@/features/production-flow/flowRoutes';
import { localizedName } from '@maher/i18n';
import {
  AdminDayExceptionSheet,
  AdminChangeScheduleDateSheet,
  ApproveScheduleSheet,
  OverwriteApprovalSheet,
} from './components/AdminScheduleSheets';
import { FactoryDayWorkspace } from './components/FactoryDayWorkspace';
import { FactoryMonthBoard } from './components/FactoryMonthBoard';
import { ScheduleOrderSheet, type DraftPlacement } from './components/ScheduleOrderSheet';
import {
  SchedulingFilterSheet,
  type SchedulingDealerPick,
  type SchedulingReadinessFilter,
} from './components/SchedulingFilterSheet';
import { SchedulingHeaderBoard } from './components/SchedulingHeaderBoard';
import { SchedulingOrderCard } from './components/SchedulingOrderCard';
import { SchedulingOrderSheet, type SchedulingOrderAction } from './components/SchedulingOrderSheet';
import { SchedulingSummaryCells } from './components/SchedulingSummaryCells';
import { StageDaySheet } from './components/StageDaySheet';
import { UnscheduledWorkspace } from './components/UnscheduledWorkspace';
import { WorkerDaySheet } from './components/WorkerDaySheet';
import {
  useAtRiskQuery,
  useFactoryDayQuery,
  useSchedulingCalendarQuery,
  useSchedulingCapacityQuery,
  useSchedulingSummaryQuery,
  useOrderScheduleQuery,
  useUnscheduledOrdersQuery,
} from './query';
import { selectFactoryLoadByDay } from './selectFactoryCapacity';
import {
  filterScheduleCards,
  groupSchedulingCardsBySalesOrder,
  selectAdminCalendarDayMeta,
  selectAtRiskCards,
  selectConflictCards,
  selectDashboardStats,
  selectOrdersForDay,
  selectOrdersInRange,
  weekRangeFromYmd,
} from './selectAdminScheduling';
import {
  filterUnscheduledCards,
  matchesDealerNames,
  uniqueDealers,
  workersForStage,
  type TowerFocus,
} from './selectFactoryTower';
import type { FactoryDayWorker } from '@/api/modules/scheduling';
import { AtRiskOrderCard } from './components/AtRiskOrderCard';
import { SchedulingSalesOrderGroups } from './components/SchedulingSalesOrderGroups';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

export function AdminSchedulingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const canApprove = can(user, 'schedule.approve');
  const canManage = can(user, 'schedule.manage');
  const canAssignWorkers = canManage || can(user, 'production-order.assign');
  const canAdjustHours = can(user, 'schedule.settings.manage');
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const tabClearance = insets.bottom + SURFACE_TAB_BAR_CLEARANCE;

  const today = todayYmd();
  const weekRange = useMemo(() => weekRangeFromYmd(today), [today]);
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(today));
  const [selectedDay, setSelectedDay] = useState(today);
  const [focus, setFocus] = useState<TowerFocus>(null);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dealer, setDealer] = useState<SchedulingDealerPick | null>(null);
  const [readiness, setReadiness] = useState<SchedulingReadinessFilter>('all');

  const [dayExceptionOpen, setDayExceptionOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageMeta, setStageMeta] = useState<{ id: string; name: string } | null>(null);
  const [worker, setWorker] = useState<FactoryDayWorker | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ScheduleOrderCard | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [changeDateOpen, setChangeDateOpen] = useState(false);
  const [scheduleOrder, setScheduleOrder] = useState<UnscheduledOrderCard | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftPlacement>>({});
  const [task, setTask] = useState<ProductionTaskRow | null>(null);
  const [draftAssign, setDraftAssign] = useState(false);

  const monthRange = useMemo(() => monthRangeYmd(cursor), [cursor]);
  const summaryQuery = useSchedulingSummaryQuery();
  const calendarQuery = useSchedulingCalendarQuery({
    from: monthRange.from,
    to: monthRange.to,
    view: 'month',
  });
  const capacityQuery = useSchedulingCapacityQuery({
    from: monthRange.from,
    to: monthRange.to,
    granularity: 'day',
  });
  const dayQuery = useFactoryDayQuery({ date: selectedDay });
  const unscheduledQuery = useUnscheduledOrdersQuery();
  const dealersQuery = useProductionDealersQuery(filterOpen || Boolean(dealer));
  const atRiskQuery = useAtRiskQuery(focus === 'atRisk');
  const detailQuery = useProductionOrderQuery(
    selectedOrder?.productionOrderId,
    Boolean(selectedOrder),
  );
  const orderScheduleQuery = useOrderScheduleQuery(
    selectedOrder?.productionOrderId,
    Boolean(selectedOrder),
  );
  const workersQuery = useAssignableWorkersQuery(
    Boolean(task) || Boolean(scheduleOrder),
    undefined,
    task?.stageDefinitionId ?? undefined,
    {
      taskId: task?.id,
      plannedStart: task?.plannedStart ?? undefined,
      plannedCompletion: task?.plannedCompletion ?? undefined,
    },
  );
  const historyQuery = useQuery({
    queryKey: [...queryKeys.scheduling.all, 'history', selectedOrder?.productionOrderId ?? ''],
    queryFn: () => getScheduleHistory(selectedOrder!.productionOrderId),
    enabled: Boolean(selectedOrder?.productionOrderId && task),
  });
  const impactQuery = useQuery({
    queryKey: [...queryKeys.scheduling.all, 'day-impact', selectedDay],
    queryFn: () => getDayExceptionImpact(selectedDay),
    enabled: dayExceptionOpen,
  });

  const stats = useMemo(() => selectDashboardStats(summaryQuery.data), [summaryQuery.data]);
  const dayMeta = useMemo(
    () =>
      selectAdminCalendarDayMeta(
        calendarQuery.data?.days,
        calendarQuery.data?.orders,
        selectFactoryLoadByDay(capacityQuery.data, locale),
      ),
    [calendarQuery.data, capacityQuery.data, locale],
  );
  const day = dayQuery.data;
  const dealerNames = dealer?.names;
  const dealerOptions = useMemo(() => {
    const customers = dealersQuery.data?.data ?? [];
    if (customers.length > 0) {
      return customers.map((customer) => {
        const name = localizedName(locale, customer, customer.code || customer.name || '—');
        const names = [
          name,
          customer.name,
          customer.nameEn,
          customer.nameAr,
          customer.nameHe,
          customer.code,
        ].filter((value): value is string => Boolean(value?.trim()));
        return {
          id: customer.id,
          name,
          code: customer.code,
          searchText: names.join(' '),
          names,
        };
      });
    }
    return uniqueDealers(unscheduledQuery.data).map((name) => ({
      id: name,
      name,
      names: [name],
      searchText: name,
    }));
  }, [dealersQuery.data, locale, unscheduledQuery.data]);
  const dayOrders = useMemo(
    () =>
      filterScheduleCards(
        selectOrdersForDay(day?.orders ?? calendarQuery.data?.orders, selectedDay, locale),
        query,
      ).filter((card) => matchesDealerNames(card.dealerName, dealerNames)),
    [calendarQuery.data?.orders, day?.orders, dealerNames, locale, query, selectedDay],
  );
  const weekOrders = useMemo(
    () =>
      filterScheduleCards(
        selectOrdersInRange(calendarQuery.data?.orders, weekRange.from, weekRange.to, locale),
        query,
      ).filter((card) => matchesDealerNames(card.dealerName, dealerNames)),
    [calendarQuery.data?.orders, dealerNames, locale, query, weekRange.from, weekRange.to],
  );
  const unscheduled = useMemo(
    () =>
      filterUnscheduledCards(unscheduledQuery.data, {
        q: query,
        dealerNames,
        readiness,
      }),
    [dealerNames, query, readiness, unscheduledQuery.data],
  );
  const atRisk = useMemo(
    () =>
      filterScheduleCards(selectAtRiskCards(atRiskQuery.data?.data, locale), query).filter((card) =>
        matchesDealerNames(card.dealerName, dealerNames),
      ),
    [atRiskQuery.data, dealerNames, locale, query],
  );
  const conflicts = useMemo(
    () =>
      filterScheduleCards(selectConflictCards(calendarQuery.data?.orders, locale), query).filter((card) =>
        matchesDealerNames(card.dealerName, dealerNames),
      ),
    [calendarQuery.data?.orders, dealerNames, locale, query],
  );
  const overtimeWorkers = (day?.workers ?? []).filter((row) => row.overtime);
  const detail = detailQuery.data ? selectProductionDetail(detailQuery.data, locale) : null;
  const liveSchedule =
    orderScheduleQuery.data && !isOwnOrderSchedule(orderScheduleQuery.data)
      ? orderScheduleQuery.data
      : null;
  const scheduleStatus = String(liveSchedule?.schedule?.status ?? selectedOrder?.status ?? '');
  const scheduleVersion = liveSchedule?.schedule?.version ?? selectedOrder?.version ?? 0;
  const executionStarted = Boolean(liveSchedule?.executionStarted);
  const liveCanApprove =
    liveSchedule?.canApprove ??
    (scheduleStatus === 'PROPOSED' ||
      scheduleStatus === 'NEEDS_REVIEW' ||
      scheduleStatus === 'DRAFT');
  const liveCanUnapprove = liveSchedule?.canUnapprove ?? scheduleStatus === 'APPROVED';
  const orderAction: SchedulingOrderAction = executionStarted
    ? 'locked'
    : liveCanUnapprove || scheduleStatus === 'APPROVED'
      ? 'overwrite'
      : 'approve';
  const calendarMeta = calendarQuery.data?.calendar as
    | {
        shiftStart?: string;
        shiftEnd?: string;
        exceptions?: Array<{ date?: string; type?: string; shiftEnd?: string | null }>;
      }
    | undefined;
  const selectedDayException = (calendarMeta?.exceptions ?? []).find((row) => row.date === selectedDay);
  const selectedDayInfo = calendarQuery.data?.days?.find((row) => row.date.slice(0, 10) === selectedDay);

  const invalidatePlacement = (productionOrderId?: string) => {
    for (const key of invalidateKeys.afterPlacementMutation(productionOrderId)) {
      void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
    }
  };

  const refetchAll = async () => {
    await Promise.all([
      summaryQuery.refetch(),
      calendarQuery.refetch(),
      capacityQuery.refetch(),
      dayQuery.refetch(),
      unscheduledQuery.refetch(),
      atRiskQuery.refetch(),
    ]);
  };

  const mutationError = (err: unknown) =>
    isApiError(err) || err instanceof Error
      ? toastMessageForError(err)
      : t('mobile.adminScheduling.sheets.genericError');

  const approveMutation = useMutation({
    mutationFn: async (vars: { id: string; version: number }) => {
      let version = vars.version;
      try {
        const latest = await getOrderSchedule(vars.id);
        if (!isOwnOrderSchedule(latest) && latest.schedule?.version != null) {
          version = latest.schedule.version;
        }
      } catch {
        /* keep card version */
      }
      return approveSchedule(vars.id, { version, idempotencyKey: `approve-${vars.id}-${Date.now()}` });
    },
    onSuccess: (_data, vars) => {
      invalidatePlacement(vars.id);
      setApproveOpen(false);
      haptics.completeStrong();
      showToast({ variant: 'success', message: t('mobile.adminScheduling.sheets.approveSuccess') });
    },
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const unapproveMutation = useMutation({
    mutationFn: async (vars: { id: string; version: number }) => {
      let version = vars.version;
      try {
        const latest = await getOrderSchedule(vars.id);
        if (!isOwnOrderSchedule(latest) && latest.schedule?.version != null) {
          version = latest.schedule.version;
        }
      } catch {
        /* keep card version */
      }
      return unapproveSchedule(vars.id, {
        version,
        idempotencyKey: `unapprove-${vars.id}-${Date.now()}`,
      });
    },
    onSuccess: (_data, vars) => {
      invalidatePlacement(vars.id);
      setOverwriteOpen(false);
      haptics.completeStrong();
      showToast({ variant: 'success', message: t('mobile.adminScheduling.sheets.overwriteApprovalSuccess') });
    },
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const changeDateMutation = useMutation({
    mutationFn: (vars: { id: string; isoDate: string; reason?: string }) =>
      dealerDateChange(vars.id, {
        requestedDeliveryDate: vars.isoDate,
        reason: vars.reason,
        idempotencyKey: `admin-date-${vars.id}-${Date.now()}`,
      }),
    onSuccess: (_data, vars) => {
      invalidatePlacement(vars.id);
      setChangeDateOpen(false);
      haptics.completeStrong();
      showToast({ variant: 'success', message: t('mobile.adminScheduling.sheets.changeDateSuccess') });
    },
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const placeMutation = useMutation({
    mutationFn: (payload: DraftPlacement) =>
      assignTask(payload.taskId, {
        employeeId: payload.employeeId,
        plannedStart: payload.plannedStart,
        plannedCompletion: payload.plannedCompletion,
        overtime: payload.overtime,
        overrideConflict: payload.overrideConflict,
        acknowledge: payload.acknowledge ?? payload.overrideConflict,
        reason: payload.reason,
        priority: payload.priority,
      }),
    onSuccess: () => invalidatePlacement(selectedOrder?.productionOrderId ?? scheduleOrder?.id),
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const confirmScheduleMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.values(drafts);
      for (const row of rows) {
        await assignTask(row.taskId, {
          employeeId: row.employeeId,
          plannedStart: row.plannedStart,
          plannedCompletion: row.plannedCompletion,
          overtime: row.overtime,
          overrideConflict: row.overrideConflict,
          acknowledge: row.acknowledge ?? row.overrideConflict,
          reason: row.reason,
          priority: row.priority,
        });
      }
    },
    onSuccess: () => {
      invalidatePlacement(scheduleOrder?.id);
      setScheduleOrder(null);
      setDrafts({});
      haptics.completeStrong();
      showToast({ variant: 'success', message: t('mobile.adminScheduling.scheduleOrder.placed') });
    },
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const dayExceptionMutation = useMutation({
    mutationFn: async (
      action:
        | { kind: 'open' }
        | { kind: 'close' }
        | { kind: 'overtime'; end: string; overtimeEmployeeIds?: string[] }
        | { kind: 'clear' },
    ) => {
      if (action.kind === 'clear') return deleteCalendarException(selectedDay);
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
          overtimeEmployeeIds: action.overtimeEmployeeIds,
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
    onSuccess: () => {
      setDayExceptionOpen(false);
      invalidatePlacement();
      void calendarQuery.refetch();
      void dayQuery.refetch();
    },
    onError: (err) => showToast({ variant: 'error', message: mutationError(err) }),
  });

  const onSelectFocus = (key: TowerFocus) => {
    setFocus(key);
    setQuery('');
    if (key === 'today' || key === 'week' || key === 'overtime') {
      setSelectedDay(today);
      setCursor(initialCursorFromValue(today));
    }
  };

  const loading = summaryQuery.isLoading && !summaryQuery.data;
  const failed = summaryQuery.isError && !summaryQuery.data;
  const stageWorkers = workersForStage(day, stageMeta?.id ?? '');
  const stageRow = day?.stages.find(
    (row) => (row.stageDefinitionId ?? row.departmentId ?? row.code) === stageMeta?.id,
  );
  const freeWindows = worker
    ? worker.freeWindows
    : task
      ? day?.workers.find((row) => row.employeeId === task.assigneeId)?.freeWindows
      : undefined;

  return (
    <AppScreen backFallback={BACK_FALLBACK} padding="lg">
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: tabClearance + theme.spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={Boolean(summaryQuery.isRefetching && !loading)} onRefresh={() => void refetchAll()} />
        }
      >
        <SchedulingHeaderBoard
          query={query}
          onQueryChange={setQuery}
          filterActive={Boolean(dealer) || readiness !== 'all'}
          onOpenFilters={() => setFilterOpen(true)}
        />
        {failed ? (
          <ErrorState
            title={t('mobile.adminScheduling.errorTitle')}
            description={t('mobile.adminScheduling.errorBody')}
            onRetry={() => void refetchAll()}
            retryLabel={t('mobile.adminScheduling.retry')}
          />
        ) : (
          <SchedulingSummaryCells stats={stats} focus={focus} onSelect={onSelectFocus} />
        )}

        {focus === 'unscheduled' ? (
          <UnscheduledWorkspace
            orders={unscheduled}
            onOpen={(order) => setScheduleOrder(order)}
            onSchedule={(order) => {
              setDrafts({});
              setScheduleOrder(order);
            }}
          />
        ) : null}

        {focus === 'atRisk' ? (
          <SchedulingSalesOrderGroups
            groups={groupSchedulingCardsBySalesOrder(atRisk)}
            renderCard={(card) => (
              <AtRiskOrderCard
                card={card}
                onPress={() => {
                  void haptics.selection();
                  setSelectedOrder({
                    id: card.id,
                    productionOrderId: card.productionOrderId,
                    number: card.number,
                    productName: card.title,
                    dealerName: card.dealerName,
                    imageUrl: card.imageUrl,
                    plannedStart: card.plannedStart,
                    plannedEnd: card.plannedEnd,
                    status: card.status,
                    materialRisk: card.materialRisk,
                    hasConflict: card.hasConflict,
                    conflictReason: card.reason,
                    version: card.scheduleVersion,
                    requestedDeliveryDate: card.requiredDeliveryDate,
                    committedDeliveryDate: card.committedDeliveryDate,
                  } as ScheduleOrderCard);
                }}
              />
            )}
          />
        ) : null}

        {focus === 'conflicts' ? (
          <View style={{ gap: theme.spacing.sm }}>
            {conflicts.map((card, index) => (
              <ListItemEnter key={card.productionOrderId} index={index}>
                <SchedulingOrderCard
                  order={{
                    id: card.id,
                    productionOrderId: card.productionOrderId,
                    number: card.number,
                    productName: card.title,
                    dealerName: card.dealerName,
                    imageUrl: card.imageUrl,
                    plannedStart: card.plannedStart,
                    plannedEnd: card.plannedEnd,
                    status: card.status,
                    materialRisk: card.materialRisk,
                    hasConflict: card.hasConflict,
                    conflictReason: card.reason,
                    requestedDeliveryDate: card.requiredDeliveryDate,
                    committedDeliveryDate: card.committedDeliveryDate,
                  }}
                  onPress={() =>
                    setSelectedOrder({
                      id: card.id,
                      productionOrderId: card.productionOrderId,
                      number: card.number,
                      productName: card.title,
                      dealerName: card.dealerName,
                      imageUrl: card.imageUrl,
                      plannedStart: card.plannedStart,
                      plannedEnd: card.plannedEnd,
                      status: card.status,
                      materialRisk: card.materialRisk,
                      hasConflict: true,
                      conflictReason: card.reason,
                      version: card.scheduleVersion,
                      requestedDeliveryDate: card.requiredDeliveryDate,
                      committedDeliveryDate: card.committedDeliveryDate,
                    })
                  }
                />
              </ListItemEnter>
            ))}
          </View>
        ) : null}

        {focus === 'week' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText>{t('mobile.adminScheduling.weekOrdersTitle')}</AppText>
            <SchedulingSalesOrderGroups
              groups={groupSchedulingCardsBySalesOrder(weekOrders)}
              renderCard={(card) => (
                <SchedulingOrderCard
                  order={{
                    id: card.id,
                    productionOrderId: card.productionOrderId,
                    number: card.number,
                    productName: card.title,
                    dealerName: card.dealerName,
                    imageUrl: card.imageUrl,
                    plannedStart: card.plannedStart,
                    plannedEnd: card.plannedEnd,
                    status: card.status,
                    materialRisk: card.materialRisk,
                    hasConflict: card.hasConflict,
                    requestedDeliveryDate: card.requiredDeliveryDate,
                    committedDeliveryDate: card.committedDeliveryDate,
                  }}
                  onPress={() =>
                    setSelectedOrder({
                      id: card.id,
                      productionOrderId: card.productionOrderId,
                      number: card.number,
                      productName: card.title,
                      dealerName: card.dealerName,
                      imageUrl: card.imageUrl,
                      plannedStart: card.plannedStart,
                      plannedEnd: card.plannedEnd,
                      status: card.status,
                      materialRisk: card.materialRisk,
                      hasConflict: card.hasConflict,
                      version: card.scheduleVersion,
                      requestedDeliveryDate: card.requiredDeliveryDate,
                      committedDeliveryDate: card.committedDeliveryDate,
                    })
                  }
                />
              )}
            />
          </View>
        ) : null}

        {focus !== 'unscheduled' && focus !== 'atRisk' && focus !== 'conflicts' && focus !== 'week' ? (
          <>
            <FactoryMonthBoard
              selectedDay={selectedDay}
              cursor={cursor}
              onCursorChange={setCursor}
              dayMeta={dayMeta}
              onSelectDay={(ymd) => {
                setSelectedDay(ymd);
                if (focus === 'today') setFocus(null);
              }}
            />
            {day ? (
              <FactoryDayWorkspace
                day={day}
                onOpenStage={(stageId, _code, name) => {
                  setStageMeta({ id: stageId || name, name });
                  setStageOpen(true);
                }}
                onAdjustHours={() => {
                  if (!canAdjustHours) return;
                  setDayExceptionOpen(true);
                }}
              />
            ) : null}
            {focus === 'overtime' && overtimeWorkers.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                {overtimeWorkers.map((row) => (
                  <ListItemEnter key={row.employeeId} index={0}>
                    <SchedulingOrderCard
                      order={{
                        id: row.employeeId,
                        productionOrderId: row.employeeId,
                        number: row.name,
                        productName: t('mobile.adminScheduling.overtimeBadge'),
                        plannedStart: row.overtimeAfter,
                        plannedEnd: row.overtimeAfter,
                      }}
                      onPress={() => setWorker(row)}
                    />
                  </ListItemEnter>
                ))}
              </View>
            ) : null}
            <View style={{ gap: theme.spacing.sm }}>
              <AppText>{t('mobile.adminScheduling.dayOrdersTitle', { date: selectedDay })}</AppText>
              <SchedulingSalesOrderGroups
                groups={groupSchedulingCardsBySalesOrder(dayOrders)}
                renderCard={(card) => (
                  <SchedulingOrderCard
                    order={{
                      id: card.id,
                      productionOrderId: card.productionOrderId,
                      number: card.number,
                      productName: card.title,
                      dealerName: card.dealerName,
                      imageUrl: card.imageUrl,
                      plannedStart: card.plannedStart,
                      plannedEnd: card.plannedEnd,
                      status: card.status,
                      materialRisk: card.materialRisk,
                      hasConflict: card.hasConflict,
                      requestedDeliveryDate: card.requiredDeliveryDate,
                      committedDeliveryDate: card.committedDeliveryDate,
                    }}
                    onPress={() =>
                      setSelectedOrder({
                        id: card.id,
                        productionOrderId: card.productionOrderId,
                        number: card.number,
                        productName: card.title,
                        dealerName: card.dealerName,
                        imageUrl: card.imageUrl,
                        plannedStart: card.plannedStart,
                        plannedEnd: card.plannedEnd,
                        status: card.status,
                        materialRisk: card.materialRisk,
                        hasConflict: card.hasConflict,
                        version: card.scheduleVersion,
                        requestedDeliveryDate: card.requiredDeliveryDate,
                        committedDeliveryDate: card.committedDeliveryDate,
                      })
                    }
                  />
                )}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <SchedulingFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        dealers={dealerOptions}
        loading={dealersQuery.isPending && !dealersQuery.data}
        dealer={dealer}
        readiness={readiness}
        onApply={(next) => {
          setDealer(next.dealer);
          setReadiness(next.readiness);
        }}
      />

      <StageDaySheet
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        date={selectedDay}
        stageName={stageMeta?.name ?? ''}
        day={day}
        workers={stageWorkers}
        scheduledMinutes={stageRow?.allocatedMinutes ?? stageRow?.bookedMinutes ?? 0}
        availableMinutes={stageRow?.availableMinutes ?? stageRow?.capacityMinutes ?? 0}
        onOpenWorker={(next) => {
          setWorker(next);
        }}
      />
      <WorkerDaySheet open={Boolean(worker)} onClose={() => setWorker(null)} worker={worker} date={selectedDay} />

      <SchedulingOrderSheet
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        action={orderAction}
        canApprove={canApprove && liveCanApprove}
        canOverwrite={canApprove && liveCanUnapprove}
        onApprove={() => setApproveOpen(true)}
        onChangeDate={() => setChangeDateOpen(true)}
        onOverwriteApproval={() => setOverwriteOpen(true)}
        tasks={detail?.tasks ?? []}
        onOpenTask={(next) => {
          setDraftAssign(false);
          setTask(next);
        }}
      />

      <ScheduleOrderSheet
        open={Boolean(scheduleOrder)}
        onClose={() => {
          setScheduleOrder(null);
          setDrafts({});
        }}
        order={scheduleOrder}
        initialDate={selectedDay}
        confirming={confirmScheduleMutation.isPending}
        drafts={drafts}
        onEditTask={(next) => {
          setDraftAssign(true);
          setTask(next);
        }}
        onConfirm={() => confirmScheduleMutation.mutate()}
      />

      <ProductionTaskSheet
        open={Boolean(task)}
        onClose={() => setTask(null)}
        overlay
        task={task}
        workers={workersQuery.data ?? []}
        workersLoading={workersQuery.isLoading && !workersQuery.data}
        canAssign={canAssignWorkers}
        canUpdateTask={false}
        intent="plan"
        assignLoading={placeMutation.isPending}
        orderPlannedStartDate={detail?.plannedStartDate ?? selectedOrder?.plannedStart ?? null}
        freeWindows={freeWindows}
        history={historyQuery.data}
        onOpenStageTimes={() => {
          if (!selectedOrder?.productionOrderId) return;
          setTask(null);
          router.push(adminProductionFlowHref(selectedOrder.productionOrderId));
        }}
        onAssign={(payload) => {
          if (!task) return;
          const draft: DraftPlacement = {
            taskId: task.id,
            employeeId: payload.employeeId,
            plannedStart: payload.plannedStart ?? '',
            plannedCompletion: payload.plannedCompletion ?? '',
            overtime: payload.overtime,
            overrideConflict: payload.overrideConflict,
            acknowledge: payload.acknowledge,
            reason: payload.reason,
            priority: payload.priority,
          };
          if (draftAssign) {
            setDrafts((prev) => ({ ...prev, [task.id]: draft }));
            setTask(null);
            return;
          }
          placeMutation.mutate(draft, { onSuccess: () => setTask(null) });
        }}
        onSaveNotes={() => undefined}
        onHold={() => undefined}
        onBlock={() => undefined}
      />

      <ApproveScheduleSheet
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        orderNumber={selectedOrder?.number ?? ''}
        loading={approveMutation.isPending}
        onConfirm={() => {
          if (!selectedOrder?.productionOrderId || scheduleVersion == null) return;
          approveMutation.mutate({ id: selectedOrder.productionOrderId, version: scheduleVersion });
        }}
      />
      <OverwriteApprovalSheet
        open={overwriteOpen}
        onClose={() => setOverwriteOpen(false)}
        orderNumber={selectedOrder?.number ?? ''}
        loading={unapproveMutation.isPending}
        onConfirm={() => {
          if (!selectedOrder?.productionOrderId || scheduleVersion == null) return;
          unapproveMutation.mutate({ id: selectedOrder.productionOrderId, version: scheduleVersion });
        }}
      />
      <AdminChangeScheduleDateSheet
        open={changeDateOpen}
        onClose={() => setChangeDateOpen(false)}
        current={selectedOrder?.committedDeliveryDate ?? selectedOrder?.requestedDeliveryDate ?? selectedDay}
        loading={changeDateMutation.isPending}
        onSubmit={(isoDate, reason) => {
          if (!selectedOrder) return;
          changeDateMutation.mutate({ id: selectedOrder.productionOrderId, isoDate, reason });
        }}
      />
      <AdminDayExceptionSheet
        open={dayExceptionOpen}
        onClose={() => setDayExceptionOpen(false)}
        dateYmd={selectedDay}
        isWorking={selectedDayInfo?.isWorking ?? !day?.closed}
        hasException={Boolean(selectedDayException)}
        defaultShiftStart={calendarMeta?.shiftStart ?? '08:00'}
        defaultShiftEnd={calendarMeta?.shiftEnd ?? '16:00'}
        currentOvertimeEnd={
          selectedDayException?.type === 'EXTRA_SHIFT' ? selectedDayException.shiftEnd : null
        }
        loading={dayExceptionMutation.isPending}
        workers={(day?.workers ?? []).map((row) => ({ id: row.employeeId, name: row.name }))}
        impactSummary={
          impactQuery.data
            ? t('mobile.adminScheduling.dayCapacity.impact', {
                tasks: impactQuery.data.taskCount,
                orders: impactQuery.data.orderCount,
              })
            : null
        }
        onOpenDay={() => dayExceptionMutation.mutate({ kind: 'open' })}
        onCloseDay={() => dayExceptionMutation.mutate({ kind: 'close' })}
        onOvertime={(end, overtimeEmployeeIds) =>
          dayExceptionMutation.mutate({ kind: 'overtime', end, overtimeEmployeeIds })
        }
        onClearException={() => dayExceptionMutation.mutate({ kind: 'clear' })}
      />
    </AppScreen>
  );
}
