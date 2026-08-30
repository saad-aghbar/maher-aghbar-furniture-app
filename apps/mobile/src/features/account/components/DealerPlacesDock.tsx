import { useEffect, useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { classifyDealerLifecycle } from '@maher/types';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { can, type Permission } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { getOwnDeliveries } from '@/api/modules/scheduling';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { deliveryStatusFromCustomerStatus } from '@/features/sales-orders/stageCounts';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

type PlaceTileDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  hintKey: string;
  href: Href | ((ctx: { shippedAwaiting: number }) => Href);
  permission: Permission;
  wide?: boolean;
  tone?: 'paper' | 'ink';
  badgeCount?: (ctx: { shippedAwaiting: number }) => number | undefined;
  badgeLabelKey?: string;
};

const PLACES: PlaceTileDef[] = [
  {
    key: 'quotations',
    icon: 'document-text-outline',
    labelKey: 'mobile.dealerQuotations.title',
    hintKey: 'mobile.dealerAccount.placeQuotationsHint',
    href: '/(app)/(customer)/quotations' as Href,
    permission: 'quotation.read',
  },
  {
    key: 'invoices',
    icon: 'receipt-outline',
    labelKey: 'mobile.invoices.title',
    hintKey: 'mobile.dealerAccount.placeInvoicesHint',
    href: '/(app)/(customer)/invoices' as Href,
    permission: 'invoice.read',
  },
  // Statement + Deliveries share a row so awaiting-receipt badge sits beside Statement.
  {
    key: 'statement',
    icon: 'wallet-outline',
    labelKey: 'mobile.account.statementTitle',
    hintKey: 'mobile.dealerAccount.placeStatementHint',
    href: '/(app)/(customer)/account/statement' as Href,
    permission: 'statement.read',
  },
  {
    key: 'deliveries',
    icon: 'car-outline',
    labelKey: 'mobile.dealerAccount.placeDeliveriesTitle',
    hintKey: 'mobile.dealerAccount.placeDeliveriesHint',
    href: ({ shippedAwaiting }) =>
      (shippedAwaiting > 0
        ? '/(app)/(customer)/(tabs)/orders?chip=shipped'
        : '/(app)/(customer)/(tabs)/orders?chip=delivered') as Href,
    permission: 'sales-order.read',
    badgeCount: ({ shippedAwaiting }) => (shippedAwaiting > 0 ? shippedAwaiting : undefined),
    badgeLabelKey: 'mobile.dealerAccount.deliveriesAwaitingBadge',
  },
  {
    key: 'payments',
    icon: 'card-outline',
    labelKey: 'mobile.account.paymentsTitle',
    hintKey: 'mobile.dealerAccount.placePaymentsHint',
    href: '/(app)/(customer)/account/payments' as Href,
    permission: 'payment.read',
  },
  {
    key: 'returns',
    icon: 'return-down-back-outline',
    labelKey: 'mobile.returns.title',
    hintKey: 'mobile.dealerAccount.placeReturnsHint',
    href: '/(app)/(customer)/returns' as Href,
    permission: 'sales-order.read',
  },
  {
    key: 'calendar',
    icon: 'calendar-outline',
    labelKey: 'mobile.dealerAccount.calendarTitle',
    hintKey: 'mobile.dealerAccount.placeCalendarHint',
    href: '/(app)/(customer)/account/calendar' as Href,
    permission: 'schedule.read.own',
    wide: true,
    tone: 'ink',
  },
  {
    key: 'notifications',
    icon: 'notifications-outline',
    labelKey: 'mobile.dealerAccount.notificationSettings',
    hintKey: 'mobile.dealerAccount.placeNotificationsHint',
    href: '/(app)/notifications' as Href,
    permission: 'notification.read',
  },
];

