import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
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
import { AnimatedPressable, ListItemEnter, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { invalidateKeys } from '@/api/queryKeys';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  addCalendarException,
  approveSchedule,
  dealerDateChange,
  deleteCalendarException,
  recalculateSchedule,
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
  selectAdminCalendarDayMeta,
  selectApprovalsWaiting,
  selectAtRiskCards,
  selectAvailableActions,
  selectDashboardStats,
  selectMonthDayMeta,
  selectOrdersForDay,
  type AdminScheduleActionMode,
  type AdminScheduleCardModel,
} from './selectAdminScheduling';

export function AdminSchedulingScreen() {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();

  const today = todayYmd();
  const [cursor, setCursor] = useState<CalendarCursor>(() => initialCursorFromValue(today));
  const [selectedDay, setSelectedDay] = useState(today);

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
        exceptions?: Array<{ date: string; type: string; shiftStart?: string | null; shiftEnd?: string | null }>;
      }
    | undefined;
  const selectedDayException = (calendarMeta?.exceptions ?? []).find(
    (ex) => String(ex.date).slice(0, 10) === selectedDay,
  );
  const approvals = useMemo(
    () => selectApprovalsWaiting(calendarQuery.data?.orders, locale),
    [calendarQuery.data, locale],
  );
  const atRisk = useMemo(() => selectAtRiskCards(atRiskQuery.data?.data), [atRiskQuery.data]);

  const invalidateAfterMutation = (productionOrderId: string) => {
    for (const key of invalidateKeys.afterScheduleMutation(productionOrderId)) {
      void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: (vars: { id: string; version: number }) =>
      approveSchedule(vars.id, {
        version: vars.version,
        idempotencyKey: `approve-${vars.id}-${Date.now()}`,
      }),
    onSuccess: (_data, vars) => {
      invalidateAfterMutation(vars.id);
      setApproveOpen(false);
      setMutationError(null);
    },
    onError: () => setMutationError(t('mobile.adminScheduling.sheets.genericError')),
  });

  const changeDateMutation = useMutation({
    mutationFn: (vars: { id: string; isoDate: string; reason?: string }) =>
      dealerDateChange(vars.id, {
        requestedDeliveryDate: vars.isoDate,
        reason: vars.reason,
        idempotencyKey: `admin-date-${vars.id}-${Date.now()}`,
      }),
    onSuccess: (_data, vars) => {
      invalidateAfterMutation(vars.id);
      setChangeDateOpen(false);
      setMutationError(null);
    },
    onError: () => setMutationError(t('mobile.adminScheduling.sheets.genericError')),
  });

  const recalculateMutation = useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      recalculateSchedule(vars.id, { reason: vars.reason }),
    onSuccess: (_data, vars) => {
      invalidateAfterMutation(vars.id);
      setRecalculateOpen(false);
      setMutationError(null);
    },
    onError: () => setMutationError(t('mobile.adminScheduling.sheets.genericError')),
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
    },
    onError: () => setMutationError(t('mobile.adminScheduling.sheets.genericError')),
  });

  /** Initial cold start only — never blank the screen on month change / refetch. */
  const hasAnyData = Boolean(
    dashboardQuery.data || calendarQuery.data || atRiskQuery.data,
  );
  const isInitialLoading =
    !hasAnyData &&
    (dashboardQuery.isLoading || calendarQuery.isLoading || atRiskQuery.isLoading);
  const isError =
    !hasAnyData &&
    (dashboardQuery.isError || calendarQuery.isError || atRiskQuery.isError);

  /** Soft in-place update while month board / sections refetch. */
  const calendarUpdating =
    calendarQuery.isFetching && Boolean(calendarQuery.data);
  const dashboardUpdating =
    dashboardQuery.isFetching && Boolean(dashboardQuery.data);
  const atRiskUpdating = atRiskQuery.isFetching && Boolean(atRiskQuery.data);

  const pullRefreshing =
    (dashboardQuery.isRefetching ||
      calendarQuery.isRefetching ||
      atRiskQuery.isRefetching) &&
    !dashboardQuery.isPlaceholderData &&
    !calendarQuery.isPlaceholderData &&
    !atRiskQuery.isPlaceholderData;

  const refetchAll = () => {
    void dashboardQuery.refetch();
    void calendarQuery.refetch();
    void atRiskQuery.refetch();
  };

  const [animateEnter, setAnimateEnter] = useState(true);
  useEffect(() => {
    if (!animateEnter || !hasAnyData) return;
    if (
      calendarQuery.isPlaceholderData ||
      dashboardQuery.isPlaceholderData ||
      atRiskQuery.isPlaceholderData
    ) {
      return;
    }
    const id = setTimeout(() => setAnimateEnter(false), 520);
    return () => clearTimeout(id);
  }, [
    animateEnter,
    atRiskQuery.isPlaceholderData,
    calendarQuery.isPlaceholderData,
    dashboardQuery.isPlaceholderData,
    hasAnyData,
  ]);

  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const listEnter = (index: number) => (animateEnter && !reduce ? index : 0);

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
          {[0, 1, 2].map((i) => (
            <SurfaceCard key={i} style={{ minHeight: 88, opacity: 0.6 }}>
              <View style={{ gap: theme.spacing.sm }}>
                <View
                  style={{
                    height: 14,
                    width: '55%',
                    borderRadius: theme.radius.sm,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
                <View
                  style={{
                    height: 10,
                    width: '35%',
                    borderRadius: theme.radius.sm,
                    backgroundColor: colors.surfaceSecondary,
                  }}
                />
              </View>
            </SurfaceCard>
          ))}
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
        refreshControl={
          <RefreshControl refreshing={pullRefreshing} onRefresh={refetchAll} />
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
              index={reduce ? 0 : index}
              fullWidth={stats.length % 2 === 1 && index === stats.length - 1}
            />
          ))}
        </View>

        <View
          style={{
            gap: theme.spacing.sm,
            opacity: calendarUpdating ? 0.72 : 1,
          }}
        >
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

        <View
          style={{
            gap: theme.spacing.sm,
            opacity: calendarUpdating ? 0.72 : 1,
          }}
        >
          <AppText variant="heading" weight={titleWeight}>
            {t('mobile.adminScheduling.dayOrdersTitle', {
              date: formatDate(locale, selectedDay),
            })}
          </AppText>
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
            <EmptyState title={t('mobile.adminScheduling.dayClosed')} />
          ) : dayOrders.length === 0 ? (
            <EmptyState title={t('mobile.adminScheduling.dayEmpty')} />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {dayOrders.map((card, index) => (
                <ListItemEnter key={card.id} index={listEnter(index)}>
                  <ScheduleOrderRow card={card} onPress={() => openActions(card)} />
                </ListItemEnter>
              ))}
            </View>
          )}
        </View>

        <View
          style={{
            gap: theme.spacing.sm,
            opacity: calendarUpdating ? 0.72 : 1,
          }}
        >
          <AppText variant="heading" weight={titleWeight}>
            {t('mobile.adminScheduling.approvalsTitle')}
          </AppText>
          {approvals.length === 0 ? (
            <EmptyState title={t('mobile.adminScheduling.approvalsEmpty')} />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {approvals.map((card, index) => (
                <ListItemEnter key={card.id} index={listEnter(index)}>
                  <ScheduleOrderRow card={card} onPress={() => openActions(card)} />
                </ListItemEnter>
              ))}
            </View>
          )}
        </View>

        <View
          style={{
            gap: theme.spacing.sm,
            opacity: atRiskUpdating ? 0.72 : 1,
          }}
        >
          <AppText variant="heading" weight={titleWeight}>
            {t('mobile.adminScheduling.atRiskTitle')}
          </AppText>
          {atRisk.length === 0 ? (
            <EmptyState title={t('mobile.adminScheduling.atRiskEmpty')} />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {atRisk.map((card, index) => (
                <ListItemEnter key={card.id} index={listEnter(index)}>
                  <ScheduleOrderRow card={card} onPress={() => openActions(card)} />
                </ListItemEnter>
              ))}
            </View>
          )}
        </View>
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
  if (mode === 'approve') {
    return {
      label: t('mobile.adminScheduling.sheets.approveTitle'),
      icon: 'checkmark-circle-outline',
      onPress: handlers.onApprove,
    };
  }
  if (mode === 'changeDate') {
    return {
      label: t('mobile.adminScheduling.sheets.changeDateTitle'),
      icon: 'calendar-outline',
      onPress: handlers.onChangeDate,
    };
  }
  return {
    label: t('mobile.adminScheduling.sheets.recalculateTitle'),
    icon: 'refresh-outline',
    onPress: handlers.onRecalculate,
  };
}

