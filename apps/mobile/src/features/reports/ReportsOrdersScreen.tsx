import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { OrdersSearchBar } from '@/features/sales-orders/components/OrdersSearchBar';
import { localizedName } from '@maher/i18n';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { CostFilterSheet } from './components/CostFilterSheet';
import { CostPressableRow } from './components/CostPressableRow';
import { ReportsDeskHeader } from './components/ReportsDeskHeader';
import { ReportsFilterBar } from './components/ReportsFilterBar';
import { formatCostMoney, formatCostPercent, coverageLabelKey } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { formatDate } from '@/i18n/format';
import { useCostFilterChrome } from './useCostFilterChrome';
import { useReportsDeskFilters } from './reportsDeskFilters';
import { useReportsPeriod } from './reportsPeriod';
import { orderDossierHref } from './reportsDeskHrefs';
import { useCostOrdersQuery } from './query';
import type { CostOrderRow } from '@/api/modules/reports';

export function ReportsOrdersScreen({
  selectedOrderId: _selectedOrderId,
  onSelectOrder,
}: {
  selectedOrderId?: string;
  onSelectOrder?: (id: string) => void;
} = {}) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis, setDateBasis } = useReportsPeriod();
  const chrome = useCostFilterChrome('orders');
  const scrollPad = useCostFloorScrollPad();
  const { search, setSearch } = useReportsDeskFilters('orders');
  const debounced = useDebouncedValue(search, 300);
  const params = useLocalSearchParams<{
    marginHealth?: string;
    coverage?: string;
    hasReturn?: string;
    dateBasis?: string;
  }>();

  useEffect(() => {
    const patch: Partial<typeof chrome.filter> = {};
    if (params.marginHealth) patch.marginHealth = params.marginHealth;
    if (params.coverage) patch.coverage = params.coverage;
    if (params.hasReturn) patch.hasReturn = params.hasReturn;
    if (Object.keys(patch).length) chrome.setFilter({ ...chrome.filter, ...patch });
    if (params.dateBasis === 'delivered' || params.dateBasis === 'activity' || params.dateBasis === 'orderDate') {
      setDateBasis(params.dateBasis);
    }
  }, [params.marginHealth, params.coverage, params.hasReturn, params.dateBasis]);

  const query = useCostOrdersQuery(range, chrome.filter, true, { q: debounced || undefined }, dateBasis);
  const rows = query.data?.data ?? [];

  const chips = [
    chrome.filter.customerId ? { key: 'customerId' as const, label: chrome.dealerLabel } : null,
    chrome.filter.productId ? { key: 'productId' as const, label: chrome.productLabel } : null,
    chrome.filter.status
      ? { key: 'status' as const, label: t(`mobile.reports.status.${chrome.filter.status}`) }
      : null,
    chrome.filter.complexity
      ? { key: 'complexity' as const, label: t(`mobile.reports.complexity.${chrome.filter.complexity}`) }
      : null,
    chrome.filter.coverage
      ? { key: 'coverage' as const, label: t(`mobile.reports.coverage.${chrome.filter.coverage}`) }
      : null,
    chrome.filter.marginHealth
      ? { key: 'marginHealth' as const, label: t(`mobile.reports.marginHealth.${chrome.filter.marginHealth}`) }
      : null,
    chrome.filter.hasReturn
      ? {
          key: 'hasReturn' as const,
          label: chrome.filter.hasReturn === 'true' ? t('mobile.reports.hasReturn') : t('mobile.reports.noReturn'),
        }
      : null,
    chrome.filter.hasRework
      ? {
          key: 'hasRework' as const,
          label: chrome.filter.hasRework === 'true' ? t('mobile.reports.hasRework') : t('mobile.reports.noRework'),
        }
      : null,
    chrome.filter.delivered
      ? { key: 'delivered' as const, label: t(`mobile.reports.delivered.${chrome.filter.delivered}`) }
      : null,
    chrome.filter.sort
      ? { key: 'sort' as const, label: t(`mobile.reports.sort.${chrome.filter.sort}`) }
      : null,
  ].filter(Boolean) as Array<{
    key:
      | 'customerId'
      | 'productId'
      | 'status'
      | 'complexity'
      | 'coverage'
      | 'marginHealth'
      | 'hasReturn'
      | 'hasRework'
      | 'delivered'
      | 'sort';
    label: string;
  }>;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(query.isFetching && !query.isLoading)}
            onRefresh={() => void query.refetch()}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <ReportsDeskHeader desk="orders">
              <OrdersSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.reports.searchOrders')}
              />
              <ReportsFilterBar
                filter={chrome.filter}
                chips={chips}
                onOpen={chrome.openFilters}
                onClear={chrome.reset}
                onRemove={(key) => chrome.setFilter({ ...chrome.filter, [key]: null })}
              />
            </ReportsDeskHeader>
            {query.isError ? (
              <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
            ) : null}
            {query.isLoading && !query.data ? (
              <DealerBoard title={t('mobile.reports.tabs.orders')} titleWeight={titleWeight}>
                <ActivityIndicator color={colors.brand} />
              </DealerBoard>
            ) : null}
            {!query.isLoading && !rows.length ? (
              <DealerBoard title={t('mobile.reports.tabs.orders')} titleWeight={titleWeight}>
                <DealerEmptyPanel nested compact text={t('mobile.reports.noCompletedOrders')} />
              </DealerBoard>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <OrderCostCard
              row={item}
              onPress={() => {
                if (onSelectOrder) {
                  onSelectOrder(item.id);
                  return;
                }
                router.push(orderDossierHref(item.id, { from: range.from, to: range.to, dateBasis }));
              }}
            />
          </ListItemEnter>
        )}
      />
      <CostFilterSheet
        open={chrome.filterOpen}
        desk="orders"
        onClose={() => chrome.setFilterOpen(false)}
        value={chrome.draft}
        onChange={chrome.setDraft}
        onApply={chrome.apply}
        onReset={chrome.reset}
        dealers={chrome.dealerOptions}
        products={chrome.productOptions}
      />
    </AppScreen>
  );
}

