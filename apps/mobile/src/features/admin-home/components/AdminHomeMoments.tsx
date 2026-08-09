import { Image, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomeRecentOrder } from '../api';

type Props = {
  orders: AdminHomeRecentOrder[];
};

/**
 * Horizontal “moments still warm” — Home browses life on the floor, not a table.
 */
export function AdminHomeMoments({ orders }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ordersHref = '/(app)/(admin)/(tabs)/orders' as Href;

  if (orders.length === 0) return null;

  const Wrapper = reduce ? View : Animated.View;
  const wrapperProps = reduce
    ? {}
    : { entering: FadeInRight.delay(260).duration(400).damping(22) };

  return (
    <Wrapper {...wrapperProps} style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
          paddingHorizontal: 0,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <AppText
            variant="caption"
            weight="semibold"
            style={{ letterSpacing: 1.6, textTransform: 'uppercase', color: colors.brand }}
          >
            {t('mobile.adminHome.homeMomentsEyebrow')}
          </AppText>
          <AppText variant="title" weight="semibold">
            {t('mobile.adminHome.homeMomentsTitle')}
          </AppText>
        </View>
        <AnimatedPressable
          variant="button"
          onPress={() => {
            void haptics.selection();
            router.push(ordersHref);
          }}
        >
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.adminHome.seeAll')}
          </AppText>
        </AnimatedPressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingVertical: 2,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {orders.slice(0, 8).map((order) => {
          const title = order.title || order.endCustomerName || '—';
          return (
            <AnimatedPressable
              key={order.id}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${order.number} ${title}`}
              onPress={() => {
                void haptics.selection();
                router.push(ordersHref);
              }}
              style={{
                width: 200,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...theme.elevation.raised,
              }}
            >
              <View
                style={{
                  height: 110,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {order.imageUrl ? (
                  <Image
                    source={{ uri: order.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <AppText variant="caption" color="muted">
                    ···
                  </AppText>
                )}
              </View>
              <View style={{ padding: theme.spacing.md, gap: 6 }}>
                <StatusBadge status={order.status} />
                <AppText variant="label" weight="semibold" numberOfLines={1}>
                  {title}
                </AppText>
                <AppText variant="caption" color="secondary" numberOfLines={1}>
                  {t('mobile.adminHome.trackingId', { id: order.number })}
                </AppText>
              </View>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </Wrapper>
  );
}
