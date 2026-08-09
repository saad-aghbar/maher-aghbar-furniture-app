import type { Href } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { SurfaceCard } from '@/components/surfaces/SurfaceCard';
import { LastUpdatedLabel } from '@/components/feedback/LastUpdatedLabel';
import { getStatement } from '@/api/modules/payments';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';

export function DealerAccountScreen() {
  const { user } = useAuth();
  const { t, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const customerId = user?.customerId;
  const allowed = can(user, 'statement.read') && Boolean(customerId);

  const query = useQuery({
    queryKey: queryKeys.statements.detail(customerId ?? ''),
    queryFn: () => getStatement(customerId!),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(customer)/(tabs)' as Href}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(customer)/(tabs)' as Href}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.account.errorTitle')}
          description={t('mobile.account.errorBody')}
          retryLabel={t('mobile.account.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const stmt = query.data;
  const payments = stmt?.payments ?? [];

  return (
    <AppScreen backFallback={'/(app)/(customer)/(tabs)' as Href}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(query.isRefetching)}
            onRefresh={() => void query.refetch()}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <AppText variant="title" weight="semibold">
              {t('mobile.account.statementTitle')}
            </AppText>
            {stmt ? (
              <>
                <AppText variant="caption" color="secondary">
                  {stmt.customer.name} ({stmt.customer.code})
                </AppText>
                <LastUpdatedLabel updatedAt={query.dataUpdatedAt} />
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <SurfaceCard style={{ flex: 1 }}>
                    <AppText variant="caption" color="secondary">
                      {t('mobile.account.totalInvoiced')}
                    </AppText>
                    <AppText weight="semibold">{stmt.totalInvoiced}</AppText>
                  </SurfaceCard>
                  <SurfaceCard style={{ flex: 1 }}>
                    <AppText variant="caption" color="secondary">
                      {t('mobile.account.totalPaid')}
                    </AppText>
                    <AppText weight="semibold">{stmt.totalPaid}</AppText>
                  </SurfaceCard>
                </View>
                <SurfaceCard style={{ backgroundColor: colors.errorSoft }}>
                  <AppText variant="caption" color="secondary">
                    {t('mobile.account.outstanding')}
                  </AppText>
                  <AppText variant="heading" weight="semibold" style={{ color: colors.error }}>
                    {stmt.outstandingBalance} {stmt.currency}
                  </AppText>
                </SurfaceCard>
                <AppText variant="heading" weight="semibold">
                  {t('mobile.account.payments')}
                </AppText>
              </>
            ) : (
              <AppText>{t('mobile.account.loading')}</AppText>
            )}
          </View>
        }
        ListEmptyComponent={
          stmt ? (
            <EmptyState
              title={t('mobile.account.emptyPayments')}
              description={t('mobile.account.emptyPaymentsBody')}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <SurfaceCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText weight="semibold">{item.number}</AppText>
              <StatusBadge
                status="PAID"
                label={(() => {
                  const key = `mobile.account.method.${item.method}`;
                  const label = t(key);
                  return label === key ? String(item.method) : label;
                })()}
              />
            </View>
            <AppText variant="caption" color="secondary" dir="ltr">
              {formatDate(item.paymentDate)}
            </AppText>
            <AppText weight="medium" dir="ltr">
              {String(item.amount)}
            </AppText>
            {item.referenceNumber ? (
              <AppText variant="caption" color="secondary">
                {item.referenceNumber}
              </AppText>
            ) : null}
          </SurfaceCard>
        )}
      />
    </AppScreen>
  );
}
