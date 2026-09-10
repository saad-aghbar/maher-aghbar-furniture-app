import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  addDaysYmd,
  minutesBetweenMs,
  nextWorkingYmd,
  overtimeStartMs,
  planShortSlot,
  type SlotChoice,
  type WorkingDayWindow,
} from '../assignOvertime';
import { todayYmd } from '../assignWindow';
import {
  buildDayPickTimeline,
  buildWorkerDayPlan,
  formatHm,
  localDayBounds,
  suggestWindowFromFree,
  windowFromFreeBlock,
  type WorkerDayBusyBlock,
} from '../workerDayPlan';

type ApplyWindow = (window: {
  plannedStart: string;
  plannedCompletion: string;
  overtime?: boolean;
}) => void;

type Props = {
  workerName: string;
  /** YYYY-MM-DD of the assignment day */
  dayYmd: string;
  busy: WorkerDayBusyBlock[];
  proposed?: { startMs: number; endMs: number } | null;
  estimatedMinutes?: number | null;
  onApplySuggestedWindow?: ApplyWindow;
  /** Tap an Available slot to set this assignment’s window. */
  onPickWindow?: ApplyWindow;
  onDayChange?: (ymd: string) => void;
  isWorkingYmd?: (ymd: string) => boolean;
  workingDays?: WorkingDayWindow[];
  shiftStartHour?: number;
  shiftEndHour?: number;
  shiftStartMinute?: number;
  shiftEndMinute?: number;
};

