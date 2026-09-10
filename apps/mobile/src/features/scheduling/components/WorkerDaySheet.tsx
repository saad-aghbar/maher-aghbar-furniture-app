import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { formatYmdLabel } from '@/components/calendar';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import {
  pinAllocation,
  unpinAllocation,
  type FactoryDayWorker,
  type FactoryDayWorkerBusy,
} from '@/api/modules/scheduling';
import { invalidateKeys } from '@/api/queryKeys';
import { formatTimeRange, useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useTheme } from '@/theme';
import { useFactoryWeekQuery } from '../query';
import {
  minutesLabel,
  selectWorkerTimelineRow,
  selectWorkerWeek,
  type WorkerWeekDayRow,
} from '../selectFactoryTower';

type Props = {
  open: boolean;
  onClose: () => void;
  worker: FactoryDayWorker | null;
  date: string;
};

type Focus = { date: string; worker: FactoryDayWorker | null };

export function WorkerDaySheet({ open, onClose, worker, date }: Props) {
  const { t, locale, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const qc = useQueryClient();
  const [lens, setLens] = useState<'day' | 'week'>('day');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const activeDate = focus?.date ?? date;
  const activeWorker = focus?.worker ?? worker;
  const row = useMemo(
    () => (activeWorker ? selectWorkerTimelineRow(activeWorker) : null),
    [activeWorker],
  );
  const weekQuery = useFactoryWeekQuery(open && worker ? date : null, open && lens === 'week');
  const week = useMemo(
    () => selectWorkerWeek(weekQuery.days, worker?.employeeId ?? '', activeDate),
    [activeDate, weekQuery.days, worker?.employeeId],
  );
  const dateLabel = formatYmdLabel(activeDate, formatDate) || activeDate;
  const weekFrom = weekQuery.dates[0] ?? date;
  const weekTo = weekQuery.dates[6] ?? date;
  const weekTitle = `${formatYmdLabel(weekFrom, formatDate) || weekFrom} – ${formatYmdLabel(weekTo, formatDate) || weekTo}`;
  const identityDate = lens === 'week' ? weekTitle : dateLabel;
  const planned = minutesLabel(
    lens === 'week' ? week.plannedMinutes : (activeWorker?.scheduledMinutes ?? row?.plan.plannedMinutes ?? 0),
  );
  const capacity = minutesLabel(
    lens === 'week'
      ? week.capacityMinutes
      : (activeWorker?.availableMinutes ?? row?.plan.capacityMinutes ?? 0),
  );
  const overtime = lens === 'week' ? week.overtime : Boolean(activeWorker?.overtime);
  const blocks = row?.plan.blocks ?? [];

  useEffect(() => {
    if (open) {
      setLens('day');
      setFocus(null);
    }
  }, [open, worker?.employeeId, date]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      overlay
      expandable
      sheetHeight={Math.round(height * 0.88)}
      title={worker ? worker.name : t('mobile.adminScheduling.workerDay.title')}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <DealerBoard
          title={identityDate}
          titleWeight={titleWeight}
          accentColor={overtime ? colors.warning : colors.brand}
          trailing={
            overtime ? (
              <AppText variant="caption" weight={titleWeight} color="warning">
                {t('mobile.adminScheduling.overtimeBadge')}
              </AppText>
            ) : (
              <AppText variant="caption" color="secondary" dir="ltr">
                {`${planned} / ${capacity}`}
              </AppText>
            )
          }
        >
          <AppText variant="body" color="secondary">
            {t('mobile.adminScheduling.workerDay.load', {
              planned,
              capacity,
            })}
          </AppText>
          {lens === 'day' && overtime && activeWorker?.overtimeAfter ? (
            <AppText variant="caption" color="warning" dir="ltr">
              {t('mobile.adminScheduling.workerDay.overtimeUntil', {
                time: activeWorker.overtimeAfter,
              })}
            </AppText>
          ) : null}
        </DealerBoard>

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {(['day', 'week'] as const).map((key) => {
              const active = lens === key;
              const label = t(`mobile.adminScheduling.workerDay.${key}`);
              return (
                <AnimatedPressable
                  key={key}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => {
                    if (lens === key) return;
                    void haptics.selection();
                    setLens(key);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.borderStrong,
                    backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                    paddingVertical: theme.spacing.sm,
                    overflow: 'hidden',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 3,
                        backgroundColor: colors.brand,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                    }}
                  >
                    <Ionicons
                      name={key === 'day' ? 'today-outline' : 'calendar-outline'}
                      size={14}
                      color={active ? colors.brand : colors.textSecondary}
                    />
                  </View>
                  <AppText variant="caption" weight={titleWeight}>
                    {label}
                  </AppText>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <DealerBoard title={t('mobile.adminScheduling.workerDay.schedule')} titleWeight={titleWeight}>
          {lens === 'week' ? (
            weekQuery.isError ? (
              <DealerEmptyPanel
                nested
                compact
                icon="alert-circle-outline"
                text={t('mobile.adminScheduling.workerDay.weekError')}
              />
            ) : (
              <View style={{ gap: theme.spacing.sm }}>
                {week.rows.map((dayRow, index) => (
                  <ListItemEnter key={dayRow.date} index={index}>
                    <WeekDayBoard
                      row={dayRow}
                      titleWeight={titleWeight}
                      onOpen={() => {
                        void haptics.selection();
                        setFocus({ date: dayRow.date, worker: dayRow.worker ?? worker });
                        setLens('day');
                      }}
                    />
                  </ListItemEnter>
                ))}
              </View>
            )
          ) : blocks.length === 0 ? (
            <DealerEmptyPanel
              nested
              compact
              icon="time-outline"
              text={t('mobile.adminScheduling.workerDay.empty')}
            />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              {blocks.map((block, index) => {
                const busy = block.kind === 'busy';
                const stopped = block.kind === 'stopped';
                const inOvertime =
                  overtime &&
                  row?.overtimeAfterMs != null &&
                  block.startMs >= row.overtimeAfterMs;
                const busyRow = busy
                  ? (activeWorker?.busy ?? []).find(
                      (b) =>
                        b.kind !== 'stopped' &&
                        new Date(b.start).getTime() === block.startMs,
                    )
                  : undefined;
                return (
                  <ListItemEnter key={`${block.kind}-${block.startMs}-${block.endMs}`} index={index}>
                    <ScheduleBlock
                      startIso={new Date(block.startMs).toISOString()}
                      endIso={new Date(block.endMs).toISOString()}
                      label={
                        busy
                          ? block.salesOrderNumber ?? block.label
                          : stopped
                            ? t('mobile.adminScheduling.workerDay.stopped')
                            : t('mobile.adminScheduling.workerDay.free')
                      }
                      busy={busy}
                      stopped={stopped}
                      overtime={inOvertime}
                      titleWeight={titleWeight}
                      actualMinutes={busyRow?.actualMinutes ?? busyRow?.elapsedMinutes}
                      estimatedMinutes={busyRow?.estimatedMinutes}
                      isPinned={Boolean(busyRow?.isPinned)}
                      pinBusy={pinBusyId === busyRow?.id}
                      onTogglePin={
                        busyRow?.productionOrderId && busyRow.scheduleVersion != null
                          ? () => {
                              setPinBusyId(busyRow.id);
                              const fn = busyRow.isPinned ? unpinAllocation : pinAllocation;
                              void fn(busyRow.productionOrderId as string, {
                                allocationId: busyRow.id,
                                version: busyRow.scheduleVersion as number,
                              })
                                .then(() => {
                                  void haptics.confirmLight();
                                  return Promise.all(
                                    invalidateKeys
                                      .afterScheduleMutation(busyRow.productionOrderId ?? undefined)
                                      .map((key) => qc.invalidateQueries({ queryKey: key })),
                                  );
                                })
                                .catch(() => void haptics.error())
                                .finally(() => setPinBusyId(null));
                            }
                          : undefined
                      }
                    />
                  </ListItemEnter>
                );
              })}
            </View>
          )}
        </DealerBoard>
      </ScrollView>
    </BottomSheet>
  );
}

function WeekDayBoard({
  row,
  titleWeight,
  onOpen,
}: {
  row: WorkerWeekDayRow;
  titleWeight: 'medium' | 'semibold';
  onOpen: () => void;
}) {
  const { t, isRTL, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const weekday = t(`mobile.calendar.weekdays.${row.weekdayKey}`);
  const dayLabel = formatYmdLabel(row.date, formatDate) || row.date;
  const closed = row.status === 'ready' && (row.factoryClosed || Boolean(row.worker?.closed));
  const busy = row.worker?.busy ?? [];
  const rail = row.overtime ? colors.warning : row.isSelected ? colors.brand : colors.borderStrong;
  const fill = row.isSelected ? colors.brandSoft : colors.surfaceSecondary;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={t('mobile.adminScheduling.workerDay.openDay', { day: `${weekday} ${dayLabel}` })}
      disabled={row.status !== 'ready'}
      onPress={onOpen}
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: row.isSelected || row.overtime ? rail : colors.border,
        backgroundColor: fill,
        paddingVertical: theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        overflow: 'hidden',
        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: rail,
          opacity: row.isSelected || row.overtime ? 0.55 : 0.35,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight={titleWeight}>
            {`${weekday} · ${dayLabel}`}
          </AppText>
          {row.status === 'loading' ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.workerDay.loading')}
            </AppText>
          ) : closed ? (
            <AppText variant="caption" color="secondary">
              {t('mobile.adminScheduling.workerDay.closed')}
            </AppText>
          ) : (
            <AppText variant="caption" color="secondary" dir="ltr">
              {t('mobile.adminScheduling.workerDay.load', {
                planned: minutesLabel(row.plannedMinutes),
                capacity: minutesLabel(row.capacityMinutes),
              })}
            </AppText>
          )}
        </View>
        {row.status === 'loading' ? (
          <ActivityIndicator color={colors.brand} />
        ) : row.overtime ? (
          <AppText variant="caption" weight={titleWeight} color="warning">
            {t('mobile.adminScheduling.overtimeBadge')}
          </AppText>
        ) : (
          <AppText variant="caption" color="secondary" dir="ltr">
            {`${minutesLabel(row.plannedMinutes)} / ${minutesLabel(row.capacityMinutes)}`}
          </AppText>
        )}
      </View>
      {row.status === 'ready' && !closed ? (
        busy.length === 0 ? (
          <AppText color="secondary" style={{ marginTop: theme.spacing.xs }}>
            {t('mobile.adminScheduling.workerDay.free')}
          </AppText>
        ) : (
          <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            {busy.map((block) => (
              <WeekBusyRow
                key={`${block.id}-${block.start}`}
                block={block}
                overtime={
                  row.overtime &&
                  row.worker?.overtimeAfter != null &&
                  new Date(block.start).getTime() >= new Date(row.worker.overtimeAfter).getTime()
                }
                titleWeight={titleWeight}
              />
            ))}
          </View>
        )
      ) : null}
    </AnimatedPressable>
  );
}

function WeekBusyRow({
  block,
  overtime,
  titleWeight,
}: {
  block: FactoryDayWorkerBusy;
  overtime: boolean;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t } = useLocale();
  const stopped = block.kind === 'stopped';
  return (
    <ScheduleBlock
      startIso={block.start}
      endIso={block.end}
      label={
        stopped
          ? t('mobile.adminScheduling.workerDay.stopped')
          : block.salesOrderNumber ?? block.orderNumber ?? block.stageName ?? ''
      }
      busy={!stopped}
      stopped={stopped}
      overtime={overtime}
      titleWeight={titleWeight}
      compact
      actualMinutes={stopped ? null : block.actualMinutes ?? block.elapsedMinutes}
      estimatedMinutes={stopped ? null : block.estimatedMinutes}
      isPinned={Boolean(block.isPinned)}
    />
  );
}

function ScheduleBlock({
  startIso,
  endIso,
  label,
  busy,
  overtime,
  titleWeight,
  compact = false,
  actualMinutes,
  estimatedMinutes,
  isPinned,
  onTogglePin,
  pinBusy,
  stopped = false,
}: {
  startIso: string;
  endIso: string;
  label: string;
  busy: boolean;
  overtime: boolean;
  titleWeight: 'medium' | 'semibold';
  compact?: boolean;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  isPinned?: boolean;
  onTogglePin?: () => void;
  pinBusy?: boolean;
  stopped?: boolean;
}) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const rail = overtime
    ? colors.warning
    : stopped
      ? colors.textSecondary
      : busy
        ? colors.brand
        : colors.borderStrong;
  const fill = overtime
    ? colors.warningSoft
    : stopped
      ? colors.surfaceSecondary
      : busy
        ? colors.brandSoft
        : colors.surfaceSecondary;
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: busy || stopped ? rail : colors.border,
        backgroundColor: fill,
        paddingVertical: compact ? theme.spacing.sm : theme.spacing.sm + 2,
        paddingHorizontal: theme.spacing.md,
        overflow: 'hidden',
        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: rail,
          opacity: busy || stopped ? 0.55 : 0.35,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText weight={titleWeight} dir="ltr">
          {formatTimeRange(locale, startIso, endIso)}
        </AppText>
        <AppText variant="caption" color="secondary" dir="ltr">
          {minutesLabel(mins)}
        </AppText>
      </View>
      <AppText color="secondary" numberOfLines={1}>
        {label}
      </AppText>
      {busy && !stopped && (actualMinutes != null || estimatedMinutes != null) ? (
        <AppText variant="caption" color="secondary" dir="ltr">
          {t('mobile.tasks.plannedVsActual', {
            planned: estimatedMinutes != null ? minutesLabel(estimatedMinutes) : '—',
            actual: actualMinutes != null ? minutesLabel(actualMinutes) : '—',
          })}
        </AppText>
      ) : null}
      {onTogglePin ? (
        <AnimatedPressable
          variant="button"
          onPress={onTogglePin}
          disabled={pinBusy}
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            minHeight: 40,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: isPinned ? colors.brand : colors.border,
            backgroundColor: isPinned ? colors.brandSoft : colors.surface,
            justifyContent: 'center',
            opacity: pinBusy ? 0.6 : 1,
          }}
        >
          <AppText variant="caption" weight={titleWeight}>
            {isPinned ? t('mobile.tasks.unpinAllocation') : t('mobile.tasks.pinAllocation')}
          </AppText>
        </AnimatedPressable>
      ) : isPinned ? (
        <AppText variant="caption" color="secondary">
          {t('mobile.tasks.pinAllocation')}
        </AppText>
      ) : null}
    </View>
  );
}
