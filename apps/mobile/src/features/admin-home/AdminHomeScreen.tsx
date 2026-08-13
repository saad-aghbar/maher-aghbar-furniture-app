import { type ReactElement, type ReactNode } from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { AtelierScrollProvider, useAtelierScroll } from './AtelierScrollContext';
import { AdminHomeAtelierDashboard } from './components/AdminHomeAtelierDashboard';
import { AdminHomeAtelierHero } from './components/AdminHomeAtelierHero';
import { AdminHomeLivingHero } from './components/AdminHomeLivingHero';
import { AdminHomeLivingHome } from './components/AdminHomeLivingHome';
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
  const { user } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const { showOfflineBanner } = useNetwork();
  const allowed = can(user, 'report.sales.read');
  const composition = ADMIN_HOME_COMPOSITION;
  const livingHero = composition === 'living' || composition === 'signature';

  const query = useAdminHomeQuery(allowed && !forceState);
  const refreshing = query.isRefetching && !query.isLoading;
  const userName = user?.name ?? t('mobile.adminHome.fallbackName');
  const canNotify = can(user, 'notification.read');

  const refresh =
    forceState ? undefined : (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => void query.refetch()}
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

  if (forceState === 'loading' || (allowed && query.isLoading && !query.data && !forceState)) {
    return (
      <AtelierScrollShell>
        {heroLoading}
        <AdminHomeSkeleton />
      </AtelierScrollShell>
    );
  }

  if (!allowed && !forceState) {
    return (
      <AtelierScrollShell>
        {heroLoading}
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AtelierScrollShell>
    );
  }

  if (forceState === 'error' || (query.isError && !query.data && !forceState)) {
    return (
      <AtelierScrollShell>
        {showOfflineBanner ? <OfflineBanner /> : null}
        {heroLoading}
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

  if (!data) {
    return (
      <AtelierScrollShell>
        <AdminHomeSkeleton />
      </AtelierScrollShell>
    );
  }

  const attention = homeAttentionCount(data);
  const focus = pickHomeFocus(data);

  return (
    <AtelierScrollShell refreshControl={refresh}>
      {showOfflineBanner || forceState === 'offline' ? <OfflineBanner /> : null}
      {livingHero ? (
        <AdminHomeLivingHero
          userName={userName}
          unreadNotifications={data.unreadNotifications}
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
          unreadNotifications={data.unreadNotifications}
          canOpenNotifications={canNotify}
          attention={attention}
        />
      )}
      {composition === 'signature' ? (
        <AdminHomeSignatureHome data={data} />
      ) : composition === 'living' ? (
        <AdminHomeLivingHome data={data} />
      ) : (
        <AdminHomeAtelierDashboard data={data} />
      )}
    </AtelierScrollShell>
  );
}