function hoursLabel(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h}h`;
}

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function ymdFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(ymd: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(
    locale,
    { weekday: 'short', day: 'numeric', month: 'short' },
  );
}

/**
 * Time-based worker day: capacity, planned load, free windows.
 * Free time is split into duration-sized Available picks for the full shift
 * so every worker shows the same day map. Proposed is a selection banner —
 * tapping must not hide other times.
 */
export function WorkerDayBoard({
  workerName,
  dayYmd,
  busy,
  proposed,
  estimatedMinutes,
  onApplySuggestedWindow,
  onPickWindow,
  onDayChange,
  isWorkingYmd,
  workingDays = [],
  shiftStartHour = 8,
  shiftEndHour = 16,
  shiftStartMinute = 0,
  shiftEndMinute = 0,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [expandedShortKey, setExpandedShortKey] = useState<string | null>(null);
  const bounds = localDayBounds(
    dayYmd,
    shiftStartHour,
    shiftEndHour,
    shiftStartMinute,
    shiftEndMinute,
  );
  if (!bounds) return null;

  const safeBusy = busy.filter(
    (b) =>
      Number.isFinite(b.startMs) &&
      Number.isFinite(b.endMs) &&
      b.endMs > b.startMs,
  );

  const proposedSameDay =
    Boolean(proposed) && ymdFromMs(proposed!.endMs) === dayYmd;
  const renderEndMs = proposedSameDay
    ? Math.max(bounds.dayEndMs, proposed!.endMs)
    : bounds.dayEndMs;
  const plan = buildWorkerDayPlan({
    dayStartMs: bounds.dayStartMs,
    dayEndMs: renderEndMs,
    busy: safeBusy,
    proposed: null,
    capacityMinutes: minutesBetweenMs(bounds.dayStartMs, bounds.dayEndMs),
  });

  const proposedClip =
    proposed &&
    proposed.endMs > proposed.startMs &&
    proposed.startMs < renderEndMs &&
    proposed.endMs > bounds.dayStartMs
      ? {
          startMs: Math.max(proposed.startMs, bounds.dayStartMs),
          endMs: Math.min(proposed.endMs, renderEndMs),
        }
      : null;

  const occupyingBusy = safeBusy.filter((b) => b.kind !== 'stopped');
  const proposedConflicts =
    proposedClip != null &&
    occupyingBusy.some((b) =>
      overlaps(proposedClip.startMs, proposedClip.endMs, b.startMs, b.endMs),
    );

  const duration =
    estimatedMinutes && estimatedMinutes > 0 ? Math.round(estimatedMinutes) : 0;

  const daySlots = duration > 0 ? buildDayPickTimeline(plan, duration) : [];
  const suggestion =
    duration > 0 ? suggestWindowFromFree(plan.freeWindows, duration) : null;

  const applyMs = (startMs: number, endMs: number, overtime: boolean, apply?: ApplyWindow) => {
    if (!apply) return;
    apply({
      plannedStart: new Date(startMs).toISOString(),
      plannedCompletion: new Date(endMs).toISOString(),
      ...(overtime ? { overtime: true } : {}),
    });
  };

  const lastBusyEndMs = occupyingBusy.reduce(
    (max, b) => Math.max(max, b.endMs),
    0,
  );
  const otStart = overtimeStartMs({
    shiftEndMs: bounds.dayEndMs,
    lastBusyEndMs: lastBusyEndMs > 0 ? lastBusyEndMs : null,
  });
  const otChoice: SlotChoice | null =
    duration > 0
      ? {
          kind: 'overtime',
          startMs: otStart,
          endMs: otStart + duration * 60_000,
          todayMinutes: duration,
          nextDayMinutes: 0,
          overtimeMinutes: duration,
        }
      : null;

  const today = todayYmd();
  const canGoBack = Boolean(onDayChange) && dayYmd > today;
  const workingCheck = isWorkingYmd ?? (() => true);

  const goDay = (direction: 1 | -1) => {
    if (!onDayChange) return;
    const next = workingCheck(addDaysYmd(dayYmd, direction))
      ? addDaysYmd(dayYmd, direction)
      : nextWorkingYmd(dayYmd, workingCheck, direction);
    if (!next) return;
    if (direction < 0 && next < today) return;
    void haptics.selection();
    setExpandedShortKey(null);
    onDayChange(next);
  };

  const slotStyle = (selected: boolean, warning?: boolean) => ({
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: selected
      ? warning
        ? colors.warning
        : colors.brand
      : colors.border,
    backgroundColor: selected
      ? warning
        ? colors.warningSoft
        : colors.brandSoft
      : colors.surface,
    padding: theme.spacing.sm,
    gap: 2,
    overflow: 'hidden' as const,
    minHeight: 44,
  });

  return (
    <DealerBoard
      title={workerName}
      titleWeight={titleWeight}
      accentColor={plan.overCapacity ? colors.warning : colors.brand}
      trailing={
        <AppText
          variant="caption"
          weight={titleWeight}
          color={plan.overCapacity ? 'warning' : 'brand'}
        >
          {plan.overCapacity
            ? t('mobile.production.workerDayOverload', { pct: plan.loadPercent })
            : t('mobile.production.workerDayLoad', {
                planned: hoursLabel(plan.plannedMinutes),
                capacity: hoursLabel(plan.capacityMinutes),
              })}
        </AppText>
      }
    >
      {onDayChange ? (
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.production.workerDayPrevDay')}
            disabled={!canGoBack}
            onPress={() => goDay(-1)}
            style={{
              width: theme.sizes.touch.min,
              height: theme.sizes.touch.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canGoBack ? 1 : 0.35,
            }}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={22}
              color={colors.textPrimary}
            />
          </AnimatedPressable>
          <AppText variant="label" weight={titleWeight}>
            {formatDayLabel(dayYmd, locale)}
          </AppText>
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.production.workerDayNextDay')}
            onPress={() => goDay(1)}
            style={{
              width: theme.sizes.touch.min,
              height: theme.sizes.touch.min,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={22}
              color={colors.textPrimary}
            />
          </AnimatedPressable>
        </View>
      ) : null}

      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left' }}
      >
        {t('mobile.production.workerDaySummary', {
          capacity: hoursLabel(plan.capacityMinutes),
          planned: hoursLabel(plan.plannedMinutes),
          available: hoursLabel(plan.availableMinutes),
          tasks: plan.taskCount,
        })}
      </AppText>

      {duration <= 0 ? (
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.production.stageTimeMissingBody')}
        </AppText>
      ) : onPickWindow ? (
        <AppText
          variant="caption"
          color="secondary"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.production.workerDayTapHint')}
        </AppText>
      ) : null}

      {proposedClip ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: proposedConflicts
              ? colors.warning
              : proposedClip.endMs > bounds.dayEndMs
                ? colors.warning
                : colors.brand,
            backgroundColor: proposedConflicts
              ? colors.warningSoft
              : proposedClip.endMs > bounds.dayEndMs
                ? colors.warningSoft
                : colors.brandSoft,
            padding: theme.spacing.sm,
            gap: 2,
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: proposedConflicts ? colors.warning : colors.brand,
              opacity: 0.55,
              ...(isRTL ? { right: 0 } : { left: 0 }),
            }}
          />
          <AppText
            variant="caption"
            weight={titleWeight}
            color={proposedConflicts ? 'warning' : 'brand'}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              paddingStart: 4,
            }}
          >
            {proposedConflicts
              ? t('mobile.production.workerDayProposedConflict')
              : t('mobile.production.workerDayProposed')}
          </AppText>
          <AppText
            variant="caption"
            weight={titleWeight}
            dir="ltr"
            style={{
              textAlign: isRTL ? 'right' : 'left',
              paddingStart: 4,
            }}
          >
            {ymdFromMs(proposedClip.startMs) !== ymdFromMs(proposedClip.endMs)
              ? `${formatDayLabel(ymdFromMs(proposedClip.startMs), locale)} ${formatHm(proposedClip.startMs)} → ${formatDayLabel(ymdFromMs(proposedClip.endMs), locale)} ${formatHm(proposedClip.endMs)}`
              : `${formatHm(proposedClip.startMs)}–${formatHm(proposedClip.endMs)}`}
            {' · '}
            {hoursLabel(
              Math.max(
                0,
                Math.round((proposedClip.endMs - proposedClip.startMs) / 60_000),
              ),
            )}
          </AppText>
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        {daySlots.map((block, i) => {
          const when = `${formatHm(block.startMs)}–${formatHm(block.endMs)}`;
          const isBusy = block.kind === 'busy';
          const isStopped = block.kind === 'stopped';
          const isAvailable = block.kind === 'available';
          const short =
            isAvailable &&
            duration > 0 &&
            block.durationMinutes < duration;
          const trailingShort = short && block.endMs >= bounds.dayEndMs;
          const midShort = short && !trailingShort;
          const selectedFree =
            isAvailable &&
            proposedClip != null &&
            proposedClip.startMs >= block.startMs &&
            proposedClip.startMs < block.endMs;
          const accent = selectedFree
            ? proposedConflicts
              ? colors.warning
              : colors.brand
            : colors.border;
          const key = `slot-${block.startMs}-${block.endMs}-${i}`;
          const planned = trailingShort
            ? planShortSlot({
                slotStartMs: block.startMs,
                slotEndMs: block.endMs,
                durationMinutes: duration,
                shiftEndMs: bounds.dayEndMs,
                workingDays,
              })
            : null;

          const body = (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: selectedFree ? accent : 'transparent',
                  opacity: selectedFree ? 0.55 : 0,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                  paddingStart: selectedFree ? 4 : 0,
                }}
              >
                <AppText
                  variant="caption"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {when}
                </AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {hoursLabel(block.durationMinutes)}
                </AppText>
              </View>
              <AppText
                variant="caption"
                color={
                  midShort
                    ? 'muted'
                    : selectedFree
                      ? proposedConflicts
                        ? 'warning'
                        : 'brand'
                      : 'secondary'
                }
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  paddingStart: selectedFree ? 4 : 0,
                }}
              >
                {isBusy
                  ? block.label
                  : isStopped
                    ? t('mobile.production.workerDayStopped', {
                        start: formatHm(block.startMs),
                        end: formatHm(block.endMs),
                      })
                    : trailingShort
                    ? `${hoursLabel(block.durationMinutes)} free, stage needs ${hoursLabel(duration)}`
                    : midShort
                      ? t('mobile.production.workerDaySlotTooShort')
                      : t('mobile.production.workerDayAvailable')}
              </AppText>
            </>
          );

          const rowStyle = {
            ...slotStyle(selectedFree, proposedConflicts),
            backgroundColor: isBusy
              ? colors.surfaceSecondary
              : isStopped
                ? colors.surfaceSecondary
              : midShort
                ? colors.surfaceSecondary
                : slotStyle(selectedFree, proposedConflicts).backgroundColor,
            opacity: midShort || isStopped ? 0.7 : 1,
          };

          if (isAvailable && onPickWindow && !midShort) {
            return (
              <View key={key} style={{ gap: theme.spacing.xs }}>
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.production.workerDayPickSlot', {
                    start: formatHm(block.startMs),
                    end: formatHm(block.endMs),
                  })}
                  onPress={() => {
                    if (trailingShort && planned) {
                      void haptics.selection();
                      setExpandedShortKey((cur) => (cur === key ? null : key));
                      return;
                    }
                    const picked = windowFromFreeBlock(
                      block.startMs,
                      block.endMs,
                      duration,
                    );
                    if (!picked) return;
                    void haptics.selection();
                    applyMs(picked.startMs, picked.endMs, false, onPickWindow);
                  }}
                  style={rowStyle}
                >
                  {body}
                </AnimatedPressable>
                {trailingShort && expandedShortKey === key && planned ? (
                  <View style={{ gap: theme.spacing.xs, paddingStart: theme.spacing.sm }}>
                    {planned.spill ? (
                      <AnimatedPressable
                        variant="button"
                        accessibilityRole="button"
                        onPress={() => {
                          void haptics.confirmLight();
                          setExpandedShortKey(null);
                          applyMs(
                            planned.spill!.startMs,
                            planned.spill!.endMs,
                            false,
                            onPickWindow,
                          );
                        }}
                        style={slotStyle(false)}
                      >
                        <AppText variant="caption" weight={titleWeight} color="brand">
                          {t('mobile.production.workerDaySpillOption')}
                        </AppText>
                        <AppText variant="caption" color="secondary" dir="ltr">
                          {t('mobile.production.workerDaySpillDetail', {
                            today: `${hoursLabel(planned.spill.todayMinutes)}`,
                            next: `${formatDayLabel(ymdFromMs(planned.spill.endMs), locale)} ${formatHm(planned.spill.endMs - planned.spill.nextDayMinutes * 60_000)}–${formatHm(planned.spill.endMs)}`,
                          })}
                        </AppText>
                      </AnimatedPressable>
                    ) : null}
                    <AnimatedPressable
                      variant="button"
                      accessibilityRole="button"
                      onPress={() => {
                        void haptics.confirmLight();
                        setExpandedShortKey(null);
                        applyMs(
                          planned.overtime.startMs,
                          planned.overtime.endMs,
                          true,
                          onPickWindow,
                        );
                      }}
                      style={slotStyle(false, true)}
                    >
                      <AppText variant="caption" weight={titleWeight} color="warning">
                        {t('mobile.production.workerDayOvertimeOption')}
                      </AppText>
                      <AppText variant="caption" color="secondary" dir="ltr">
                        {t('mobile.production.workerDayOvertimeDetail', {
                          window: `${formatHm(planned.overtime.startMs)}–${formatHm(planned.overtime.endMs)}`,
                          overtime: hoursLabel(planned.overtime.overtimeMinutes),
                        })}
                      </AppText>
                    </AnimatedPressable>
                  </View>
                ) : null}
              </View>
            );
          }

          return (
            <View key={key} style={rowStyle}>
              {body}
            </View>
          );
        })}
      </View>

      {otChoice && onPickWindow ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          onPress={() => {
            void haptics.confirmLight();
            applyMs(otChoice.startMs, otChoice.endMs, true, onPickWindow);
          }}
          style={{
            ...slotStyle(
              Boolean(
                proposed &&
                  proposed.startMs === otChoice.startMs &&
                  proposed.endMs === otChoice.endMs,
              ),
              true,
            ),
            borderColor: colors.warning,
          }}
        >
          <AppText variant="caption" weight={titleWeight} color="warning">
            {t('mobile.production.workerDayOvertimeRow')}
          </AppText>
          <AppText variant="caption" color="secondary" dir="ltr">
            {t('mobile.production.workerDayOvertimeDetail', {
              window: `${formatHm(otChoice.startMs)}–${formatHm(otChoice.endMs)}`,
              overtime: hoursLabel(otChoice.overtimeMinutes),
            })}
          </AppText>
        </AnimatedPressable>
      ) : null}

      {suggestion && onApplySuggestedWindow ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          onPress={() => {
            void haptics.confirmLight();
            applyMs(
              suggestion.startMs,
              suggestion.endMs,
              false,
              onApplySuggestedWindow,
            );
          }}
          style={{
            minHeight: theme.sizes.touch.min,
            borderRadius: theme.radius.xl,
            borderWidth: 1.5,
            borderColor: colors.brand,
            backgroundColor: colors.surface,
            paddingHorizontal: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="label" weight={titleWeight} color="brand">
            {t('mobile.production.workerDayUseWindow', {
              start: formatHm(suggestion.startMs),
              end: formatHm(suggestion.endMs),
            })}
          </AppText>
        </AnimatedPressable>
      ) : null}
    </DealerBoard>
  );
}
