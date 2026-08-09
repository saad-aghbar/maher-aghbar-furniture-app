import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { springs } from '@/motion/presets';
import { useTheme } from '@/theme';
import type { AdminHomeRecentOrder, FloorSpotlightReason } from '../api';
import { PIPELINE_STEPS } from '../pickTrackingOrder';

type Props = {
  order: AdminHomeRecentOrder;
  stepIndex: number;
  reason: FloorSpotlightReason;
  peerCount: number;
};

function StepNode({
  label,
  done,
  active,
  index,
  reduce,
}: {
  label: string;
  done: boolean;
  active: boolean;
  index: number;
  reduce: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(reduce ? 1 : 0.35);
  const filled = done || active;

  useEffect(() => {
    if (reduce) {
      scale.value = 1;
      return;
    }
    scale.value = withDelay(220 + index * 90, withSpring(1, springs.gentle));
  }, [index, reduce, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 6 }}>
      <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: filled ? colors.brand : colors.surfaceSecondary,
              borderWidth: filled ? 0 : 2,
              borderColor: colors.border,
            },
            style,
          ]}
        >
          {done ? (
            <AppText variant="caption" weight="semibold" style={{ color: colors.onBrand }}>
              ✓
            </AppText>
          ) : (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: active ? colors.onBrand : colors.textMuted,
              }}
            />
          )}
        </Animated.View>
      </View>
      <AppText
        variant="caption"
        weight={active || done ? 'semibold' : 'medium'}
        color={filled ? 'primary' : 'secondary'}
        align="center"
        numberOfLines={2}
        style={{ fontSize: 11 }}
      >
        {label}
      </AppText>
    </View>
  );
}

/**
 * Floor spotlight — one priority exemplar + peer scale, not “the” live track.
 */
export function AdminHomeTrackingCard({ order, stepIndex, reason, peerCount }: Props) {
  const { t, isRTL, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  const { width } = useWindowDimensions();
  const lineMax = Math.max(80, width - theme.spacing.lg * 4 - 28);

  useEffect(() => {
    const target = stepIndex <= 0 ? 0.08 : stepIndex / (PIPELINE_STEPS.length - 1);
    if (reduce) {
      progress.value = target;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(280, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduce, stepIndex]);

  const lineFill = useAnimatedStyle(() => ({
    width: Math.max(4, Math.min(lineMax, progress.value * lineMax)),
  }));

  const fromLabel = order.customerName ?? order.endCustomerName ?? '—';
  const toLabel = order.title || t('mobile.adminHome.trackingDelivery');
  const whyKey =
    reason === 'late'
      ? 'mobile.adminHome.trackingWhyLate'
      : reason === 'nearing'
        ? 'mobile.adminHome.trackingWhyNearing'
        : 'mobile.adminHome.trackingWhyProduction';

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(160).springify().damping(15) };

  const boardBg = colorScheme === 'dark' ? colors.surfaceSecondary : colors.surface;

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
        >
          {t('mobile.adminHome.trackingEyebrow')}
        </AppText>
        <AppText variant="title" weight="semibold">
          {t('mobile.adminHome.trackingTitle')}
        </AppText>
        <AppText variant="caption" color="secondary">
          {t(whyKey, { count: peerCount })}
        </AppText>
      </View>

      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.number} ${fromLabel}`}
        onPress={() => {
          void haptics.selection();
          router.push(`/(app)/(admin)/orders/${order.id}` as Href);
        }}
        style={{
          gap: theme.spacing.md,
          backgroundColor: boardBg,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: reason === 'late' ? colors.warning : colors.border,
          padding: theme.spacing.lg,
          ...theme.elevation.raised,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="label" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
            {t('mobile.adminHome.trackingId', { id: order.number })}
          </AppText>
          <StatusBadge status={order.status} />
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.lg,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" color="secondary">
              {t('mobile.adminHome.trackingFrom')}
            </AppText>
            <AppText variant="body" weight="medium" numberOfLines={2}>
              {fromLabel}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" color="secondary">
              {t('mobile.adminHome.trackingTo')}
            </AppText>
            <AppText variant="body" weight="medium" numberOfLines={2}>
              {toLabel}
            </AppText>
          </View>
        </View>

        {order.requiredDeliveryDate ? (
          <AppText variant="caption" color="secondary">
            {t('mobile.adminHome.trackingDue', {
              date: formatDate(new Date(order.requiredDeliveryDate)),
            })}
          </AppText>
        ) : null}

        <View
          style={{
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: reason === 'late' ? colors.warningSoft : colors.brandSoft,
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{ color: reason === 'late' ? colors.warning : colors.brand }}
          >
            {t('mobile.adminHome.trackingPeers', { count: peerCount })}
          </AppText>
        </View>

        <View style={{ paddingTop: theme.spacing.sm }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginHorizontal: 14,
              marginBottom: -18,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                {
                  height: 4,
                  backgroundColor: colors.brand,
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                },
                lineFill,
              ]}
            />
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
            }}
          >
            {PIPELINE_STEPS.map((step, i) => (
              <StepNode
                key={step}
                index={i}
                label={t(`mobile.adminHome.pipeline.${step}`)}
                done={i < stepIndex}
                active={i === stepIndex}
                reduce={reduce}
              />
            ))}
          </View>
        </View>
      </AnimatedPressable>
    </Wrapper>
  );
}
