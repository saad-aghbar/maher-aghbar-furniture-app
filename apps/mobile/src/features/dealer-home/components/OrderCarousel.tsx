import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { statusLabel } from '@maher/i18n';
import { TertiaryButton } from '@/components/buttons/TertiaryButton';
import {
  DealerEmptyState,
  DealerOrderCard,
  DealerSectionHeader,
} from '@/features/dealer-ui';
import { resolveStatusVariant } from '@/components/badges/badgeStyles';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { DealerHomeOrderCardModel } from '../selectDealerHome';

type Props = {
  title: string;
  orders: DealerHomeOrderCardModel[];
  emptyLabel: string;
  showSeeAll?: boolean;
};

function toneForStatus(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const v = resolveStatusVariant(status);
  if (v === 'success') return 'success';
  if (v === 'warning') return 'warning';
  if (v === 'error') return 'danger';
  if (v === 'info' || v === 'brand') return 'info';
  return 'neutral';
}

export function OrderCarousel({
  title,
  orders,
  emptyLabel,
  showSeeAll = true,
}: Props) {
  const { t, locale, formatDate, isRTL } = useLocale();
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View style={{ marginBottom: theme.spacing.lg, gap: theme.spacing.sm }}>
      <DealerSectionHeader
        title={title}
        action={
          showSeeAll ? (
            <TertiaryButton
              label={t('mobile.dealerHome.seeAll')}
              onPress={() => router.push('/(app)/(customer)/(tabs)/orders' as Href)}
            />
          ) : undefined
        }
      />
      {orders.length === 0 ? (
        <DealerEmptyState title={emptyLabel} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingEnd: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}
        >
          {orders.map((order, index) => (
            <ListItemEnter key={order.id} index={index}>
              <View style={{ width: 300 }}>
                <DealerOrderCard
                  title={order.title}
                  subtitle={[order.number, order.externalOrderNumber]
                    .filter(Boolean)
                    .join(' · ')}
                  statusLabel={statusLabel(locale, order.status)}
                  statusTone={toneForStatus(order.status)}
                  progressLabel={order.progressLabel ?? undefined}
                  deliveryLabel={
                    order.deliveryDate
                      ? formatDate(order.deliveryDate)
                      : undefined
                  }
                  imageUri={order.imageUrl}
                  onPress={() =>
                    router.push(`/(app)/(customer)/orders/${order.id}` as Href)
                  }
                />
              </View>
            </ListItemEnter>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
