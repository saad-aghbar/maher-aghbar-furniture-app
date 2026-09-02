import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
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
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const bounds = localDayBounds(dayYmd);
  if (!bounds) return null;

  const safeBusy = busy.filter(
    (b) =>
      Number.isFinite(b.startMs) &&
      Number.isFinite(b.endMs) &&
      b.endMs > b.startMs,
  );

  // Stable day map — ignore proposed so Available/busy rows don’t reshuffle on pick.
  const plan = buildWorkerDayPlan({
    dayStartMs: bounds.dayStartMs,
    dayEndMs: bounds.dayEndMs,
    busy: safeBusy,
    proposed: null,
  });

  const proposedClip =
    proposed &&
    proposed.endMs > proposed.startMs &&
    proposed.startMs < bounds.dayEndMs &&
    proposed.endMs > bounds.dayStartMs
      ? {
          startMs: Math.max(proposed.startMs, bounds.dayStartMs),
          endMs: Math.min(proposed.endMs, bounds.dayEndMs),
        }
      : null;

  const proposedConflicts =
    proposedClip != null &&
    safeBusy.some((b) =>
      overlaps(proposedClip.startMs, proposedClip.endMs, b.startMs, b.endMs),
    );

  const duration = Math.max(
    1,
    Math.round(estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : 120),
  );

  const daySlots = buildDayPickTimeline(plan, duration);
  const suggestion = suggestWindowFromFree(plan.freeWindows, duration);

  const applyMs = (startMs: number, endMs: number, apply?: ApplyWindow) => {
    if (!apply) return;
    apply({
      plannedStart: new Date(startMs).toISOString(),
      plannedCompletion: new Date(endMs).toISOString(),
    });
  };

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

      {onPickWindow ? (
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
            borderColor: proposedConflicts ? colors.warning : colors.brand,
            backgroundColor: proposedConflicts
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
            {`${formatHm(proposedClip.startMs)}–${formatHm(proposedClip.endMs)}`}
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
          const isAvailable = block.kind === 'available';
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
                  selectedFree
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
                  : t('mobile.production.workerDayAvailable')}
              </AppText>
            </>
          );

          const slotStyle = {
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: selectedFree ? accent : colors.border,
            backgroundColor: isBusy
              ? colors.surfaceSecondary
              : selectedFree
                ? proposedConflicts
                  ? colors.warningSoft
                  : colors.brandSoft
                : colors.surface,
            padding: theme.spacing.sm,
            gap: 2,
            overflow: 'hidden' as const,
            minHeight: isAvailable && onPickWindow ? 44 : undefined,
          };

          if (isAvailable && onPickWindow) {
            return (
              <AnimatedPressable
                key={`slot-${block.startMs}-${block.endMs}-${i}`}
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.production.workerDayPickSlot', {
                  start: formatHm(block.startMs),
                  end: formatHm(block.endMs),
                })}
                onPress={() => {
                  const picked = windowFromFreeBlock(
                    block.startMs,
                    block.endMs,
                    duration,
                  );
                  if (!picked) return;
                  void haptics.selection();
                  applyMs(picked.startMs, picked.endMs, onPickWindow);
                }}
                style={slotStyle}
              >
                {body}
              </AnimatedPressable>
            );
          }

          return (
            <View key={`slot-${block.startMs}-${block.endMs}-${i}`} style={slotStyle}>
              {body}
            </View>
          );
        })}
      </View>

      {suggestion && onApplySuggestedWindow ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          onPress={() => {
            void haptics.confirmLight();
            applyMs(
              suggestion.startMs,
              suggestion.endMs,
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
