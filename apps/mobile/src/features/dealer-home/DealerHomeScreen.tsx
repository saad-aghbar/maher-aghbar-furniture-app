import { RefreshControl, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { BalanceHeroCard } from './components/BalanceHeroCard';
import { DealerHomeHeader } from './components/DealerHomeHeader';
import { DealerHomeSkeleton } from './components/DealerHomeSkeleton';
import { MetricStrip } from './components/MetricStrip';
import { RecentInvoices } from './components/RecentInvoices';
import { RecentOrdersList } from './components/RecentOrdersList';
import { useDealerHomeQuery } from './query';
import {
  isDealerHomeEmpty,
  metricStrip,
  outstandingBalanceNumber,
} from './selectDealerHome';
import type { DealerHomePayload } from './api';

type DealerHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: DealerHomePayload;
};

export function DealerHomeScreen({ forceState, fixture }: DealerHomeScreenProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const allowed = Boolean(user?.customerId && can(user, 'sales-order.read'));
  const canCreate = can(user, 'request.create') || Boolean(forceState);

  const query = useDealerHomeQuery(allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;
  const displayName = user?.name ?? t('mobile.dealerHome.fallbackName');

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <ScrollableScreen>
        <DealerHomeHeader
          displayName={displayName}
          unreadNotifications={0}
          canOpenNotifications={can(user, 'notification.read')}
        />
        <DealerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  if (!allowed && !forceState) {
    return (
      <ScrollableScreen>
        <DealerHomeHeader
          displayName={displayName}
          unreadNotifications={0}
          canOpenNotifications={can(user, 'notification.read')}
        />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <ScrollableScreen>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <DealerHomeHeader
          displayName={displayName}
          unreadNotifications={0}
          canOpenNotifications={can(user, 'notification.read')}
        />
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
      <ScrollableScreen>
        <DealerHomeSkeleton />
      </ScrollableScreen>
    );
  }

  const empty = forceState === 'empty' || isDealerHomeEmpty(data);

  return (
    <ScrollableScreen
      scrollProps={{
        refreshControl: forceState ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      <DealerHomeHeader
        displayName={displayName}
        unreadNotifications={data.unreadNotifications}
        canOpenNotifications={can(user, 'notification.read')}
      />
      {empty ? (
        <EmptyState
          title={t('mobile.dealerHome.emptyTitle')}
          description={t('mobile.dealerHome.emptyBody')}
          actionLabel={canCreate ? t('mobile.dealerHome.newOrder') : undefined}
          onAction={
            canCreate
              ? () => router.push('/(app)/(customer)/(tabs)/new-order' as Href)
              : undefined
          }
        />
      ) : (
        <View>
          <BalanceHeroCard
            balance={outstandingBalanceNumber(data)}
            dueInDays={data.balanceDueInDays}
            showNewOrder={canCreate}
          />
          <MetricStrip metrics={metricStrip(data)} />
          <RecentOrdersList orders={data.recentOrders} />
          <RecentInvoices invoices={data.recentInvoices} />
        </View>
      )}
    </ScrollableScreen>
  );
}
