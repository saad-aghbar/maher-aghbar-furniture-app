import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { OrderProgressCaption } from '@/features/sales-orders/components/OrderProgressCaption';
import { WorkflowProgressHit } from '@/features/production-flow/components/WorkflowProgressHit';
import { dealerOrderFlowHref } from '@/features/production-flow/flowRoutes';
import type { DealerHomeOrder } from '../api';

type RecentOrdersListProps = {
  orders: DealerHomeOrder[];
};

export function RecentOrdersList({ orders }: RecentOrdersListProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <SectionHeader
        title={t('mobile.dealerHome.recentOrders')}
        action={
          <TertiaryButton
            label={t('mobile.dealerHome.seeAll')}
            onPress={() => router.push('/(app)/(customer)/(tabs)/orders' as Href)}
          />
        }
      />
      {orders.length === 0 ? (
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.dealerHome.ordersEmpty')}
        </AppText>
      ) : (
        orders.map((order, index) => (
          <ListItemEnter key={order.id} index={index}>
            <SurfaceCard
              onPress={() =>
                router.push(`/(app)/(customer)/orders/${order.id}` as Href)
              }
              accessibilityLabel={`${order.number} ${order.title}`}
            >
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.md }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
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
                      style={{ width: 56, height: 56 }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <AppText variant="caption" color="muted">
                      ···
                    </AppText>
                  )}
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText variant="label" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                      {order.number}
                    </AppText>
                    <StatusBadge status={order.status} />
                  </View>
                  <AppText variant="caption" color="secondary" numberOfLines={1}>
                    {order.title}
                  </AppText>
                  <WorkflowProgressHit
                    progressPercent={order.progressPercent}
                    accessibilityLabel={t('mobile.productionFlow.openWorkflow')}
                    onPress={() => {
                      void haptics.selection();
                      router.push(dealerOrderFlowHref(order.id));
                    }}
                  >
                    <OrderProgressCaption
                      progressPercent={order.progressPercent}
                      progressLabel={order.progressLabel}
                      variant="caption"
                      weight="medium"
                      color="muted"
                    />
                  </WorkflowProgressHit>
                </View>
              </View>
            </SurfaceCard>
          </ListItemEnter>
        ))
      )}
    </View>
  );
}
