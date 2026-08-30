import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { classifyDealerLifecycle } from '@maher/types';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { getOwnDeliveries } from '@/api/modules/scheduling';
import { listSalesOrders } from '@/api/modules/sales-orders';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { listBrowseProducts } from '@/features/catalog/api';
import { deliveryStatusFromCustomerStatus } from '@/features/sales-orders/stageCounts';
import { DealerHero } from '@/features/dealer-ui';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { DealerHomeHeader } from './components/DealerHomeHeader';
import { DealerHomeMetrics } from './components/DealerHomeMetrics';
import { DealerHomeDestinations } from './components/DealerHomeDestinations';
import { DealerHomeSkeleton } from './components/DealerHomeSkeleton';
import { FeaturedCollections } from './components/FeaturedCollections';
import { collectionsFromProducts } from './collectionsFromProducts';
import { pickShowcaseImages } from './pickShowcaseImages';
import { useDealerHomeQuery } from './query';
import type { DealerHomePayload } from './api';
import type { DealerHomeCollection } from './dealerHomeImagery';

const HERO_PAUSE_Y = 280;

type DealerHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: DealerHomePayload;
  fixtureCollections?: DealerHomeCollection[];
};

export function DealerHomeScreen({
  forceState,
  fixture,
  fixtureCollections,
}: DealerHomeScreenProps = {}) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const [heroActive, setHeroActive] = useState(true);

  const allowed = Boolean(user?.customerId && can(user, 'sales-order.read'));
  const canBrowseCatalog = can(user, 'catalog.read') || Boolean(forceState);

  const query = useDealerHomeQuery(allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;

  const showcaseQuery = useQuery({
    queryKey: queryKeys.catalog.list({ page: 1, pageSize: 24, showcase: true }),
    queryFn: () => listBrowseProducts({ page: 1, pageSize: 24 }),
    enabled: canBrowseCatalog && !forceState,
    staleTime: 60_000,
  });

  const lifecycleOrdersQuery = useQuery({
    queryKey: queryKeys.salesOrders.list({ page: 1, pageSize: 100, dealerHome: true }),
    queryFn: () => listSalesOrders({ page: 1, pageSize: 100 }),
    enabled: allowed && !forceState,
    staleTime: 30_000,
  });

  const ownDeliveriesQuery = useQuery({
    queryKey: queryKeys.scheduling.ownDeliveries(),
    queryFn: () => getOwnDeliveries(),
    enabled: allowed && !forceState,
    staleTime: 30_000,
  });

  const lifecycleCounts = useMemo(() => {
    const deliveryBySo = new Map<string, string>();
    for (const row of ownDeliveriesQuery.data?.data ?? []) {
      const status = deliveryStatusFromCustomerStatus(row.customerStatus);
      if (status) deliveryBySo.set(row.salesOrderId, status);
    }
    const counts = { inProduction: 0, ready: 0, shipped: 0, delivered: 0 };
    for (const order of lifecycleOrdersQuery.data?.data ?? []) {
      const tab = classifyDealerLifecycle({
        salesOrderStatus: order.status,
        deliveryStatus: deliveryBySo.get(order.id) ?? null,
        productionStarted: order.status === 'IN_PRODUCTION' || order.status === 'READY_FOR_DELIVERY',
      });
      if (tab === 'inProduction') counts.inProduction += 1;
      else if (tab === 'ready') counts.ready += 1;
      else if (tab === 'shipped') counts.shipped += 1;
      else if (tab === 'delivered') counts.delivered += 1;
    }
    return counts;
  }, [lifecycleOrdersQuery.data, ownDeliveriesQuery.data]);

  const [showcaseUris, setShowcaseUris] = useState<string[]>([]);
  useEffect(() => {
    const products = showcaseQuery.data?.data ?? [];
    setShowcaseUris(pickShowcaseImages(products, { min: 5, max: 10 }));
  }, [showcaseQuery.dataUpdatedAt]);

  const liveCollections = useMemo(
    () => collectionsFromProducts(showcaseQuery.data?.data ?? [], locale),
    [showcaseQuery.data?.data, locale],
  );
  const collections =
    forceState === 'success' || forceState === 'offline'
      ? (fixtureCollections ?? [])
      : liveCollections;

  const rawName = (user?.name ?? t('mobile.dealerHome.fallbackName')).trim();
  const displayName = rawName.replace(/\s+portal$/i, '').trim() || rawName;
  const greeting = t('mobile.dealerHome.greeting', { name: displayName });

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setHeroActive(y < HERO_PAUSE_Y);
  }, []);

  const clearanceStyle = useMemo(
    () => ({
      paddingBottom: insets.bottom + theme.spacing.lg + DEALER_TAB_BAR_CLEARANCE,
    }),
    [insets.bottom, theme.spacing.lg],
  );

  const chrome = (unread: number) => (
    <DealerHomeHeader
      unreadNotifications={unread}
      canOpenNotifications={can(user, 'notification.read')}
    />
  );

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <ScrollableScreen contentContainerStyle={clearanceStyle}>
        {chrome(0)}
        <DealerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <ScrollableScreen contentContainerStyle={clearanceStyle}>
        {chrome(0)}
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <ScrollableScreen contentContainerStyle={clearanceStyle}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {chrome(0)}
        <ErrorState
          title={t('mobile.dealerHome.errorTitle')}
          description={t('mobile.dealerHome.errorBody')}
          retryLabel={t('mobile.dealerHome.retry')}
          onRetry={() => void query.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const data: DealerHomePayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? fixture
      : query.data;

  if (!data) {
    return (
      <ScrollableScreen contentContainerStyle={clearanceStyle}>
        <DealerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  const goCatalog = () => router.push('/(app)/(customer)/(tabs)/catalog' as Href);
  const goOrdersChip = (chip: 'production' | 'ready' | 'shipped' | 'delivered') =>
    router.push(`/(app)/(customer)/(tabs)/orders?chip=${chip}` as Href);

  const metricCards = [
    {
      id: 'production',
      title: t('lifecycle.tabs.inProduction'),
      value: String(lifecycleCounts.inProduction),
      actionLabel: t('mobile.dealerHome.viewAll'),
      onPress: () => goOrdersChip('production'),
      icon: 'construct-outline' as const,
    },
    {
      id: 'ready',
      title: t('lifecycle.readyForDelivery'),
      value: String(lifecycleCounts.ready),
      actionLabel: t('mobile.dealerHome.viewAll'),
      onPress: () => goOrdersChip('ready'),
      icon: 'cube-outline' as const,
    },
    {
      id: 'shipped',
      title: t('lifecycle.shipped'),
      value: String(lifecycleCounts.shipped),
      actionLabel:
        lifecycleCounts.shipped > 0
          ? t('lifecycle.confirmWhenReceived')
          : t('mobile.dealerHome.viewAll'),
      onPress: () => goOrdersChip('shipped'),
      icon: 'bus-outline' as const,
    },
    {
      id: 'delivered',
      title: t('lifecycle.tabs.delivered'),
      value: String(lifecycleCounts.delivered),
      actionLabel: t('mobile.dealerHome.viewAll'),
      onPress: () => goOrdersChip('delivered'),
      icon: 'checkmark-done-outline' as const,
    },
  ];

  return (
    <ScrollableScreen
      contentContainerStyle={clearanceStyle}
      scrollProps={{
        onScroll,
        scrollEventThrottle: 16,
        refreshControl: forceState ? undefined : (
          <RefreshControl
            refreshing={refreshing || showcaseQuery.isRefetching || lifecycleOrdersQuery.isRefetching}
            onRefresh={() => {
              void query.refetch();
              if (canBrowseCatalog) void showcaseQuery.refetch();
              void lifecycleOrdersQuery.refetch();
              void ownDeliveriesQuery.refetch();
            }}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      {chrome(data.unreadNotifications)}

      <DealerHero
        greeting={greeting}
        imageUris={showcaseUris}
        onOpenCatalog={goCatalog}
        catalogA11yLabel={t('mobile.dealerHome.exploreCatalog')}
        active={heroActive}
      />

      <View style={{ gap: theme.spacing.lg }}>
        <DealerHomeMetrics cards={metricCards} />
        <DealerHomeDestinations />
        {canBrowseCatalog ? (
          <>
            <Divider compact />
            <FeaturedCollections collections={collections} />
          </>
        ) : null}
      </View>
    </ScrollableScreen>
  );
}
