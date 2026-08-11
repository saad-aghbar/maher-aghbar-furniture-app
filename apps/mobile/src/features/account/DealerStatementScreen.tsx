import { FlatList, RefreshControl, View } from 'react-native';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { LastUpdatedLabel } from '@/components/feedback/LastUpdatedLabel';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import {
  DealerBalanceCard,
  DealerEmptyState,
  DealerStatusBadge,
} from '@/features/dealer-ui';
import { getStatement, openStatementPdf, type Payment } from '@/api/modules/payments';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { MoreBoard } from '@/features/more/components/MoreBoard';

function methodTone(method: string): 'neutral' | 'success' | 'warning' | 'info' {
  const m = method.toUpperCase();
  if (m === 'CASH') return 'success';
  if (m === 'CHEQUE') return 'warning';
  if (m === 'BANK_TRANSFER') return 'info';
  return 'neutral';
}

/**
 * Premium banking-style account statement for dealers.
 * Totals, outstanding, ledger entries, and Cash/Cheque/Transfer payments.
 */
export function DealerStatementScreen() {
  const { user } = useAuth();
  const { t, formatDate, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const customerId = user?.customerId;
  const allowed = can(user, 'statement.read') && Boolean(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const query = useQuery({
    queryKey: queryKeys.statements.detail(customerId ?? ''),
    queryFn: () => getStatement(customerId!),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <AppScreen backFallback={'/(app)/(customer)/(tabs)/account' as Href}>
        <DealerEmptyState
          title={t('mobile.noModules')}
          body={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={'/(app)/(customer)/(tabs)/account' as Href}>
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
  const entries = stmt?.entries ?? [];
  /** Prefer ledger entries when present; otherwise fall back to payment rows. */
  const listData: Array<
    | { kind: 'entry'; id: string; date: string; label: string; amount: string; side: 'debit' | 'credit' }
    | { kind: 'payment'; id: string; payment: Payment }
  > =
    entries.length > 0
      ? entries.map((e, i) => ({
          kind: 'entry' as const,
          id: `e-${e.reference}-${i}`,
          date: e.date,
          label: e.description || e.reference,
          amount: e.type === 'INVOICE' ? e.debit : e.credit,
          side: (e.type === 'INVOICE' ? 'debit' : 'credit') as 'debit' | 'credit',
        }))
      : payments.map((p) => ({ kind: 'payment' as const, id: p.id, payment: p }));

  return (
    <AppScreen backFallback={'/(app)/(customer)/(tabs)/account' as Href}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={listData}
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
            <AppText
              variant="title"
              weight={titleWeight}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.account.statementTitle')}
            </AppText>
            {stmt ? (
              <>
                <AppText
                  variant="caption"
                  color="secondary"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {stmt.customer.name} ({stmt.customer.code})
                </AppText>
                <LastUpdatedLabel updatedAt={query.dataUpdatedAt} />
                <DealerBalanceCard
                  label={t('mobile.account.outstanding')}
                  amountLabel={`${stmt.outstandingBalance} ${stmt.currency}`}
                  hint={t('mobile.account.asOf', { date: formatDate(stmt.asOf) })}
                />
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.sm,
                  }}
                >
                  <MoreBoard
                    style={{
                      flex: 1,
                      padding: theme.spacing.md,
                      paddingStart: theme.spacing.md + 4,
                    }}
                  >
                    <AppText variant="caption" color="secondary">
                      {t('mobile.account.totalInvoiced')}
                    </AppText>
                    <AppText weight="semibold" dir="ltr">
                      {stmt.totalInvoiced}
                    </AppText>
                  </MoreBoard>
                  <MoreBoard
                    style={{
                      flex: 1,
                      padding: theme.spacing.md,
                      paddingStart: theme.spacing.md + 4,
                    }}
                  >
                    <AppText variant="caption" color="secondary">
                      {t('mobile.account.totalPaid')}
                    </AppText>
                    <AppText weight="semibold" dir="ltr">
                      {stmt.totalPaid}
                    </AppText>
                  </MoreBoard>
                </View>
                <SecondaryButton
                  label={t('mobile.account.downloadPdf')}
                  onPress={() => {
                    void openStatementPdf(customerId!).catch(() => {
                      showToast({
                        variant: 'error',
                        message: t('mobile.account.pdfFailed'),
                      });
                    });
                  }}
                  style={{ borderRadius: theme.radius.xl }}
                />
                <AppText
                  variant="heading"
                  weight={titleWeight}
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.account.activity')}
                </AppText>
              </>
            ) : (
              <AppText>{t('mobile.account.loading')}</AppText>
            )}
          </View>
        }
        ListEmptyComponent={
          stmt ? (
            <DealerEmptyState
              title={t('mobile.account.emptyPayments')}
              body={t('mobile.account.emptyPaymentsBody')}
            />
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'entry') {
            return (
              <MoreBoard
                style={{
                  padding: theme.spacing.md,
                  paddingStart: theme.spacing.md + 4,
                  gap: theme.spacing.xs,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignSelf: 'stretch',
                    gap: theme.spacing.sm,
                  }}
                >
                  <AppText weight="semibold" style={{ flex: 1 }} numberOfLines={2}>
                    {item.label}
                  </AppText>
                  <AppText
                    weight="semibold"
                    dir="ltr"
                    style={{
                      color: item.side === 'debit' ? colors.error : colors.success,
                    }}
                  >
                    {item.side === 'debit' ? `−${item.amount}` : `+${item.amount}`}
                  </AppText>
                </View>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {formatDate(item.date)}
                </AppText>
              </MoreBoard>
            );
          }
          const payment = item.payment;
          const methodKey = `mobile.account.method.${payment.method}`;
          const methodLabel = (() => {
            const label = t(methodKey);
            return label === methodKey ? String(payment.method) : label;
          })();
          return (
            <MoreBoard
              style={{
                padding: theme.spacing.md,
                paddingStart: theme.spacing.md + 4,
                gap: theme.spacing.xs,
                alignItems: isRTL ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignSelf: 'stretch',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText weight="semibold">{payment.number}</AppText>
                <DealerStatusBadge
                  label={methodLabel}
                  tone={methodTone(String(payment.method))}
                />
              </View>
              <AppText variant="caption" color="secondary" dir="ltr">
                {formatDate(payment.paymentDate)}
              </AppText>
              <AppText weight="medium" dir="ltr">
                {String(payment.amount)}
              </AppText>
              {payment.referenceNumber ? (
                <AppText variant="caption" color="secondary">
                  {payment.referenceNumber}
                </AppText>
              ) : null}
            </MoreBoard>
          );
        }}
      />
    </AppScreen>
  );
}
