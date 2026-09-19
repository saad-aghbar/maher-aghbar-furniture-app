import { useRouter } from 'expo-router';
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
import { formatCostMoney } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useCostFilterChrome } from './useCostFilterChrome';
import { useReportsDeskFilters } from './reportsDeskFilters';
import { useReportsPeriod } from './reportsPeriod';
import { returnDossierHref } from './reportsDeskHrefs';
import { useCostReturnsQuery } from './query';
import type { CostReturnRow } from '@/api/modules/reports';

export function ReportsReturnsScreen({
  selectedReturnId: _selectedReturnId,
  onSelectReturn,
}: {
  selectedReturnId?: string;
  onSelectReturn?: (id: string) => void;
} = {}) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const chrome = useCostFilterChrome('returns');
  const scrollPad = useCostFloorScrollPad();
  const { search, setSearch } = useReportsDeskFilters('returns');
  const debounced = useDebouncedValue(search, 300);
  const query = useCostReturnsQuery(range, chrome.filter, true, { q: debounced || undefined });
  const rows = query.data?.data ?? [];

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
            <ReportsDeskHeader desk="returns">
              <OrdersSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.reports.searchReturns')}
              />
              <ReportsFilterBar
                filter={chrome.filter}
                chips={
                  [
                    chrome.filter.customerId
                      ? { key: 'customerId' as const, label: chrome.dealerLabel }
                      : null,
                    chrome.filter.productId
                      ? { key: 'productId' as const, label: chrome.productLabel }
                      : null,
                    chrome.filter.status
                      ? {
                          key: 'status' as const,
                          label: t(`mobile.reports.returnStatus.${chrome.filter.status}`),
                        }
                      : null,
                    chrome.filter.sort
                      ? { key: 'sort' as const, label: t(`mobile.reports.sort.${chrome.filter.sort}`) }
                      : null,
                  ].filter(Boolean) as Array<{
                    key: 'customerId' | 'productId' | 'status' | 'sort';
                    label: string;
                  }>
                }
                onOpen={chrome.openFilters}
                onClear={chrome.reset}
                onRemove={(key) => chrome.setFilter({ ...chrome.filter, [key]: null })}
              />
            </ReportsDeskHeader>
            {query.isError ? (
              <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <DealerBoard title={t('accounting.lensReturns')} titleWeight={titleWeight}>
              <ActivityIndicator color={colors.brand} />
            </DealerBoard>
          ) : (
            <DealerEmptyPanel text={t('accounting.noData')} />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <ReturnCaseCard
              row={item}
              onPress={() => {
                if (onSelectReturn) {
                  onSelectReturn(item.id);
                  return;
                }
                router.push(returnDossierHref(item.id, { from: range.from, to: range.to, dateBasis }));
              }}
            />
          </ListItemEnter>
        )}
      />
      <CostFilterSheet
        open={chrome.filterOpen}
        desk="returns"
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

function ReturnCaseCard({ row, onPress }: { row: CostReturnRow; onPress: () => void }) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dealer = row.dealer ? localizedName(locale, row.dealer, '') : '';
  return (
    <DealerBoard title={row.number} titleWeight={titleWeight}>
      <CostPressableRow accessibilityLabel={row.number} testID={`cost-return-${row.id}`} onPress={onPress}>
        <View style={{ gap: 4 }}>
          <AppText variant="caption">{row.salesOrder?.number ?? ''}</AppText>
          {dealer ? <AppText variant="caption">{dealer}</AppText> : null}
          <AppText variant="caption">
            {t('mobile.reports.pieces')}: {row.pieceCount ?? 0}
          </AppText>
          <AppText variant="caption" dir="ltr">
            {t('accounting.originalProduction')}: {formatCostMoney(locale, row.originalProductionCost)}
          </AppText>
          <AppText variant="caption" dir="ltr">
            {t('mobile.reports.afterSale')}: {formatCostMoney(locale, row.returnGrossCost)}
          </AppText>
          <AppText variant="caption" dir="ltr">
            {t('accounting.lifetimeCost')}: {formatCostMoney(locale, row.lifetimeFactoryCost)}
          </AppText>
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.successSoft,
              borderWidth: 1,
              borderColor: colors.border,
              padding: theme.spacing.sm,
              gap: 2,
            }}
          >
            <AppText variant="caption" dir="ltr">
              {t('mobile.reports.recoveredValue')}: {formatCostMoney(locale, row.recoveredValue)}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('mobile.reports.recoveredNotNetted')}
            </AppText>
          </View>
        </View>
      </CostPressableRow>
    </DealerBoard>
  );
}
