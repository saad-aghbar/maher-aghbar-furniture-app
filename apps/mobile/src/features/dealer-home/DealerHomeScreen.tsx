import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { listBrowseProducts } from '@/features/catalog/api';
import { DealerEmptyState, DealerHero } from '@/features/dealer-ui';
import { DEALER_NEW_ORDER_HREF } from '@/features/dealer-ui/DealerNewOrderButton';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { DealerHomeHeader } from './components/DealerHomeHeader';
import { DealerHomeMetrics } from './components/DealerHomeMetrics';
import { DealerHomeSkeleton } from './components/DealerHomeSkeleton';
import { FeaturedCollections } from './components/FeaturedCollections';
import { pickShowcaseImages } from './pickShowcaseImages';
import { useDealerHomeQuery } from './query';
import {
  isDealerHomeEmpty,
  mapDealerHomeInvoices,
  outstandingBalanceNumber,
} from './selectDealerHome';
import type { DealerHomePayload } from './api';

const HERO_PAUSE_Y = 280;

type DealerHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: DealerHomePayload;
};

export function DealerHomeScreen({ forceState, fixture }: DealerHomeScreenProps = {}) {
  const { user } = useAuth();
  const { t, formatCurrency, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const [heroActive, setHeroActive] = useState(true);

  const allowed = Boolean(user?.customerId && can(user, 'sales-order.read'));
  const canCreate = can(user, 'request.create') || Boolean(forceState);
  const canBrowseCatalog = can(user, 'catalog.read') || Boolean(forceState);
  const canStatement = can(user, 'statement.read');
  const canInvoices = can(user, 'invoice.read');

  const query = useDealerHomeQuery(allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;

  const showcaseQuery = useQuery({
    queryKey: queryKeys.catalog.list({ page: 1, pageSize: 24, showcase: true }),
    queryFn: () => listBrowseProducts({ page: 1, pageSize: 24 }),
    enabled: canBrowseCatalog && !forceState,
    staleTime: 60_000,
  });

  const [showcaseUris, setShowcaseUris] = useState<string[]>([]);
  useEffect(() => {
    const products = showcaseQuery.data?.data ?? [];
    setShowcaseUris(pickShowcaseImages(products, { min: 5, max: 10 }));
  }, [showcaseQuery.dataUpdatedAt]);

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

  const empty = forceState === 'empty' || isDealerHomeEmpty(data);
  const invoices = mapDealerHomeInvoices(data.recentInvoices);
  const latestInvoice = invoices[0];
  const balance = outstandingBalanceNumber(data);

  const goCatalog = () => router.push('/(app)/(customer)/(tabs)/catalog' as Href);
  const goOrders = () => router.push('/(app)/(customer)/(tabs)/orders' as Href);
  const goNewOrder = () => router.push(DEALER_NEW_ORDER_HREF as Href);
  const goStatement = () => router.push('/(app)/(customer)/account/statement' as Href);
  const goInvoices = () => router.push('/(app)/(customer)/invoices' as Href);
  const goInvoice = (id: string) =>
    router.push(`/(app)/(customer)/invoices/${id}` as Href);

  const metricCards = [
    {
      id: 'active',
      title: t('mobile.dealerHome.activeOrders'),
      value: String(data.activeOrders),
      actionLabel: t('mobile.dealerHome.viewAll'),
      onPress: goOrders,
      icon: 'bag-handle-outline' as const,
    },
    {
      id: 'near',
      title: t('mobile.dealerHome.nearDelivery'),
      value: String(data.ordersNearingDelivery),
      actionLabel: t('mobile.dealerHome.viewAll'),
      onPress: goOrders,
      icon: 'paper-plane-outline' as const,
    },
    {
      id: 'balance',
      title: t('mobile.dealerHome.outstandingBalance'),
      value: formatCurrency(balance),
      actionLabel: canStatement
        ? t('mobile.dealerHome.viewStatement')
        : t('mobile.dealerHome.viewAll'),
      onPress: canStatement ? goStatement : goOrders,
      icon: 'wallet-outline' as const,
    },
    {
      id: 'invoice',
      title: t('mobile.dealerHome.latestInvoice'),
      value: latestInvoice
        ? latestInvoice.number
        : t('mobile.dealerHome.noLatestInvoice'),
      actionLabel: latestInvoice
        ? `${formatCurrency(latestInvoice.outstandingAmount || latestInvoice.total)}${
            latestInvoice.issuedAt ? ` · ${formatDate(latestInvoice.issuedAt)}` : ''
          }`
        : canInvoices
          ? t('mobile.dealerHome.viewInvoices')
          : t('mobile.dealerHome.viewAll'),
      onPress: latestInvoice
        ? () => goInvoice(latestInvoice.id)
        : canInvoices
          ? goInvoices
          : goOrders,
      icon: 'receipt-outline' as const,
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
            refreshing={refreshing || showcaseQuery.isRefetching}
            onRefresh={() => {
              void query.refetch();
              if (canBrowseCatalog) void showcaseQuery.refetch();
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

      {empty ? (
        <DealerEmptyState
          title={t('mobile.dealerHome.emptyTitle')}
          body={t('mobile.dealerHome.emptyBody')}
          actionLabel={canCreate ? t('mobile.dealerHome.createOrder') : undefined}
          onAction={canCreate ? goNewOrder : undefined}
        />
      ) : (
        <View style={{ gap: theme.spacing.lg }}>
          <DealerHomeMetrics cards={metricCards} />
          {canBrowseCatalog ? (
            <>
              <Divider compact />
              <FeaturedCollections />
            </>
          ) : null}
        </View>
      )}
    </ScrollableScreen>
  );
}
