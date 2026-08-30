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
  type Payment,
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
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { paymentMethodKey } from './selectStatement';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;

/**
 * Dealer read-only payments + account credit — no record/apply finance edits.
 */
export function DealerPaymentsScreen() {
  const { t, isRTL, locale, formatCurrency, formatDate } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const { showToast } = useToast();
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const customerId = user?.customerId ?? null;
  const allowed = can(user, 'payment.read') && Boolean(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [search, setSearch] = useState('');

  const financeQuery = useQuery({
    queryKey: queryKeys.payments.dealerSummary(customerId ?? ''),
    queryFn: () => getDealerFinanceSummary(customerId!),
    enabled: allowed,
  });

  const paymentsQuery = useQuery({
    queryKey: queryKeys.payments.list({ customerId, q: search.trim() || undefined }),
    queryFn: () =>
      listPayments({
        page: 1,
        pageSize: 100,
        customerId: customerId!,
        q: search.trim() || undefined,
      }),
    enabled: allowed,
  });

  const rows = useMemo(() => paymentsQuery.data?.data ?? [], [paymentsQuery.data]);
  const amountDue = Number(financeQuery.data?.amountDue ?? 0);
  const availableCredit = Number(financeQuery.data?.availableCredit ?? 0);

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
      <AppScreen backFallback={BACK_FALLBACK}>
        <AppText>{t('mobile.forbiddenArea')}</AppText>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      backFallback={BACK_FALLBACK}
      edges={['top', 'left', 'right']}
      contentContainerStyle={{ paddingBottom: SURFACE_TAB_BAR_CLEARANCE + theme.spacing.xl }}
    >
      <OfflineBanner visible={isOffline} />
      {pdfDownloadSheet}
      <View style={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg }}>
        <View style={{ minHeight: theme.sizes.touch.min, justifyContent: 'center' }}>
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
            style={{ textAlign: 'center', paddingHorizontal: theme.sizes.touch.min + 8 }}
          >
            {t('mobile.account.paymentsTitle')}
          </AppText>
        </View>

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
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
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
                  gap: 4,
                  padding: theme.spacing.sm,
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
                    letterSpacing: locale === 'ar' ? 0 : 0.45,
                    fontSize: 10,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('accounting.amountDue')}
                </AppText>
                <AppText
                  variant="title"
                  weight={titleWeight}
                  dir="ltr"
                  style={{ textAlign: isRTL ? 'right' : 'left' }}
                >
                  {formatCurrency(amountDue)}
                </AppText>
              </View>
              <View
                style={{
                  flex: 1,
                  gap: 4,
                  padding: theme.spacing.sm,
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
                    letterSpacing: locale === 'ar' ? 0 : 0.45,
                    fontSize: 10,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('accounting.accountCredit')}
                </AppText>
                <AppText
                  variant="title"
                  weight={titleWeight}
                  dir="ltr"
                  style={{
                    color: availableCredit > 0 ? colors.success : colors.textSecondary,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {formatCurrency(availableCredit)}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color="muted">
              {t('mobile.account.paymentsReadOnlyHint')}
            </AppText>
          </View>
        </View>

        <DealerSearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t('accounting.searchPayments')}
        />

        {paymentsQuery.isError ? (
          <ErrorState
            title={t('mobile.account.paymentsErrorTitle')}
            body={t('mobile.account.paymentsErrorBody')}
            onRetry={() => {
              void paymentsQuery.refetch();
              void financeQuery.refetch();
            }}
          />
        ) : rows.length === 0 && !paymentsQuery.isLoading ? (
          <DealerEmptyState
            title={t('accounting.paymentsEmpty')}
            body={t('accounting.paymentsEmptyHint')}
          />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={paymentsQuery.isRefetching || financeQuery.isRefetching}
                onRefresh={() => {
                  void paymentsQuery.refetch();
                  void financeQuery.refetch();
                }}
              />
            }
            contentContainerStyle={{ gap: theme.spacing.sm }}
            renderItem={({ item, index }) => (
              <ListItemEnter index={index}>
                <PaymentRowCard
                  payment={item}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  methodLabel={t(paymentMethodKey(item.method))}
                  creditLabel={t('accounting.unallocatedCredit')}
                  allocatedLabel={t('accounting.allocatedToInvoices')}
                  onPdf={() => onPdf(item.id)}
                />
              </ListItemEnter>
            )}
          />
        )}
      </View>
    </AppScreen>
  );
}

function PaymentRowCard({
  payment,
  formatCurrency,
  formatDate,
  methodLabel,
  creditLabel,
  allocatedLabel,
  onPdf,
}: {
  payment: Payment;
  formatCurrency: (n: number) => string;
  formatDate: (d: string | Date) => string;
  methodLabel: string;
  creditLabel: string;
  allocatedLabel: string;
  onPdf: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const amount = Number(payment.amount ?? 0);
  const unallocated = Number(payment.unallocatedAmount ?? 0);
  const allocated = Number(
    payment.allocatedAmount ?? Math.max(0, amount - unallocated),
  );

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <AppText variant="label" weight={titleWeight}>
          {payment.number}
        </AppText>
        <AppText variant="label" weight={titleWeight}>
          {formatCurrency(amount)}
        </AppText>
      </View>
      <AppText variant="caption" color="muted">
        {formatDate(payment.paymentDate)} · {methodLabel}
      </AppText>
      <AppText variant="caption" color="muted">
        {allocatedLabel}: {formatCurrency(allocated)}
      </AppText>
      {unallocated > 0.001 ? (
        <AppText variant="caption" weight="medium" style={{ color: colors.success }}>
          {creditLabel}: {formatCurrency(unallocated)}
        </AppText>
      ) : null}
      <AnimatedPressable
        variant="soft"
        onPress={() => {
          void haptics.confirmLight();
          onPdf();
        }}
        style={{ alignSelf: isRTL ? 'flex-start' : 'flex-end', marginTop: 4 }}
      >
        <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
          {t('mobile.invoices.pdf')}
        </AppText>
      </AnimatedPressable>
    </View>
  );
}
