import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import {
  formatElapsedClock,
  formatMinutesDuration,
} from '../formatDuration';
import { useLiveTaskTimer } from '../useLiveTaskTimer';

type Props = {
  timing: {
    status: string;
    actualMinutes: number;
    actualSeconds?: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    plannedStart?: string | null;
    elapsedMinutes: number;
  };
  formatDateTime: (v: string) => string;
  /** True when the scheduler planned this task's work for today. */
  isScheduledToday?: boolean;
};

/**
 * Industrial timer tray — live elapsed + estimate + due.
 */
export function TaskTimerBoard({ timing, formatDateTime, isScheduledToday }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const running = timing.status === 'running';
  const closedSeconds =
    timing.actualSeconds != null
      ? timing.actualSeconds
      : Math.max(0, Math.floor(timing.actualMinutes)) * 60;
  const { elapsedSeconds, elapsedMinutes } = useLiveTaskTimer(
    timing.openStartedAt,
    closedSeconds,
    running,
  );

  const hm = {
    hour: t('mobile.workerHome.durationHour'),
    minute: t('mobile.workerHome.durationMinute'),
  };

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(40)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        overflow: 'hidden',
        ...theme.elevation.card,
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.brand, opacity: 0.35 }} />
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
          }}
        >
          <View style={{ gap: 4, flex: 1 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 1.4,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
              }}
            >
              {t('mobile.tasks.timerEyebrow')}
            </AppText>
            <AppText
              variant="largeTitle"
              weight="semibold"
              style={{
                fontVariant: ['tabular-nums'],
                color: running ? colors.brand : colors.textPrimary,
              }}
            >
              {formatElapsedClock(elapsedSeconds)}
            </AppText>
            <AppText variant="caption" color="secondary">
              {running
                ? t('mobile.tasks.timerLive')
                : timing.status === 'done'
                  ? t('mobile.tasks.timerDone')
                  : t('mobile.tasks.timerElapsed')}
            </AppText>
          </View>
          {running ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.brand,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.tasks.timerLive')}
              </AppText>
            </View>
          ) : isScheduledToday && timing.status !== 'done' ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
                backgroundColor: colors.warningSoft,
                borderWidth: 1,
                borderColor: colors.warning,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.warning }}>
                {t('mobile.tasks.scheduledToday')}
              </AppText>
            </View>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              flex: 1,
              gap: 4,
              padding: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.tasks.timerEstimated')}
            </AppText>
            <AppText variant="label" weight="semibold">
              {timing.estimatedMinutes != null
                ? formatMinutesDuration(timing.estimatedMinutes, hm)
                : '—'}
            </AppText>
          </View>
          <View
            style={{
              flex: 1,
              gap: 4,
              padding: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            <AppText variant="caption" color="muted">
              {t('mobile.tasks.timerDue')}
            </AppText>
            <AppText variant="label" weight="semibold" numberOfLines={2}>
              {timing.plannedCompletion
                ? formatDateTime(timing.plannedCompletion)
                : '—'}
            </AppText>
          </View>
        </View>

        <AppText variant="caption" color="muted" align="start">
          {t('mobile.tasks.timerAccumulated', {
            duration: formatMinutesDuration(elapsedMinutes, hm),
          })}
        </AppText>
        {timing.plannedStart ? (
          <AppText variant="caption" color="muted" align="start">
            {t('mobile.tasks.timerScheduledStart', {
              date: formatDateTime(timing.plannedStart),
            })}
          </AppText>
        ) : null}
      </View>
    </Animated.View>
  );
}
