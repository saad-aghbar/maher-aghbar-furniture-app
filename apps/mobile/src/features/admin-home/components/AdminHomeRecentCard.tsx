import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomeRecentOrder } from '../api';

type Props = {
  orders: AdminHomeRecentOrder[];
};

/**
 * Vertical atelier timeline — animated ink spine + staggered order tickets.
 */
export function AdminHomeRecentCard({ orders }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const spine = useSharedValue(reduce ? 1 : 0);
  const ordersHref = '/(app)/(admin)/(tabs)/orders' as Href;

  useEffect(() => {
    if (reduce) {
      spine.value = 1;
      return;
    }
    spine.value = withDelay(200, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [reduce, spine]);

  const spineStyle = useAnimatedStyle(() => ({
    opacity: spine.value,
    transform: [{ translateY: interpolate(spine.value, [0, 1], [-24, 0]) }],
  }));

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInDown.delay(200).springify().damping(16) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
          >
            {t('mobile.adminHome.timelineEyebrow')}
          </AppText>
          <AppText variant="title" weight="semibold">
            {t('mobile.adminHome.recentActivityTitle')}
          </AppText>
        </View>
        <TertiaryButton label={t('mobile.adminHome.seeAll')} onPress={() => router.push(ordersHref)} />
      </View>

      {orders.length === 0 ? (
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.adminHome.ordersEmpty')}
        </AppText>
      ) : (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.md }}>
          <View style={{ width: 14, alignItems: 'center' }}>
            <Animated.View
              style={[
                {
                  width: 2,
                  flex: 1,
                  backgroundColor: colors.brand,
                  borderRadius: 1,
                  minHeight: Math.max(80, orders.length * 88),
                },
                spineStyle,
              ]}
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.md }}>
            {orders.map((order, index) => (
              <TimelineTicket
                key={order.id}
                order={order}
                index={index}
                reduce={reduce}
                onPress={() => {
                  void haptics.selection();
                  router.push(ordersHref);
                }}
              />
            ))}
          </View>
        </View>
      )}
    </Wrapper>
  );
}

function TimelineTicket({
  order,
  index,
  reduce,
  onPress,
}: {
  order: AdminHomeRecentOrder;
  index: number;
  reduce: boolean;
  onPress: () => void;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const enter = useSharedValue(reduce ? 1 : 0);
  const dot = useSharedValue(reduce ? 1 : 0);
  const item = order.title || order.endCustomerName || '—';

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      dot.value = 1;
      return;
    }
    enter.value = withDelay(
      280 + index * 120,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    dot.value = withDelay(
      220 + index * 120,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [dot, enter, index, reduce]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        translateX: interpolate(enter.value, [0, 1], isRTL ? [-28, 0] : [28, 0]),
      },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(dot.value, [0, 1], [0.85, 1.15]) }],
    opacity: 0.55 + dot.value * 0.45,
  }));

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            ...(isRTL ? { right: -theme.spacing.md - 11 } : { left: -theme.spacing.md - 11 }),
            top: 22,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: colors.brand,
            borderWidth: 2,
            borderColor: colors.background,
            zIndex: 2,
          },
          dotStyle,
        ]}
      />
      <Animated.View style={rowStyle}>
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${order.number} ${item}`}
          onPress={onPress}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.md,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
            ...theme.elevation.card,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: theme.radius.md,
              backgroundColor: colors.surfaceSecondary,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {order.imageUrl ? (
              <Image
                source={{ uri: order.imageUrl }}
                style={{ width: 52, height: 52 }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <AppText variant="caption" color="muted">
                ···
              </AppText>
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}
            >
              <AppText variant="caption" color="secondary" style={{ flex: 1 }} numberOfLines={1}>
                {t('mobile.adminHome.trackingId', { id: order.number })}
              </AppText>
              <StatusBadge status={order.status} />
            </View>
            <AppText variant="label" weight="semibold" numberOfLines={1}>
              {item}
            </AppText>
            {order.customerName ? (
              <AppText variant="caption" color="secondary" numberOfLines={1}>
                {order.customerName}
              </AppText>
            ) : null}
          </View>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}
