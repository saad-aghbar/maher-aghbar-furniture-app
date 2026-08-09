import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { TodayProgressBreakdown } from '../selectWorkerHome';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  progress: TodayProgressBreakdown;
};

const SIZE = 136;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

type MetricStampProps = {
  index: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  isRTL: boolean;
  reduce: boolean;
};

function MetricStamp({
  index,
  icon,
  iconBg,
  iconColor,
  label,
  value,
  isRTL,
  reduce,
}: MetricStampProps) {
  const { colors, theme } = useTheme();

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(60 + index * 20)}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: theme.radius.lg,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <AppText
        variant="bodySecondary"
        color="secondary"
        align="start"
        style={{ flex: 1, minWidth: 0 }}
        numberOfLines={1}
      >
        {label}
      </AppText>
      <CountUp value={value} variant="heading" format={(n) => String(Math.round(n))} />
    </Animated.View>
  );
}

/**
 * Shift Board — industrial day’s pulse: ring + stamped metrics in one tray.
 */
export function TodayProgressCard({ progress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ratio = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      ratio.value = progress.completedRatio;
      return;
    }
    ratio.value = 0;
    ratio.value = withTiming(progress.completedRatio, {
      duration: 420,
    });
  }, [progress.completedRatio, ratio, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - Math.min(1, Math.max(0, ratio.value))),
  }));

  const goCompleted = () => {
    void haptics.selection();
    router.push('/(app)/(employee)/(tabs)/completed' as Href);
  };

  return (
    <Animated.View
      entering={reduce ? undefined : softFadeDown(50)}
      style={{ marginBottom: theme.spacing.xl }}
    >
      <AnimatedPressable
        variant="card"
        onPress={goCompleted}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.workerHome.progressSection')}
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
          <Animated.View
            entering={reduce ? undefined : softFadeDown(70)}
            style={{
              // Physical top-left stamp; title balances on the opposite edge.
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.workerHome.seeDetails')}
              onPress={goCompleted}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: theme.spacing.sm + 2,
                paddingVertical: 8,
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
                flexShrink: 0,
              }}
            >
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
                {t('mobile.workerHome.seeDetails')}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={colors.brand}
              />
            </AnimatedPressable>

            <View
              style={{
                flex: 1,
                gap: 4,
                minWidth: 0,
                alignItems: 'flex-end',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                style={{
                  color: colors.brand,
                  letterSpacing: locale === 'ar' ? 0 : 1.6,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  textAlign: 'right',
                }}
              >
                {t('mobile.workerHome.progressEyebrow')}
              </AppText>
              <AppText
                variant="title"
                weight="semibold"
                style={{ textAlign: 'right' }}
              >
                {t('mobile.workerHome.progressSection')}
              </AppText>
            </View>
          </Animated.View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: SIZE,
                height: SIZE,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: SIZE - 8,
                  height: SIZE - 8,
                  borderRadius: (SIZE - 8) / 2,
                  backgroundColor: colors.brand,
                  opacity: 0.06,
                }}
              />
              <Svg width={SIZE} height={SIZE}>
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={colors.surfaceSecondary}
                  strokeWidth={STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={colors.brand}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${C} ${C}`}
                  animatedProps={animatedProps}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center', gap: 2 }}>
                <CountUp
                  value={progress.percentCompleted}
                  variant="heading"
                  format={(n) => `${Math.round(n)}%`}
                />
                <AppText variant="caption" color="muted">
                  {t('mobile.workerHome.progressCompleted')}
                </AppText>
              </View>
            </View>

            <View style={{ flex: 1, gap: theme.spacing.sm, minWidth: 0 }}>
              <MetricStamp
                index={0}
                icon="checkmark"
                iconBg={colors.successSoft}
                iconColor={colors.success}
                label={t('mobile.workerHome.progressDone')}
                value={progress.completed}
                isRTL={isRTL}
                reduce={reduce}
              />
              <MetricStamp
                index={1}
                icon="ellipsis-horizontal"
                iconBg={colors.brandSoft}
                iconColor={colors.brand}
                label={t('mobile.workerHome.progressInProgress')}
                value={progress.inProgress}
                isRTL={isRTL}
                reduce={reduce}
              />
              <MetricStamp
                index={2}
                icon="ellipse-outline"
                iconBg={colors.surface}
                iconColor={colors.textMuted}
                label={t('mobile.workerHome.progressRemaining')}
                value={progress.remaining}
                isRTL={isRTL}
                reduce={reduce}
              />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