function StatChip({
  statKey,
  value,
  tone,
  index = 0,
  fullWidth = false,
}: {
  statKey: string;
  value: number;
  tone: 'neutral' | 'warning' | 'danger';
  index?: number;
  fullWidth?: boolean;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const hot = value > 0 && tone !== 'neutral';
  const accent =
    tone === 'danger' ? colors.error : tone === 'warning' ? colors.warning : colors.brand;
  const wash =
    tone === 'danger'
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

  return (
    <ListItemEnter
      index={index}
      style={
        fullWidth
          ? { width: '100%' }
          : {
              width: '48%',
              flexGrow: 1,
              minWidth: '46%',
              maxWidth: '48%',
            }
      }
    >
      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: hot ? accent : colors.border,
          backgroundColor: wash,
          paddingVertical: theme.spacing.sm + 2,
          paddingHorizontal: theme.spacing.md,
          gap: 6,
          ...(fullWidth
            ? {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
              }
            : null),
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
              width: 32,
              height: 32,
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: hot ? accent : colors.brandSoft,
            }}
          >
            <Ionicons
              name={iconName as 'today-outline'}
              size={16}
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
                letterSpacing: locale === 'ar' ? 0 : 0.35,
                fontSize: 12,
              }}
            >
              {t(`mobile.adminScheduling.stats.${statKey}`)}
            </AppText>
          ) : null}
          <AppText
            variant="title"
            weight="semibold"
            style={{
              ...(fullWidth ? null : { flex: 1, textAlign: isRTL ? 'left' : 'right' }),
              color: hot ? accent : colors.textPrimary,
              fontVariant: ['tabular-nums'],
              letterSpacing: -0.5,
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
              letterSpacing: locale === 'ar' ? 0 : 0.35,
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {t(`mobile.adminScheduling.stats.${statKey}`)}
          </AppText>
        ) : null}
      </View>
    </ListItemEnter>
  );
}

