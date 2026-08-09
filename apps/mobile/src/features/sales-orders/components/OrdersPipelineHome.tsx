import { useMemo, type ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import {
  adminOrderFlowHref,
  dealerOrderFlowHref,
} from '@/features/production-flow/flowRoutes';
import { countOrderStages, filterByStageFocus, type OrdersStageFocus } from '../stageCounts';
import type { AdminOrderCardModel, DealerOrderCardModel, OrdersListVariant } from '../selectOrderCard';
import { OrdersCompositionChrome } from './OrdersCompositionChrome';
import { OrdersListSkeleton } from './OrdersListSkeleton';
import { OrdersStageSpine } from './OrdersStageSpine';
import { OrdersStreamStrip, type OrdersStreamStripModel } from './OrdersStreamStrip';

type Props = {
  variant: OrdersListVariant;
  adminItems: AdminOrderCardModel[];
  dealerItems: DealerOrderCardModel[];
  stageFocus: OrdersStageFocus;
  onStageFocusChange: (next: OrdersStageFocus) => void;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onOpenFilters: () => void;
  filterActiveCount?: number;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onPressItem: (id: string, kind?: 'order' | 'rfq') => void;
  banner?: ReactNode;
};

export function OrdersPipelineHome({
  variant,
  adminItems,
  dealerItems,
  stageFocus,
  onStageFocusChange,
  searchInput,
  setSearchInput,
  onOpenFilters,
  filterActiveCount = 0,
  refreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage,
  onPressItem,
  banner,
}: Props) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();

  const allStream: OrdersStreamStripModel[] = useMemo(() => {
    if (variant === 'dealer') {
      return dealerItems.map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        title: o.title,
        imageUrl: o.imageUrl,
        progressPercent: o.progressPercent,
        progressLabel: o.progressLabel,
        deliveryDate: o.deliveryDate,
        sellerPrice: o.sellerPrice,
        kind: o.kind,
      }));
    }
    return adminItems.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      title: o.title,
      imageUrl: o.imageUrl,
      progressPercent: o.progressPercent,
      progressLabel: o.progressLabel,
      deliveryDate: o.deliveryDate,
      dealerName: o.dealerName,
      kind: o.kind ?? 'order',
    }));
  }, [adminItems, dealerItems, variant]);

  const counts = useMemo(
    () =>
      countOrderStages(
        allStream.map((o) => ({ status: o.status, deliveryDate: o.deliveryDate })),
      ),
    [allStream],
  );

  const stream = useMemo(
    () => filterByStageFocus(allStream, stageFocus),
    [allStream, stageFocus],
  );

  const header = (
    <View style={{ paddingHorizontal: theme.spacing.lg }}>
      {banner}
      <OrdersCompositionChrome
        title={t('mobile.orders.title')}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onOpenFilters={onOpenFilters}
        filterActiveCount={filterActiveCount}
      >
        <OrdersStageSpine
          counts={counts}
          stageFocus={stageFocus}
          onStageFocusChange={onStageFocusChange}
        />
      </OrdersCompositionChrome>
      <View style={{ height: theme.spacing.md }} />
    </View>
  );

  return (
    <FlatList
      data={stream}
      keyExtractor={(item) => (item.kind === 'rfq' ? `rfq-${item.id}` : item.id)}
      ListHeaderComponent={header}
      contentContainerStyle={{
        paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <EmptyState
            title={t('mobile.orders.emptyTitle')}
            description={t('mobile.orders.emptyBody')}
          />
        </View>
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg }}>
            <OrdersListSkeleton />
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <OrdersStreamStrip
            order={item}
            index={index}
            variant={variant}
            onPress={() => onPressItem(item.id, item.kind)}
            onProgressPress={
              item.kind === 'rfq'
                ? undefined
                : () =>
                    router.push(
                      variant === 'admin'
                        ? adminOrderFlowHref(item.id)
                        : dealerOrderFlowHref(item.id),
                    )
            }
          />
        </View>
      )}
    />
  );
}
