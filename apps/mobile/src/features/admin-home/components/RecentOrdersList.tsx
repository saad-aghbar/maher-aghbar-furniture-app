import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminHomeRecentOrder } from '../api';

type RecentOrdersListProps = {
  orders: AdminHomeRecentOrder[];
};

export function RecentOrdersList({ orders }: RecentOrdersListProps) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const ordersHref = '/(app)/(admin)/(tabs)/orders' as Href;

  return (
    <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.md }}>
      <SectionHeader
        title={t('mobile.adminHome.recentOrders')}
        action={
          <TertiaryButton
            label={t('mobile.adminHome.seeAll')}
            onPress={() => router.push(ordersHref)}
          />
        }
      />
      {orders.length === 0 ? (
        <AppText variant="bodySecondary" color="secondary">
          {t('mobile.adminHome.ordersEmpty')}
        </AppText>
      ) : (
        orders.map((order, index) => {
          const subtitle =
            order.customerName ?? order.endCustomerName ?? order.title;
          return (
            <ListItemEnter key={order.id} index={index}>
              <SurfaceCard
                onPress={() => router.push(ordersHref)}
                accessibilityLabel={`${order.number} ${subtitle}`}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
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
                        style={{ width: 48, height: 48 }}
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
                      <AppText
                        variant="label"
                        weight="semibold"
                        style={{ flex: 1 }}
                        numberOfLines={1}
                      >
                        {order.number}
                      </AppText>
                      <StatusBadge status={order.status} />
                    </View>
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {subtitle}
                    </AppText>
                  </View>
                </View>
              </SurfaceCard>
            </ListItemEnter>
          );
        })
      )}
    </View>
  );
}
