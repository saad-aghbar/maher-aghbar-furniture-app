import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import type { Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { queryKeys } from '@/api/queryKeys';
import {
  getDealerFinanceSummary,
  listPayments,
  openPaymentPdf,
} from '@/api/modules/payments';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { PaymentBoardCard } from './components/PaymentBoardCard';
import {
  StatementDateSheet,
  StatementDateTrigger,
} from './components/StatementDateSheet';
import {
  filterDealerPayments,
  paymentsDateBounds,
} from './selectPayments';
import type { StatementDatePreset, StatementPdfRange } from './selectStatement';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;

function PaymentsScreenTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <ScreenBackLead fallback={BACK_FALLBACK} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('mobile.account.paymentsTitle')}
      </AppText>
    </View>
  );
}

/**
 * Dealer payments desk — floor money board, date range, and payment cards.
 */
export function DealerPaymentsScreen() {
  const { t, isRTL, locale, formatCurrency } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { user } = useAuth();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const customerId = user?.customerId ?? null;
  const allowed = can(user, 'payment.read') && Boolean(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<StatementDatePreset>('all');
  const [customRange, setCustomRange] = useState<StatementPdfRange>({});
  const [dateSheetOpen, setDateSheetOpen] = useState(false);

  const dateRange = useMemo(
    () => paymentsDateBounds(datePreset, customRange),
    [datePreset, customRange],
  );

  const financeQuery = useQuery({
    queryKey: queryKeys.payments.dealerSummary(customerId ?? ''),
    queryFn: () => getDealerFinanceSummary(customerId!),
    enabled: allowed,
  });

  const paymentsQuery = useQuery({
    queryKey: queryKeys.payments.list({
      customerId,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    queryFn: () =>
      listPayments({
        page: 1,
        pageSize: 100,
        customerId: customerId!,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    enabled: allowed,
  });

  const rows = useMemo(
    () =>
      filterDealerPayments(paymentsQuery.data?.data ?? [], {
        q: search,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    [paymentsQuery.data, search, dateRange.dateFrom, dateRange.dateTo],
  );

  const amountDue = Number(financeQuery.data?.amountDue ?? 0);
  const availableCredit = Number(financeQuery.data?.availableCredit ?? 0);
  const filtersActive = datePreset !== 'all' || search.trim().length > 0;

  const onPdf = (paymentId: string) => {
    void (async () => {
      const opts = await pickPdfOptions();
      if (!opts) return;
      try {
        await openPaymentPdf(paymentId, opts);
      } catch {
        showToast({
          variant: 'error',
          message: t('mobile.account.paymentPdfFailed'),
        });
      }
    })();
  };

  if (!allowed) {
    return (
      <AppScreen>
        <PaymentsScreenTitle titleWeight={titleWeight} />
        <DealerEmptyState
          title={t('mobile.noModules')}
          body={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom: theme.spacing['3xl'] + SURFACE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(paymentsQuery.isRefetching || financeQuery.isRefetching)}
            onRefresh={() => {
              void paymentsQuery.refetch();
              void financeQuery.refetch();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
            <PaymentsScreenTitle titleWeight={titleWeight} />

            <View
              style={{
                borderRadius: theme.radius.xl,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                overflow: 'hidden',
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.55,
                }}
              />
              <View
                style={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{ color: colors.brand }}
                  numberOfLines={1}
                >
                  {t('mobile.account.paymentsTitle')}
                </AppText>
              </View>
              <View
                style={{
                  padding: theme.spacing.lg,
                  gap: theme.spacing.md,
                  ...(isRTL
                    ? { paddingRight: theme.spacing.lg + 4 }
                    : { paddingLeft: theme.spacing.lg + 4 }),
                }}
              >
                <View
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    gap: theme.spacing.md,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      gap: 6,
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      backgroundColor: colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{
                        textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        letterSpacing: locale === 'ar' ? 0 : 0.55,
                        fontSize: 11,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t('mobile.account.amountDue')}
                    </AppText>
                    <AppText
                      variant="title"
                      weight={titleWeight}
                      dir="ltr"
                      numberOfLines={1}
                      style={{
                        textAlign: isRTL ? 'right' : 'left',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatCurrency(amountDue)}
                    </AppText>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      gap: 6,
                      padding: theme.spacing.md,
                      borderRadius: theme.radius.lg,
                      backgroundColor:
                        availableCredit > 0 ? colors.successSoft : colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor:
                        availableCredit > 0 ? `${colors.success}55` : colors.border,
                    }}
                  >
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{
                        textTransform: locale === 'ar' ? 'none' : 'uppercase',
                        letterSpacing: locale === 'ar' ? 0 : 0.55,
                        fontSize: 11,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t('mobile.account.accountCredit')}
                    </AppText>
                    <AppText
                      variant="title"
                      weight={titleWeight}
                      dir="ltr"
                      numberOfLines={1}
                      style={{
                        color: availableCredit > 0 ? colors.success : colors.textSecondary,
                        textAlign: isRTL ? 'right' : 'left',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatCurrency(availableCredit)}
                    </AppText>
                  </View>
                </View>
                <AppText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {t('mobile.account.paymentsReadOnlyHint')}
                </AppText>
              </View>
            </View>

            <DealerSearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={t('accounting.searchPayments')}
            />
            <StatementDateTrigger
              value={datePreset}
              customFrom={customRange.from}
              customTo={customRange.to}
              onPress={() => setDateSheetOpen(true)}
            />

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                marginTop: theme.spacing.xs,
              }}
            >
              <AppText variant="label" weight={titleWeight}>
                {t('mobile.account.payments')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.account.paymentsCount', { count: String(rows.length) })}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          paymentsQuery.isError ? (
            <ErrorState
              title={t('mobile.account.paymentsErrorTitle')}
              description={t('mobile.account.paymentsErrorBody')}
              retryLabel={t('mobile.account.retry')}
              onRetry={() => {
                void paymentsQuery.refetch();
                void financeQuery.refetch();
              }}
            />
          ) : paymentsQuery.isLoading ? (
            <AppText variant="caption" color="muted">
              {t('mobile.account.loading')}
            </AppText>
          ) : filtersActive ? (
            <DealerEmptyState
              title={t('mobile.account.emptyFilterTitle')}
              body={t('mobile.account.emptyPaymentsFilterBody')}
            />
          ) : (
            <DealerEmptyState
              title={t('mobile.account.emptyPayments')}
              body={t('mobile.account.emptyPaymentsBody')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <PaymentBoardCard payment={item} onPdf={() => onPdf(item.id)} />
          </ListItemEnter>
        )}
      />

      <StatementDateSheet
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={datePreset}
        customFrom={customRange.from}
        customTo={customRange.to}
        onChange={(next, range) => {
          setDatePreset(next);
          setCustomRange(next === 'custom' ? (range ?? {}) : {});
        }}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
