import { type ReactElement, type ReactNode } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { can, resolveComposedHomeKind, shouldFetchSalesAdminHome } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { queryKeys } from '@/api/queryKeys';
import { useNotificationsQuery } from '@/features/notifications/query';
import { normalizeNotificationList, unreadCount } from '@/features/notifications/selectNotification';
import { AtelierScrollProvider, useAtelierScroll } from './AtelierScrollContext';
import { HomeSearchRow } from '@/components/chrome/HomeSearchRow';
import { AdminHomeAtelierDashboard } from './components/AdminHomeAtelierDashboard';
import { AdminHomeAtelierHero } from './components/AdminHomeAtelierHero';
import { AdminHomeLivingHero } from './components/AdminHomeLivingHero';
import { AdminHomeLivingHome } from './components/AdminHomeLivingHome';
import { AdminHomeOpsInventory } from './components/AdminHomeOpsInventory';
import { AdminHomeQuickAccess } from './components/AdminHomeQuickAccess';
import { AdminHomeSignatureHome } from './components/AdminHomeSignatureHome';
import { AdminHomeSkeleton } from './components/AdminHomeSkeleton';
import { ADMIN_HOME_COMPOSITION } from './homeComposition';
import { homeAttentionCount, pickHomeFocus } from './pickHomeFocus';
import { useAdminHomeQuery } from './query';
import type { AdminHomePayload } from './api';

type AdminHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: AdminHomePayload;
};

function AdminHomeSearch() {
  const { t } = useLocale();
  const router = useRouter();
  return (
    <HomeSearchRow
      placeholder={t('mobile.adminHome.searchPlaceholder')}
      onSearchPress={() => router.push('/(app)/search' as Href)}
      filterA11y={t('mobile.adminHome.filterA11y')}
      onFilterPress={() => router.push('/(app)/(admin)/(tabs)/orders' as Href)}
    />
  );
}

function AtelierScrollShell({
  children,
  refreshControl,
}: {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { scrollY } = useAtelierScroll();
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  return (
    <Animated.ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.lg,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: theme.spacing.lg,
      }}
      refreshControl={refreshControl}
    >
      {children}
    </Animated.ScrollView>
  );
}

export function AdminHomeScreen({ forceState, fixture }: AdminHomeScreenProps = {}) {
  return (
    <AtelierScrollProvider>
      <AdminHomeScreenInner forceState={forceState} fixture={fixture} />
    </AtelierScrollProvider>
  );
}

function AdminHomeScreenInner({ forceState, fixture }: AdminHomeScreenProps) {
  const { user, status } = useAuth();
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const { showOfflineBanner } = useNetwork();
  const queryClient = useQueryClient();
  const homeKind = resolveComposedHomeKind(user);
  const allowedSales = shouldFetchSalesAdminHome(user);
  const allowedOps = homeKind === 'warehouse' || homeKind === 'sales';
  const hydrating = !forceState && (status !== 'authenticated' || !user);
  const composition = ADMIN_HOME_COMPOSITION;
  const livingHero = composition === 'living' || composition === 'signature';

  const query = useAdminHomeQuery(allowedSales && !forceState);
  const canNotify = can(user, 'notification.read');
  const notificationsQuery = useNotificationsQuery(canNotify && !allowedSales && !forceState);
  const unreadFromInbox = unreadCount(normalizeNotificationList(notificationsQuery.data));
  const refreshing = query.isRefetching && !query.isLoading;
  const userName = user?.name ?? t('mobile.adminHome.fallbackName');

  const refresh =
    forceState ? undefined : (
      <RefreshControl
        refreshing={refreshing || Boolean(notificationsQuery.isRefetching)}
        onRefresh={() => {
          if (allowedSales) void query.refetch();
          if (canNotify && !allowedSales) void notificationsQuery.refetch();
          if (homeKind === 'warehouse' || allowedOps) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.overview() });
            void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.transfers() });
            void queryClient.invalidateQueries({ queryKey: queryKeys.inventory.counts() });
          }
        }}
        tintColor={colors.brand}
      />
    );

  const heroLoading = livingHero ? (
    <AdminHomeLivingHero
      userName={userName}
      unreadNotifications={0}
      canOpenNotifications={canNotify}
      attention={0}
    />
  ) : (
    <AdminHomeAtelierHero
      userName={userName}
      unreadNotifications={0}
      canOpenNotifications={canNotify}
      attention={0}
    />
  );

  if (forceState === 'loading' || hydrating || (allowedSales && query.isLoading && !query.data && !forceState)) {
    return (
      <AtelierScrollShell>
        {heroLoading}
        <AdminHomeSearch />
        <AdminHomeSkeleton />
      </AtelierScrollShell>
    );
  }

  if (forceState === 'error' || (allowedSales && query.isError && !query.data && !forceState)) {
    return (
      <AtelierScrollShell>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {heroLoading}
        <AdminHomeSearch />
        <ErrorState
          title={t('mobile.adminHome.errorTitle')}
          description={t('mobile.adminHome.errorBody')}
          retryLabel={t('mobile.adminHome.retry')}
          onRetry={() => void query.refetch()}
        />
      </AtelierScrollShell>
    );
  }

  const data: AdminHomePayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? fixture
      : query.data;

  if (allowedSales && !data && !forceState && homeKind !== 'warehouse') {
    return (
      <AtelierScrollShell>
        <AdminHomeSkeleton />
      </AtelierScrollShell>
    );
  }

  const attention = data ? homeAttentionCount(data) : 0;
  const focus = data ? pickHomeFocus(data) : null;
  const unread = allowedSales ? (data?.unreadNotifications ?? 0) : unreadFromInbox;

  const hero = livingHero ? (
    <AdminHomeLivingHero
      userName={userName}
      unreadNotifications={unread}
      canOpenNotifications={canNotify}
      attention={attention}
      showAttention={composition !== 'signature' || attention === 0}
      onAttentionPress={() => {
        if (focus) router.push(focus.href);
      }}
    />
  ) : (
    <AdminHomeAtelierHero
      userName={userName}
      unreadNotifications={unread}
      canOpenNotifications={canNotify}
      attention={attention}
    />
  );

  if (homeKind === 'personal' && !forceState) {
    return (
      <AtelierScrollShell refreshControl={refresh}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {hero}
        <AdminHomeSearch />
        <AppText variant="heading" weight="semibold" style={{ marginTop: theme.spacing.md }}>
          {t('mobile.staffHome.restrictedTitle')}
        </AppText>
        <AppText variant="bodySecondary" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          {t('mobile.staffHome.restrictedBody')}
        </AppText>
      </AtelierScrollShell>
    );
  }

  const salesBody =
    data && composition === 'signature' ? (
      <AdminHomeSignatureHome data={data} />
    ) : data && composition === 'living' ? (
      <AdminHomeLivingHome data={data} />
    ) : data ? (
      <AdminHomeAtelierDashboard data={data} />
    ) : null;

  return (
    <AtelierScrollShell refreshControl={refresh}>
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      {hero}
      <AdminHomeSearch />
      {homeKind === 'sales' ? salesBody : null}
      {homeKind === 'warehouse' || (homeKind === 'sales' && !forceState) ? (
        <AdminHomeOpsInventory />
      ) : null}
      {homeKind === 'backoffice' ? <AdminHomeQuickAccess /> : null}
    </AtelierScrollShell>
  );
}
