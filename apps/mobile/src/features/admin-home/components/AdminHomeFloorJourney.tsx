import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
import type { AdminHomePayload } from '../api';

type StageKey = 'new' | 'prod' | 'near' | 'late';

type Stage = {
  key: StageKey;
  labelKey: string;
  value: number;
  href: Href;
};

type Props = {
  data: AdminHomePayload;
};

/** Distinct theme hues — still coffee/camo, but readable as separate stages. */
function stagePalette(colors: ThemeColors, key: StageKey) {
  switch (key) {
    case 'new':
      // Army Camo
      return { tint: colors.brand, soft: colors.brandSoft };
    case 'prod':
      // Olive — clearly greener than brand
      return { tint: colors.success, soft: colors.successSoft };
    case 'near':
      // Roasted amber
      return { tint: colors.warning, soft: colors.warningSoft };
    case 'late':
      // Burnt sienna — overdue, not traffic red
      return { tint: colors.error, soft: colors.errorSoft };
  }
}

/** Stronger bar fills so share segments stay obvious on parchment. */
function stageBarColor(colors: ThemeColors, key: StageKey) {
  switch (key) {
    case 'new':
      return colors.brand;
    case 'prod':
      return colors.success;
    case 'near':
      return colors.warning;
    case 'late':
      return colors.error;
  }
}

/**
 * Floor journey — stage share as a percentage bar + softly breathing nodes.
 */
export function AdminHomeFloorJourney({ data }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();

  const stages: Stage[] = useMemo(
    () => [
      {
        key: 'new',
        labelKey: 'mobile.adminHome.metrics.newOrders',
        value: data.newOrders,
        href: '/(app)/(admin)/(tabs)/orders',
      },
      {
        key: 'prod',
        labelKey: 'mobile.adminHome.metrics.ordersInProduction',
        value: data.ordersInProduction,
        href: '/(app)/(admin)/(tabs)/production',
      },
      {
        key: 'near',
        labelKey: 'mobile.adminHome.metrics.ordersNearingDelivery',
        value: data.ordersNearingDelivery,
        href: '/(app)/(admin)/(tabs)/orders',
      },
      {
        key: 'late',
        labelKey: 'mobile.adminHome.metrics.delayedOrders',
        value: data.delayedOrders,
        href: '/(app)/(admin)/(tabs)/orders',
      },
    ],
    [data],
  );

  const total = stages.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const filled = stages.filter((s) => s.value > 0);

  const barReveal = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      barReveal.value = 1;
      return;
    }
    barReveal.value = 0;
    barReveal.value = withDelay(
      160,
      withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) }),
    );
  }, [barReveal, reduce, total]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + barReveal.value * 0.75,
  }));

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(180).duration(400).damping(22) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.journeyEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.journeyTitle')}
        </AppText>
        <AppText variant="caption" color="secondary" style={{ fontSize: 11, lineHeight: 15 }}>
          {t('mobile.adminHome.journeyHint')}
        </AppText>
      </View>

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.lg,
          overflow: 'hidden',
          ...theme.elevation.raised,
        }}
      >
        <Animated.View
          style={[
            {
              marginHorizontal: 4,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'stretch',
              gap: filled.length > 1 ? 5 : 0,
            },
            barStyle,
          ]}
        >
          {total === 0 ? (
            <View style={{ flex: 1, backgroundColor: colors.border, borderRadius: 5 }} />
          ) : (
            filled.map((stage) => {
              const tint = stageBarColor(colors, stage.key);
              return (
                <View
                  key={stage.key}
                  style={{
                    flex: Math.max(1, stage.value),
                    minWidth: 12,
                    backgroundColor: tint,
                    borderRadius: 5,
                  }}
                />
              );
            })
          )}
        </Animated.View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.xs,
          }}
        >
          {stages.map((stage, index) => {
            const palette = stagePalette(colors, stage.key);
            return (
              <JourneyNode
                key={stage.key}
                stage={stage}
                index={index}
                tint={palette.tint}
                soft={palette.soft}
                reduce={reduce}
                onPress={() => {
                  void haptics.selection();
                  router.push(stage.href);
                }}
              />
            );
          })}
        </View>
      </View>
    </Wrapper>
  );
}

function JourneyNode({
  stage,
  index,
  tint,
  soft,
  reduce,
  onPress,
}: {
  stage: Stage;
  index: number;
  tint: string;
  soft: string;
  reduce: boolean;
  onPress: () => void;
}) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const enter = useSharedValue(reduce ? 1 : 0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      220 + index * 90,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    if (stage.value > 0) {
      pulse.value = withDelay(
        500 + index * 120,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        ),
      );
    }
  }, [enter, index, pulse, reduce, stage.value]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [6, 0]) }],
  }));

  // Opacity only — no scale (scale made the ring jump outside its seat).
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + pulse.value * 0.28,
  }));

  const active = stage.value > 0;

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${t(stage.labelKey)} ${stage.value}`}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', gap: 8 }}
    >
      <Animated.View
        style={[
          { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
          shellStyle,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1.5,
              borderColor: tint,
            },
            active ? ringStyle : { opacity: 0.14 },
          ]}
        />
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: active ? soft : colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: active ? tint : colors.border,
          }}
        >
          <CountUp
            value={stage.value}
            variant="heading"
            color={active ? tint : colors.textMuted}
          />
        </View>
      </Animated.View>
      <AppText
        variant="caption"
        weight={active ? 'semibold' : 'medium'}
        align="center"
        numberOfLines={2}
        style={{ color: active ? tint : colors.textSecondary, fontSize: 11 }}
      >
        {t(stage.labelKey)}
      </AppText>
    </AnimatedPressable>
  );
}
