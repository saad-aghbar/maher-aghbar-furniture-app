import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { LastUpdatedLabel } from '@/components/feedback/LastUpdatedLabel';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerEmptyState, DealerSearchBar } from '@/features/dealer-ui';
import { openInvoicePdf } from '@/api/modules/invoices';
import { getStatement, openPaymentPdf, openStatementPdf } from '@/api/modules/payments';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { StatementActivityCard } from './components/StatementActivityCard';
import { StatementBalanceBoard } from './components/StatementBalanceBoard';
import {
  StatementDateSheet,
  StatementDateTrigger,
} from './components/StatementDateSheet';
import { StatementTypeRail } from './components/StatementTypeRail';
import {
  datePresetRange,
  filterStatementRows,
  selectStatementRows,
  selectStatementSummary,
  type StatementDatePreset,
  type StatementTypeFilter,
} from './selectStatement';

const BACK_FALLBACK = '/(app)/(customer)/(tabs)/account' as Href;

function StatementScreenTitle({
  titleWeight,
  customerName,
  updatedAt,
}: {
  titleWeight: 'medium' | 'semibold';
  customerName?: string | null;
  updatedAt?: number;
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ gap: theme.spacing.xs }}>
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
          {t('mobile.account.statementTitle')}
        </AppText>
      </View>
      {customerName ? (
        <AppText
          variant="caption"
          color="muted"
          align="center"
          numberOfLines={1}
          style={{ paddingHorizontal: theme.spacing.lg }}
        >
          {customerName}
        </AppText>
      ) : null}
      <View style={{ alignItems: 'center' }}>
        <LastUpdatedLabel updatedAt={updatedAt} />
      </View>
    </View>
  );
}

/**
 * Dealer account statement — floor balance board + filterable ledger activity.
 */
export function DealerStatementScreen() {
  const { user } = useAuth();
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const customerId = user?.customerId;
  const allowed = can(user, 'statement.read') && Boolean(customerId);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<StatementTypeFilter>('all');
  const [datePreset, setDatePreset] = useState<StatementDatePreset>('all');
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();

  const query = useQuery({
    queryKey: queryKeys.statements.detail(customerId ?? ''),
    queryFn: () => getStatement(customerId!),
    enabled: allowed,
  });

  const summary = useMemo(
    () => (query.data ? selectStatementSummary(query.data) : null),
    [query.data],
  );

  const allRows = useMemo(
    () => (query.data ? selectStatementRows(query.data) : []),
    [query.data],
  );

  const dateRange = useMemo(() => datePresetRange(datePreset), [datePreset]);

  const filteredRows = useMemo(
    () =>
      filterStatementRows(allRows, {
        type: typeFilter,
        q: search,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
      }),
    [allRows, typeFilter, search, dateRange.dateFrom, dateRange.dateTo],
  );

  const filtersActive =
    typeFilter !== 'all' || datePreset !== 'all' || search.trim().length > 0;

  const downloadPdf = async () => {
    if (!customerId || pdfBusy) return;
    const opts = await pickPdfOptions();
    if (!opts) return;
    setPdfBusy(true);
    try {
      await openStatementPdf(customerId, opts);
    } catch {
      showToast({ variant: 'error', message: t('mobile.account.pdfFailed') });
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadRowPdf = async (row: (typeof filteredRows)[number]) => {
    if (!row.entityId) {
      showToast({ variant: 'error', message: t('mobile.account.pdfFailed') });
      return;
    }
    const opts = await pickPdfOptions();
    if (!opts) return;
    try {
      if (row.type === 'INVOICE') {
        await openInvoicePdf(row.entityId, opts);
      } else {
        await openPaymentPdf(row.entityId, opts);
      }
    } catch {
      showToast({
        variant: 'error',
        message:
          row.type === 'INVOICE'
            ? t('mobile.invoices.pdfFailed')
            : t('mobile.account.paymentPdfFailed'),
      });
    }
  };

  if (!allowed) {
    return (
      <AppScreen>
        <StatementScreenTitle titleWeight={titleWeight} />
        <DealerEmptyState
          title={t('mobile.noModules')}
          body={t('mobile.noModulesHint')}
        />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen>
        <StatementScreenTitle titleWeight={titleWeight} />
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

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        data={filteredRows}
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
            <StatementScreenTitle
              titleWeight={titleWeight}
              customerName={summary?.customerLabel}
              updatedAt={query.dataUpdatedAt}
            />

            {summary ? (
              <StatementBalanceBoard
                summary={summary}
                onDownloadPdf={() => void downloadPdf()}
                pdfBusy={pdfBusy}
              />
            ) : null}

            <DealerSearchBar
              value={search}
              onChangeText={setSearch}
              placeholder={t('mobile.account.searchPlaceholder')}
            />
            <StatementTypeRail value={typeFilter} onChange={setTypeFilter} />
            <StatementDateTrigger
              value={datePreset}
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
                {t('mobile.account.activity')}
              </AppText>
              <AppText variant="caption" color="muted">
                {t('mobile.account.activityCount', {
                  count: String(filteredRows.length),
                })}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <AppText variant="caption" color="muted">
              {t('mobile.account.loading')}
            </AppText>
          ) : filtersActive ? (
            <DealerEmptyState
              title={t('mobile.account.emptyFilterTitle')}
              body={t('mobile.account.emptyFilterBody')}
            />
          ) : (
            <DealerEmptyState
              title={t('mobile.account.emptyActivity')}
              body={t('mobile.account.emptyActivityBody')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <StatementActivityCard
              row={item}
              currency={summary?.currency ?? 'ILS'}
              onDownloadPdf={
                item.entityId ? () => void downloadRowPdf(item) : undefined
              }
            />
          </ListItemEnter>
        )}
      />

      <StatementDateSheet
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={datePreset}
        onChange={setDatePreset}
      />
      {pdfDownloadSheet}
    </AppScreen>
  );
}