/** 2-column place cards — finance & inbox shortcuts (AI featured separately). */
export function DealerPlacesDock() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pad = theme.spacing.lg;
  const gap = theme.spacing.sm;
  const fullW = width - pad * 2;
  const halfW = (fullW - gap) / 2;

  const places = useMemo(
    () => PLACES.filter((p) => can(user, p.permission)),
    [user],
  );

  const deliveriesBadgeQuery = useQuery({
    queryKey: queryKeys.salesOrders.list({ page: 1, pageSize: 100, dealerPlaces: true }),
    queryFn: async () => {
      const [ordersRes, deliveriesRes] = await Promise.all([
        listSalesOrders({ page: 1, pageSize: 100 }),
        getOwnDeliveries(),
      ]);
      const deliveryBySo = new Map<string, string>();
      for (const row of deliveriesRes.data ?? []) {
        const status = deliveryStatusFromCustomerStatus(row.customerStatus);
        if (status) deliveryBySo.set(row.salesOrderId, status);
      }
      let shippedAwaiting = 0;
      for (const order of ordersRes.data ?? []) {
        const tab = classifyDealerLifecycle({
          salesOrderStatus: order.status,
          deliveryStatus: deliveryBySo.get(order.id) ?? null,
          productionStarted: order.status === 'IN_PRODUCTION' || order.status === 'READY_FOR_DELIVERY',
        });
        if (tab === 'shipped') shippedAwaiting += 1;
      }
      return { shippedAwaiting };
    },
    enabled: Boolean(user?.customerId) && can(user, 'sales-order.read'),
    staleTime: 30_000,
  });

  const badgeCtx = useMemo(
    () => ({ shippedAwaiting: deliveriesBadgeQuery.data?.shippedAwaiting ?? 0 }),
    [deliveriesBadgeQuery.data?.shippedAwaiting],
  );

  const Shell = reduce ? View : Animated.View;
  const shellProps = reduce
    ? {}
    : { entering: FadeInDown.delay(160).duration(380).damping(22) };

  if (places.length === 0) return null;

  return (
    <Shell {...shellProps} style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.2,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
          }}
        >
          {t('mobile.dealerAccount.placesEyebrow')}
        </AppText>
        <AppText variant="heading" weight={titleWeight}>
          {t('mobile.dealerAccount.placesTitle')}
        </AppText>
        <AppText variant="caption" color="muted" weight="regular">
          {t('mobile.dealerAccount.placesHint')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap,
        }}
      >
        {places.map((place, index) => (
          <PlaceTile
            key={place.key}
            place={place}
            index={index}
            width={place.wide ? fullW : halfW}
            badgeCount={place.badgeCount?.(badgeCtx)}
            badgeLabel={
              place.badgeLabelKey && place.badgeCount?.(badgeCtx)
                ? t(place.badgeLabelKey, { count: place.badgeCount(badgeCtx)! })
                : undefined
            }
            onPress={() => {
              void haptics.confirmLight();
              const href =
                typeof place.href === 'function' ? place.href(badgeCtx) : place.href;
              router.push(href);
            }}
          />
        ))}
      </View>
    </Shell>
  );
}

function PlaceTile({
  place,
  index,
  width,
  badgeCount,
  badgeLabel,
  onPress,
}: {
  place: PlaceTileDef;
  index: number;
  width: number;
  badgeCount?: number;
  badgeLabel?: string;
  onPress: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const enter = useSharedValue(reduce ? 1 : 0);
  const ink = place.tone === 'ink';
  const inkBg = colorScheme === 'dark' ? colors.surfaceSecondary : '#2F2924';
  const fg = ink ? '#F5F1EA' : colors.textPrimary;
  const muted = ink ? 'rgba(245,241,234,0.62)' : colors.textMuted;
  const iconTint = ink ? '#D4C4A8' : colors.brand;

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(
      40 + index * 50,
      withSpring(1, { damping: 20, stiffness: 160 }),
    );
  }, [enter, index, reduce]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [10, 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.96, 1]) },
    ],
  }));

  return (
    <Animated.View style={[{ width }, style]}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={
          badgeLabel ? `${t(place.labelKey)}. ${badgeLabel}` : t(place.labelKey)
        }
        onPress={onPress}
        style={{
          minHeight: 112,
          borderRadius: theme.radius.xl,
          borderWidth: ink ? 0 : 1,
          borderColor: colors.borderStrong,
          backgroundColor: ink ? inkBg : colors.surface,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
          overflow: 'hidden',
          ...(ink ? theme.elevation.raised : theme.elevation.card),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.xs,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: ink ? 'rgba(255,255,255,0.08)' : colors.surfaceSecondary,
              borderWidth: ink ? 0 : 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={place.icon} size={20} color={iconTint} />
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
            }}
          >
            {badgeCount && badgeCount > 0 ? (
              <View
                accessibilityLabel={badgeLabel ?? String(badgeCount)}
                style={{
                  borderRadius: 999,
                  backgroundColor: colors.warning,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.onBrand, fontSize: 10 }}
                >
                  {badgeLabel ?? String(badgeCount)}
                </AppText>
              </View>
            ) : null}
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={16}
              color={muted}
            />
          </View>
        </View>
        <View style={{ gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText variant="label" weight={titleWeight} numberOfLines={1} style={{ color: fg }}>
            {t(place.labelKey)}
          </AppText>
          <AppText
            variant="caption"
            weight="regular"
            numberOfLines={2}
            style={{ fontSize: 11, lineHeight: 14, color: muted }}
          >
            {t(place.hintKey)}
          </AppText>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}