function ScheduleOrderRow({ card, onPress }: { card: AdminScheduleCardModel; onPress: () => void }) {
  const { t, isRTL, formatDate } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={card.number}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: card.hasConflict ? colors.error : colors.border,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
        ...theme.elevation.card,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="body" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
          {card.title !== card.number ? card.title : card.number}
        </AppText>
        {card.status ? <StatusBadge status={card.status} /> : null}
      </View>
      <AppText variant="caption" color="secondary" dir="ltr" numberOfLines={1}>
        {card.number}
        {card.dealerName ? ` · ${card.dealerName}` : ''}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          alignItems: 'center',
        }}
      >
        {card.plannedStart ? (
          <AppText variant="caption" color="muted">
            {t('mobile.adminScheduling.plannedFor', { date: formatDate(card.plannedStart) })}
          </AppText>
        ) : card.suggestedDeliveryDate ? (
          <AppText variant="caption" color="muted">
            {t('mobile.adminScheduling.plannedFor', {
              date: formatDate(card.suggestedDeliveryDate),
            })}
          </AppText>
        ) : null}
        {card.materialRisk ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="warning-outline" size={12} color={colors.error} />
            <AppText variant="caption" style={{ color: colors.error }}>
              {t('mobile.adminScheduling.materialRisk')}
            </AppText>
          </View>
        ) : null}
        {card.hasConflict ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ionicons name="alert-circle-outline" size={12} color={colors.error} />
            <AppText variant="caption" style={{ color: colors.error }}>
              {t('mobile.adminScheduling.conflict')}
            </AppText>
          </View>
        ) : null}
      </View>
      {card.reason ? (
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {card.reason}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}
