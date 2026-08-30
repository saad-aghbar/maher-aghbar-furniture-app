import { type ReactElement, type ReactNode, useState } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
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
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { AtelierScrollProvider, useAtelierScroll } from './AtelierScrollContext';
import { AdminHomeAtelierDashboard } from './components/AdminHomeAtelierDashboard';
import { AdminHomeAtelierHero } from './components/AdminHomeAtelierHero';
import { AdminHomeLivingHero } from './components/AdminHomeLivingHero';
import { AdminHomeLivingHome } from './components/AdminHomeLivingHome';
import { AdminHomeOpsInventory } from './components/AdminHomeOpsInventory';
import { AdminHomeQuickAccess } from './components/AdminHomeQuickAccess';
import { AdminHomeSignatureHome } from './components/AdminHomeSignatureHome';
import { AdminHomeSkeleton } from './components/AdminHomeSkeleton';
import { ADMIN_HOME_COMPOSITION } from './homeComposition';
import { mapMgmtHref } from './mapMgmtHref';
import { homeAttentionCount, pickHomeFocus } from './pickHomeFocus';
import { useAdminHomeQuery, useManagementSummaryQuery } from './query';
import type { AdminHomePayload, ManagementSummaryPayload } from './api';

type AdminHomeScreenProps = {
  forceState?: 'loading' | 'error' | 'empty' | 'offline' | 'success';
  fixture?: AdminHomePayload;
  /** Piece 12 management desk fixture (signature composition). */
  managementFixture?: ManagementSummaryPayload;
};

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
  /** Extra clearance so the last Attention card sits fully above the floating tab bar. */
  const scrollBottomPad =
    insets.bottom + theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE + theme.spacing['5xl'];

  return (
    <Animated.ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      scrollEventThrottle={16}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + theme.spacing.lg,
        paddingBottom: scrollBottomPad,
        paddingHorizontal: theme.spacing.lg,
        flexGrow: 1,
      }}
      refreshControl={refreshControl}
    >
      {children}
    </Animated.ScrollView>
  );
}

export function AdminHomeScreen({
  forceState,
  fixture,
  managementFixture,
}: AdminHomeScreenProps = {}) {
  return (
    <AtelierScrollProvider>
      <AdminHomeScreenInner
        forceState={forceState}
        fixture={fixture}
        managementFixture={managementFixture}
      />
    </AtelierScrollProvider>
  );
}

function AdminHomeScreenInner({
  forceState,
  fixture,
  managementFixture,
}: AdminHomeScreenProps) {
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
  const isSignature = composition === 'signature';
  const [searchActive, setSearchActive] = useState(false);

  const query = useAdminHomeQuery(allowedSales && !forceState);
  const summaryQuery = useManagementSummaryQuery(
    allowedSales && isSignature && !forceState,
  );
  const canNotify = can(user, 'notification.read');
  const notificationsQuery = useNotificationsQuery(canNotify && !allowedSales && !forceState);
  const unreadFromInbox = unreadCount(normalizeNotificationList(notificationsQuery.data));
  const refreshing =
    (query.isRefetching && !query.isLoading) ||
    (summaryQuery.isRefetching && !summaryQuery.isLoading);
  const userName = user?.name ?? t('mobile.adminHome.fallbackName');

  const refresh =
    forceState ? undefined : (
      <RefreshControl
        refreshing={refreshing || Boolean(notificationsQuery.isRefetching)}
        onRefresh={() => {
          if (allowedSales) {
            void query.refetch();
            if (isSignature) {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.reports.managementSummary(),
              });
            }
          }
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

  const signatureLoading =
    isSignature &&
    allowedSales &&
    summaryQuery.isLoading &&
    !summaryQuery.data &&
    !forceState;
  const signatureError =
    isSignature &&
    allowedSales &&
    summaryQuery.isError &&
    !summaryQuery.data &&
    !forceState;
  const salesLoading =
    !isSignature && allowedSales && query.isLoading && !query.data && !forceState;
  const salesError =
    !isSignature && allowedSales && query.isError && !query.data && !forceState;

  const showLoading =
    forceState === 'loading' ||
    hydrating ||
    signatureLoading ||
    salesLoading ||
    (allowedSales &&
      !isSignature &&
      !query.data &&
      !forceState &&
      homeKind !== 'warehouse') ||
    (isSignature &&
      allowedSales &&
      !summaryQuery.data &&
      !forceState &&
      homeKind !== 'warehouse' &&
      !signatureError);

  const showError = forceState === 'error' || signatureError || salesError;

  const data: AdminHomePayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? fixture
      : query.data;

  const summary: ManagementSummaryPayload | undefined =
    forceState === 'success' || forceState === 'empty' || forceState === 'offline'
      ? managementFixture
      : summaryQuery.data;

  const attention = isSignature
    ? (summary?.attention.length ?? 0)
    : data
      ? homeAttentionCount(data)
      : 0;
  const focus = !isSignature && data ? pickHomeFocus(data) : null;
  const unread = allowedSales ? (data?.unreadNotifications ?? 0) : unreadFromInbox;
  const firstAttention = summary?.attention[0];

  const hero = livingHero ? (
    <AdminHomeLivingHero
      userName={userName}
      unreadNotifications={showLoading ? 0 : unread}
      canOpenNotifications={canNotify}
      attention={showLoading ? 0 : attention}
      showAttention={composition !== 'signature' || (!showLoading && attention === 0)}
      onAttentionPress={() => {
        if (isSignature && firstAttention) {
          router.push(mapMgmtHref(firstAttention.href, firstAttention.filter));
          return;
        }
        if (focus) router.push(focus.href);
      }}
    />
  ) : (
    <AdminHomeAtelierHero
      userName={userName}
      unreadNotifications={showLoading ? 0 : unread}
      canOpenNotifications={canNotify}
      attention={showLoading ? 0 : attention}
    />
  );

  const salesBody =
    isSignature && summary ? (
      <AdminHomeSignatureHome data={summary} onSearchActiveChange={setSearchActive} />
    ) : data && composition === 'living' ? (
      <AdminHomeLivingHome data={data} />
    ) : data ? (
      <AdminHomeAtelierDashboard data={data} />
    ) : null;

  let body: ReactNode = null;
  if (showLoading) {
    body = <AdminHomeSkeleton />;
  } else if (showError) {
    body = (
      <ErrorState
        title={t('mobile.adminHome.errorTitle')}
        description={t('mobile.adminHome.errorBody')}
        retryLabel={t('mobile.adminHome.retry')}
        onRetry={() => {
          if (isSignature) void summaryQuery.refetch();
          else void query.refetch();
        }}
      />
    );
  } else if (homeKind === 'personal' && !forceState) {
    body = (
      <>
        <AppText variant="heading" weight="semibold" style={{ marginTop: theme.spacing.md }}>
          {t('mobile.staffHome.restrictedTitle')}
        </AppText>
        <AppText variant="bodySecondary" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          {t('mobile.staffHome.restrictedBody')}
        </AppText>
      </>
    );
  } else {
    body = (
      <>
        {homeKind === 'sales' ? salesBody : null}
        {!searchActive && homeKind === 'warehouse' ? <AdminHomeOpsInventory /> : null}
        {homeKind === 'backoffice' ? <AdminHomeQuickAccess /> : null}
      </>
    );
  }

  return (
    <AtelierScrollShell refreshControl={showLoading || showError ? undefined : refresh}>
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      {hero}
      {body}
    </AtelierScrollShell>
  );
}
