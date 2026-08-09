import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomePayload } from '../api';

type Stage = {
  key: string;
  labelKey: string;
  value: number;
  href: Href;
  weight: number;
};

type Props = {
  data: AdminHomePayload;
};

export function AdminHomeStageBoard({ data }: Props) {
  const { t, isRTL, formatCurrency } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const barMax = width - theme.spacing.lg * 2 - 40;

  const stages: Stage[] = [
    {
      key: 'new',
      labelKey: 'mobile.adminHome.metrics.newOrders',
      value: data.newOrders,
      href: '/(app)/(admin)/(tabs)/orders',
      weight: 0.55,
    },
    {
      key: 'prod',
      labelKey: 'mobile.adminHome.metrics.ordersInProduction',
      value: data.ordersInProduction,
      href: '/(app)/(admin)/(tabs)/production',
      weight: 0.85,
    },
    {
      key: 'near',
      labelKey: 'mobile.adminHome.metrics.ordersNearingDelivery',
      value: data.ordersNearingDelivery,
      href: '/(app)/(admin)/(tabs)/orders',
      weight: 0.65,
    },
    {
      key: 'late',
      labelKey: 'mobile.adminHome.metrics.delayedOrders',
      value: data.delayedOrders,
      href: '/(app)/(admin)/(tabs)/orders',
      weight: data.delayedOrders > 0 ? 1 : 0.25,
    },
  ];

  const max = Math.max(1, ...stages.map((s) => s.value));

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(100).springify().damping(16) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
          >
            {t('mobile.adminHome.stageEyebrow')}
          </AppText>
          <AppText variant="title" weight="semibold">
            {t('mobile.adminHome.stageTitle')}
          </AppText>
        </View>
        <AppText
          variant="caption"
          color="muted"
          style={{ maxWidth: 120, textAlign: isRTL ? 'left' : 'right' }}
        >
          {t('mobile.adminHome.stageHint')}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        {stages.map((stage, index) => (
          <StageRow
            key={stage.key}
            stage={stage}
            index={index}
            max={max}
            barMax={barMax}
            reduce={reduce}
            onPress={() => {
              void haptics.selection();
              router.push(stage.href);
            }}
          />
        ))}
      </View>

      <Divider />

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.adminHome.metrics.outstandingReceivables')}
        onPress={() => {
          void haptics.selection();
          router.push('/(app)/(admin)/invoices' as Href);
        }}
        style={{
          paddingVertical: theme.spacing.md,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <AppText variant="body" color="secondary">
          {t('mobile.adminHome.metrics.outstandingReceivables')}
        </AppText>
        <CountUp
          value={Number(data.outstandingReceivables) || 0}
          format={formatCurrency}
          variant="heading"
          color={colors.brand}
        />
      </AnimatedPressable>
    </Wrapper>
  );
}

function StageRow({
  stage,
  index,
  max,
  barMax,
  reduce,
  onPress,
}: {
  stage: Stage;
  index: number;
  max: number;
  barMax: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const progress = useSharedValue(0);
  const stamp = useSharedValue(reduce ? 1 : 0);
  const ratio = stage.value / max;
  const isLate = stage.key === 'late' && stage.value > 0;

  useEffect(() => {
    if (reduce) {
      progress.value = ratio * stage.weight;
      stamp.value = 1;
      return;
    }
    stamp.value = withDelay(140 + index * 70, withSpring(1, { damping: 12, stiffness: 220 }));
    progress.value = withDelay(
      260 + index * 100,
      withTiming(ratio * stage.weight, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, progress, ratio, reduce, stage.weight, stamp]);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(6, progress.value * barMax),
  }));

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [
      { scale: interpolate(stamp.value, [0, 1], [0.5, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-12, 0])}deg` },
    ],
  }));

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={`${t(stage.labelKey)} ${stage.value}`}
      onPress={onPress}
      style={{
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: isLate ? colors.warningSoft : 'transparent',
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
          }}
        >
          <Animated.View style={stampStyle}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{ color: isLate ? colors.warning : colors.textMuted, minWidth: 20 }}
            >
              {String(index + 1).padStart(2, '0')}
            </AppText>
          </Animated.View>
          <AppText variant="label" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
            {t(stage.labelKey)}
          </AppText>
        </View>
        <CountUp
          value={stage.value}
          variant="heading"
          color={isLate ? colors.warning : colors.textPrimary}
        />
      </View>
      <View
        style={{
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
          marginStart: isRTL ? 0 : 30,
          marginEnd: isRTL ? 30 : 0,
        }}
      >
        <Animated.View
          style={[
            {
              height: 7,
              borderRadius: 4,
              backgroundColor: isLate ? colors.warning : colors.brand,
              alignSelf: isRTL ? 'flex-end' : 'flex-start',
            },
            fillStyle,
          ]}
        />
      </View>
    </AnimatedPressable>
  );
}
