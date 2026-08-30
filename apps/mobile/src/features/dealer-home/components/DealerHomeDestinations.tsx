import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { classifyDealerLifecycle } from '@maher/types';
import { can, type Permission } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { getOwnDeliveries } from '@/api/modules/scheduling';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { AppText } from '@/components/AppText';
import { deliveryStatusFromCustomerStatus } from '@/features/sales-orders/stageCounts';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type DestDef = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  hintKey: string;
  href: Href | ((ctx: { shippedAwaiting: number }) => Href);
  permission: Permission;
  badgeCount?: (ctx: { shippedAwaiting: number }) => number | undefined;
};

const DESTINATIONS: DestDef[] = [
  {
    key: 'statement',
    icon: 'wallet-outline',
    labelKey: 'mobile.account.statementTitle',
    hintKey: 'mobile.dealerHome.destStatementHint',
    href: '/(app)/(customer)/account/statement' as Href,
    permission: 'statement.read',
  },
  {
    key: 'payments',
    icon: 'card-outline',
    labelKey: 'mobile.account.paymentsTitle',
    hintKey: 'mobile.dealerHome.destPaymentsHint',
    href: '/(app)/(customer)/account/payments' as Href,
    permission: 'payment.read',
  },
  {
    key: 'deliveries',
    icon: 'car-outline',
    labelKey: 'mobile.dealerAccount.placeDeliveriesTitle',
    hintKey: 'mobile.dealerHome.destDeliveriesHint',
    href: ({ shippedAwaiting }) =>
      (shippedAwaiting > 0
        ? '/(app)/(customer)/(tabs)/orders?chip=shipped'
        : '/(app)/(customer)/(tabs)/orders?chip=delivered') as Href,
    permission: 'sales-order.read',
    badgeCount: ({ shippedAwaiting }) => (shippedAwaiting > 0 ? shippedAwaiting : undefined),
  },
  {
    key: 'returns',
    icon: 'return-down-back-outline',
    labelKey: 'mobile.returns.title',
    hintKey: 'mobile.dealerHome.destReturnsHint',
    href: '/(app)/(customer)/returns' as Href,
    permission: 'sales-order.read',
  },
];

/**
 * Prominent Statement / Payments / Deliveries / Returns destinations on dealer home.
 */
export function DealerHomeDestinations() {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const places = useMemo(
    () => DESTINATIONS.filter((d) => can(user, d.permission)),
    [user],
  );

  const badgeQuery = useQuery({
    queryKey: queryKeys.salesOrders.list({ page: 1, pageSize: 100, dealerHomeDest: true }),
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
          productionStarted:
            order.status === 'IN_PRODUCTION' || order.status === 'READY_FOR_DELIVERY',
        });
        if (tab === 'shipped') shippedAwaiting += 1;
      }
      return { shippedAwaiting };
    },
    enabled: Boolean(user?.customerId) && can(user, 'sales-order.read'),
    staleTime: 30_000,
  });

  const badgeCtx = useMemo(
    () => ({ shippedAwaiting: badgeQuery.data?.shippedAwaiting ?? 0 }),
    [badgeQuery.data?.shippedAwaiting],
  );

  if (places.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
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
          {t('mobile.dealerHome.destEyebrow')}
        </AppText>
        <AppText variant="heading" weight={titleWeight}>
          {t('mobile.dealerHome.destTitle')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {places.map((place) => {
          const badge = place.badgeCount?.(badgeCtx);
          return (
            <AnimatedPressable
              key={place.key}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={
                badge
                  ? `${t(place.labelKey)}. ${t('mobile.dealerAccount.deliveriesAwaitingBadge', { count: badge })}`
                  : t(place.labelKey)
              }
              onPress={() => {
                void haptics.confirmLight();
                const href =
                  typeof place.href === 'function' ? place.href(badgeCtx) : place.href;
                router.push(href);
              }}
              style={{
                width: '47%',
                flexGrow: 1,
                minWidth: 140,
                minHeight: 96,
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                gap: theme.spacing.xs,
                ...theme.elevation.card,
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
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor:
                      colorScheme === 'dark' ? colors.surfaceSecondary : colors.brandSoft,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={place.icon} size={18} color={colors.brand} />
                </View>
                {badge && badge > 0 ? (
                  <View
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
                      {String(badge)}
                    </AppText>
                  </View>
                ) : (
                  <Ionicons
                    name={isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={14}
                    color={colors.textMuted}
                  />
                )}
              </View>
              <AppText variant="label" weight={titleWeight} numberOfLines={1}>
                {t(place.labelKey)}
              </AppText>
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={2}
                style={{ fontSize: 11, lineHeight: 14 }}
              >
                {t(place.hintKey)}
              </AppText>
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}
