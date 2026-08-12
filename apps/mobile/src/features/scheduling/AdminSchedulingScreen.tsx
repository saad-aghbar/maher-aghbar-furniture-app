import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
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
import { useNetwork } from '@/components/network/NetworkProvider';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { ActionSheet, type ActionSheetItem } from '@/components/sheets/ActionSheet';
import { formatDate, useLocale } from '@/i18n';
import { AnimatedPressable, SkeletonShimmer, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { invalidateKeys } from '@/api/queryKeys';
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
  isOwnOrderSchedule,
  recalculateSchedule,
  type ProductionScheduleDetail,
} from '@/api/modules/scheduling';
import {
  AdminChangeScheduleDateSheet,
  AdminDayExceptionSheet,
  ApproveScheduleSheet,
  RecalculateScheduleSheet,
} from './components/AdminScheduleSheets';
import {
  useAtRiskQuery,
  useSchedulingCalendarQuery,
  useSchedulingDashboardQuery,
} from './query';
import {
  filterScheduleCards,
  selectAdminCalendarDayMeta,
  selectApprovalsWaiting,
  selectAtRiskCards,
  selectAvailableActions,
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

const FLOOR_ROW_ESTIMATE = 152;
const FLOOR_LIST_VISIBLE_ROWS = 3;
const SCHEDULE_MEDIA = 88;

export function AdminSchedulingScreen() {
  const { t, locale, isRTL } = useLocale();
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
  const [mutationError, setMutationError] = useState<string | null>(null);

  const monthRange = useMemo(() => monthRangeYmd(cursor), [cursor]);

  const dashboardQuery = useSchedulingDashboardQuery();
  const calendarQuery = useSchedulingCalendarQuery({
    from: monthRange.from,
    to: monthRange.to,
    view: 'month',
  });
  const atRiskQuery = useAtRiskQuery();

  /** Always load the current week for today/week focus so lists stay filled while the month cursor resets. */
  const needsWeekWindow = focus === 'today' || focus === 'week';

  const weekCalendarQuery = useSchedulingCalendarQuery(
    needsWeekWindow
      ? { from: weekRange.from, to: weekRange.to, view: 'week' }
      : null,
    Boolean(needsWeekWindow),
  );

  const stats = useMemo(() => selectDashboardStats(dashboardQuery.data), [dashboardQuery.data]);
  const dayMeta = useMemo(
    () => selectAdminCalendarDayMeta(calendarQuery.data?.days, calendarQuery.data?.orders),
    [calendarQuery.data],
  );
  const monthMeta = useMemo(
    () => selectMonthDayMeta(calendarQuery.data?.days, calendarQuery.data?.orders),
    [calendarQuery.data],
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

  const focusCards = useMemo(() => {
    if (!focus) return [];
    if (focus === 'today') return selectOrdersForDay(focusSourceOrders, today, locale);
    if (focus === 'week') {
      return selectOrdersInRange(focusSourceOrders, weekRange.from, weekRange.to, locale);
    }
    if (focus === 'awaitingApproval') return selectApprovalsWaiting(focusSourceOrders, locale);
    if (focus === 'atRisk') return atRisk;
    return selectConflictCards(focusSourceOrders, locale);
  }, [atRisk, focus, focusSourceOrders, locale, today, weekRange.from, weekRange.to]);

  const visibleFocusCards = useMemo(
    () => filterScheduleCards(focusCards, orderSearch),
    [focusCards, orderSearch],
  );
  const visibleDayOrders = useMemo(
    () => filterScheduleCards(dayOrders, orderSearch),
    [dayOrders, orderSearch],
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
      jumpToScheduleStart(detail);
      haptics.completeStrong();
      showToast({
        variant: 'success',
        message: t('mobile.adminScheduling.sheets.recalculateSuccess'),
      });
    },
    onError: (err) => setMutationError(mutationErrorMessage(err)),
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
    onSuccess: () => {
      setDayExceptionOpen(false);
      setMutationError(null);
      void calendarQuery.refetch();
      void dashboardQuery.refetch();
      void atRiskQuery.refetch();
      if (needsWeekWindow) void weekCalendarQuery.refetch();
    },
    onError: (err) => setMutationError(mutationErrorMessage(err)),
  });

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

  const pullRefreshing =
    (dashboardQuery.isRefetching ||
      calendarQuery.isRefetching ||
      atRiskQuery.isRefetching ||
      weekCalendarQuery.isRefetching) &&
    !dashboardQuery.isPlaceholderData &&
    !calendarQuery.isPlaceholderData &&
    !atRiskQuery.isPlaceholderData;

  const refetchAll = () => {
    void dashboardQuery.refetch();
    void calendarQuery.refetch();
    void atRiskQuery.refetch();
    if (needsWeekWindow) void weekCalendarQuery.refetch();
  };

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const openActions = (card: AdminScheduleCardModel) => {
    setSelectedCard(card);
    setMutationError(null);
    setActionSheetOpen(true);
  };

  const actionSheetItems: ActionSheetItem[] = selectedCard
    ? selectAvailableActions(selectedCard).map((mode) =>
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
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={refetchAll} />}
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

            {focusColdLoading || atRiskColdLoading ? (
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
                count={visibleFocusCards.length}
                search={orderSearch}
                onSearchChange={setOrderSearch}
              >
                <CappedNestedScroll
                  itemCount={visibleFocusCards.length}
                  rowEstimate={FLOOR_ROW_ESTIMATE}
                  gap={theme.spacing.sm}
                >
                  {visibleFocusCards.map((card) => (
                    <ScheduleOrderRow key={card.id} card={card} onPress={() => openActions(card)} />
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
                onSelect={setSelectedDay}
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
            </View>

            <View style={{ gap: theme.spacing.sm, opacity: calendarUpdating ? 0.72 : 1 }}>
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
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
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
              {selectedDayInfo && !selectedDayInfo.isWorking ? (
                <ScheduleOrdersBoard
                  title={t('mobile.adminScheduling.dayOrdersTitle', {
                    date: formatDate(locale, selectedDay),
                  })}
                  count={0}
                  search={orderSearch}
                  onSearchChange={setOrderSearch}
                >
                  <EmptyState title={t('mobile.adminScheduling.dayClosed')} />
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
                >
                  <CappedNestedScroll
                    itemCount={visibleDayOrders.length}
                    rowEstimate={FLOOR_ROW_ESTIMATE}
                    gap={theme.spacing.sm}
                  >
                    {visibleDayOrders.map((card) => (
                      <ScheduleOrderRow
                        key={card.id}
                        card={card}
                        onPress={() => openActions(card)}
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
        loading={dayExceptionMutation.isPending}
        errorMessage={mutationError}
        onOpenDay={() => dayExceptionMutation.mutate({ kind: 'open' })}
        onCloseDay={() => dayExceptionMutation.mutate({ kind: 'close' })}
        onOvertime={(end) => dayExceptionMutation.mutate({ kind: 'overtime', end })}
        onClearException={() => dayExceptionMutation.mutate({ kind: 'clear' })}
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
        gap: 4,
        ...(fullWidth
          ? {
              width: '100%',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }
          : {
              width: '48%',
              flexGrow: 1,
              minWidth: '46%',
              maxWidth: '48%',
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
          style={{
            ...(fullWidth ? null : { flex: 1, textAlign: isRTL ? 'left' : 'right' }),
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
}: {
  card: AdminScheduleCardModel;
  onPress: () => void;
}) {
  const { t, isRTL, formatDate, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const priority = (card.priority ?? '').toUpperCase();
  const urgent = priority === 'URGENT' || priority === 'HIGH';
  const alerted = card.hasConflict || card.materialRisk;
  const accent = card.hasConflict
    ? colors.error
    : card.materialRisk
      ? colors.error
      : urgent
        ? colors.warning
        : colors.brand;

  const productTitle = card.title !== card.number ? card.title : card.number;
  const plannedStartLabel = card.plannedStart ? formatDate(card.plannedStart) : null;
  const plannedEndLabel = card.plannedEnd ? formatDate(card.plannedEnd) : null;
  const plannedLabel =
    plannedStartLabel && plannedEndLabel && plannedEndLabel !== plannedStartLabel
      ? t('mobile.adminScheduling.plannedWindow', {
          start: plannedStartLabel,
          end: plannedEndLabel,
        })
      : plannedStartLabel
        ? t('mobile.adminScheduling.plannedFor', { date: plannedStartLabel })
        : null;

  const requiredLabel = card.requiredDeliveryDate
    ? t('mobile.adminScheduling.requiredBy', {
        date: formatDate(card.requiredDeliveryDate),
      })
    : null;
  const suggestedLabel =
    !plannedLabel && card.suggestedDeliveryDate
      ? t('mobile.adminScheduling.suggestedBy', {
          date: formatDate(card.suggestedDeliveryDate),
        })
      : null;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${card.number} ${productTitle}`}
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

          {plannedLabel ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={2}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {plannedLabel}
            </AppText>
          ) : null}

          {requiredLabel ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {requiredLabel}
            </AppText>
          ) : null}

          {suggestedLabel ? (
            <AppText
              variant="caption"
              color="muted"
              numberOfLines={1}
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {suggestedLabel}
            </AppText>
          ) : null}

          {card.quantity != null ? (
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.adminScheduling.qty', { count: card.quantity })}
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

          {card.reason ? (
            <AppText
              variant="caption"
              color="secondary"
              numberOfLines={3}
              style={{ textAlign: isRTL ? 'right' : 'left', lineHeight: 18 }}
            >
              {card.reason}
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ height: theme.spacing.sm }} />
      )}
    </AnimatedPressable>
  );
}

function ScheduleOrdersBoard({
  title,
  count,
  search,
  onSearchChange,
  children,
}: {
  title: string;
  count: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
}) {
  const { locale, isRTL, t } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

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
          backgroundColor: colors.brand,
          opacity: 0.55,
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
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {count != null ? (
          <View
            style={{
              minWidth: 28,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: colors.brandSoft,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.brand,
              alignItems: 'center',
            }}
          >
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: colors.brand, fontVariant: ['tabular-nums'], fontSize: 12 }}
            >
              {String(count)}
            </AppText>
          </View>
        ) : null}
      </View>

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
          <TextInput
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

      {count != null && count > FLOOR_LIST_VISIBLE_ROWS ? (
        <View
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
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
            {t('mobile.adminScheduling.scrollForMore')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function CappedNestedScroll({
  itemCount,
  rowEstimate,
  gap,
  visibleRows = FLOOR_LIST_VISIBLE_ROWS,
  children,
}: {
  itemCount: number;
  rowEstimate: number;
  gap: number;
  visibleRows?: number;
  children: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const scrollable = itemCount > visibleRows;
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
