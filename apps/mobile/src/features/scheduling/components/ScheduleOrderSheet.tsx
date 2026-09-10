import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import type { UnscheduledOrderCard } from '@/api/modules/scheduling';
import {
  useFactoryDayQuery,
  useSchedulingCalendarQuery,
  useSchedulingCapacityQuery,
} from '../query';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import {
  CalendarLegend,
  MonthCalendar,
  initialCursorFromValue,
  monthRangeYmd,
  todayYmd,
  type CalendarCursor,
} from '@/components/calendar';
import { addDaysToYmd, selectAdminCalendarDayMeta } from '../selectAdminScheduling';
import { selectFactoryLoadByDay } from '../selectFactoryCapacity';
import { canScheduleOrder, minutesLabel, unscheduledStageToTaskRow } from '../selectFactoryTower';
import type { ProductionTaskRow } from '@/features/production/selectProduction';

export type DraftPlacement = {
  taskId: string;
  employeeId: string;
  plannedStart: string;
  plannedCompletion: string;
  overtime?: boolean;
  overrideConflict?: boolean;
  acknowledge?: boolean;
  reason?: string;
  priority?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  order: UnscheduledOrderCard | null;
  confirming?: boolean;
  /** Factory day the tower was on when the sheet opened. */
  initialDate?: string;
  onEditTask: (task: ProductionTaskRow) => void;
  drafts: Record<string, DraftPlacement>;
  onConfirm: (date: string) => void;
};

function seedYmd(value?: string) {
  const ymd = value?.slice(0, 10) ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : todayYmd();
}

export function ScheduleOrderSheet({
  open,
  onClose,
  order,
  confirming,
  initialDate,
  onEditTask,
  drafts,
  onConfirm,
}: Props) {
  const { t, locale, formatDate, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [date, setDate] = useState(() => seedYmd(initialDate));
  const [cursor, setCursor] = useState<CalendarCursor>(() =>
    initialCursorFromValue(seedYmd(initialDate)),
  );

  useEffect(() => {
    if (!open) return;
    const next = seedYmd(initialDate);
    setDate(next);
    setCursor(initialCursorFromValue(next));
  }, [open, initialDate]);

  const applyDate = (ymd: string) => {
    setDate(ymd);
    setCursor((prev) => {
      const next = initialCursorFromValue(ymd);
      return prev.y === next.y && prev.m === next.m ? prev : next;
    });
  };

  const monthRange = useMemo(() => monthRangeYmd(cursor), [cursor]);
  const calendarEnabled = open && Boolean(order);
  const calendarQuery = useSchedulingCalendarQuery(
    calendarEnabled ? { from: monthRange.from, to: monthRange.to, view: 'month' } : null,
    calendarEnabled,
  );
  const capacityQuery = useSchedulingCapacityQuery(
    calendarEnabled
      ? { from: monthRange.from, to: monthRange.to, granularity: 'day' }
      : null,
    calendarEnabled,
  );
  const dayMeta = useMemo(
    () =>
      selectAdminCalendarDayMeta(
        calendarQuery.data?.days,
        calendarQuery.data?.orders,
        selectFactoryLoadByDay(capacityQuery.data, locale),
      ),
    [calendarQuery.data, capacityQuery.data, locale],
  );
  const dayQuery = useFactoryDayQuery({ date }, calendarEnabled);
  const day = dayQuery.data;
  const schedulable = order ? canScheduleOrder(order.planningState) : false;
  const tasks = useMemo(
    () => (order ? order.stages.map((stage) => unscheduledStageToTaskRow(order, stage, locale)) : []),
    [locale, order],
  );
  const placedCount = tasks.filter((task) => drafts[task.id] || task.assigneeId).length;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      expandable
      sheetHeight={Math.round(height * 0.88)}
      title={t('mobile.adminScheduling.scheduleOrder.title')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        {!order || !schedulable ? (
          <DealerEmptyPanel text={t('mobile.adminScheduling.unscheduled.needsPlanningHint')} />
        ) : (
          <>
            <DealerBoard title={t('mobile.adminScheduling.scheduleOrder.dateStep')}>
              <AppText weight={titleWeight} dir="ltr">
                {order.salesOrderNumber ?? order.number}
              </AppText>
              <AppText color="secondary">{formatDate(date)}</AppText>
              {day ? (
                <AppText color="secondary">
                  {t('mobile.adminScheduling.scheduleOrder.dayFacts', {
                    load: `${day.load.factoryLoadPercent}%`,
                    available: minutesLabel(day.availableWorkerMinutes),
                    planned: minutesLabel(day.plannedMinutes),
                    closed: day.closed
                      ? t('mobile.adminScheduling.dayClosed')
                      : t('mobile.adminScheduling.dayCapacity.statusOpen'),
                  })}
                </AppText>
              ) : null}

              <View
                style={{
                  marginTop: theme.spacing.sm,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                }}
              >
                <MonthCalendar
                  variant="admin"
                  embedded
                  value={date}
                  onSelect={applyDate}
                  monthCursor={cursor}
                  onMonthChange={setCursor}
                  dayMeta={dayMeta}
                  disableUnavailable={false}
                />
                <View style={{ marginTop: theme.spacing.sm }}>
                  <CalendarLegend variant="admin" compact />
                </View>
              </View>

              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: 8,
                  marginTop: theme.spacing.sm,
                }}
              >
                {[-1, 1].map((delta) => (
                  <AnimatedPressable
                    key={delta}
                    variant="button"
                    onPress={() => {
                      void haptics.selection();
                      applyDate(addDaysToYmd(date, delta));
                    }}
                    style={{
                      minHeight: 44,
                      flex: 1,
                      borderRadius: theme.radius.xl,
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AppText weight={titleWeight}>
                      {delta < 0
                        ? t('mobile.adminScheduling.capacity.previousDay')
                        : t('mobile.adminScheduling.capacity.nextDay')}
                    </AppText>
                  </AnimatedPressable>
                ))}
              </View>
            </DealerBoard>

            <DealerBoard title={t('mobile.adminScheduling.scheduleOrder.tasksStep')}>
              {tasks.map((task, index) => {
                const draft = drafts[task.id];
                return (
                  <ListItemEnter key={task.id} index={index}>
                    <AnimatedPressable
                      variant="card"
                      onPress={() => {
                        void haptics.selection();
                        onEditTask(task);
                      }}
                      style={{
                        borderRadius: theme.radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                        padding: theme.spacing.md,
                        marginBottom: theme.spacing.sm,
                      }}
                    >
                      <AppText weight={titleWeight}>{task.name}</AppText>
                      <AppText color="secondary" dir="ltr">
                        {minutesLabel(task.estimatedMinutes ?? 0)}
                        {draft
                          ? ` · ${t('mobile.adminScheduling.scheduleOrder.draftReady')}`
                          : task.assigneeName
                            ? ` · ${task.assigneeName}`
                            : ` · ${t('mobile.adminScheduling.unscheduledStatus')}`}
                      </AppText>
                    </AnimatedPressable>
                  </ListItemEnter>
                );
              })}
            </DealerBoard>

            <DealerFormFooter
              confirmLabel={t('mobile.adminScheduling.scheduleOrder.confirm', {
                count: placedCount,
              })}
              onConfirm={() => {
                void haptics.confirmMedium();
                onConfirm(date);
              }}
              onCancel={onClose}
              loading={confirming}
              disabled={placedCount === 0 || confirming}
            />
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