function OrderCostCard({ row, onPress }: { row: CostOrderRow; onPress: () => void }) {
  const { t, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealer = row.dealer ? localizedName(locale, row.dealer, '') : '';
  const dateLabel = row.orderDate ? formatDate(locale, row.orderDate) : '';
  return (
    <DealerBoard title={row.number} titleWeight={titleWeight}>
      <CostPressableRow
        testID={`cost-order-${row.id}`}
        accessibilityLabel={row.number}
        onPress={onPress}
      >
        <View style={{ gap: 4 }}>
          {dealer ? <AppText variant="caption">{dealer}</AppText> : null}
          {dateLabel ? (
            <AppText variant="caption" color="muted" dir="ltr">
              {dateLabel}
            </AppText>
          ) : null}
          <AppText variant="caption" color="muted">
            {row.productSummary || row.status}
          </AppText>
          <AppText dir="ltr" weight={titleWeight}>
            {t('mobile.reports.actualProduction')}: {formatCostMoney(locale, row.actualCost)}
          </AppText>
          <AppText dir="ltr" variant="caption" color="muted">
            {t('accounting.saleValue')}: {formatCostMoney(locale, row.saleValue)}
          </AppText>
          <AppText dir="ltr" variant="caption">
            {t('accounting.grossMargin')}:{' '}
            {row.marginIncomplete
              ? t('mobile.reports.marginIncomplete')
              : `${formatCostMoney(locale, row.grossMargin)} · ${formatCostPercent(locale, row.marginPct)}`}
          </AppText>
          <AppText variant="caption" color="muted">
            {t(coverageLabelKey(row.coverage, row.marginIncomplete))}
            {row.workerEffortMinutes ? ` · ${(row.workerEffortMinutes / 60).toFixed(1)} h` : ''}
          </AppText>
        </View>
      </CostPressableRow>
    </DealerBoard>
  );
}
