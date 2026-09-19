import type { Href } from 'expo-router';
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
import { formatCostMoney, formatCostPercent } from './costFormat';
import { useCostFloorScrollPad } from './costFloorScroll';
import { useCostFilterChrome } from './useCostFilterChrome';
import { useReportsDeskFilters } from './reportsDeskFilters';
import { useReportsPeriod } from './reportsPeriod';
import { productProfileHref, variantProfileHref } from './reportsDeskHrefs';
import { useCostCustomWorkQuery, useCostProductsQuery } from './query';
import type { CostProductRow, CostVariantRow } from '@/api/modules/reports';

export function ReportsProductsScreen({
  selectedKey: _selectedKey,
  onSelectProduct,
  onSelectVariant,
  onSelectCustom,
}: {
  selectedKey?: string;
  onSelectProduct?: (id: string) => void;
  onSelectVariant?: (productId: string, variantId: string) => void;
  onSelectCustom?: () => void;
} = {}) {
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { range, dateBasis } = useReportsPeriod();
  const chrome = useCostFilterChrome('products');
  const scrollPad = useCostFloorScrollPad();
  const { search, setSearch } = useReportsDeskFilters('products');
  const debounced = useDebouncedValue(search, 300);
  const query = useCostProductsQuery(
    range,
    chrome.filter,
    true,
    { q: debounced || undefined },
    dateBasis,
  );
  const customQuery = useCostCustomWorkQuery(range, dateBasis, true);
  const products = query.data?.data ?? query.data?.products ?? [];
  const variants = query.data?.variants ?? [];

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <FlatList
        style={{ flex: 1 }}
        data={products}
        keyExtractor={(row) => row.productId}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(query.isFetching && !query.isLoading)}
            onRefresh={() => {
              void query.refetch();
              void customQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <ReportsDeskHeader desk="products">
              <OrdersSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.reports.searchProducts')}
              />
              <ReportsFilterBar
                filter={chrome.filter}
                chips={
                  [
                    chrome.filter.productId
                      ? { key: 'productId' as const, label: chrome.productLabel }
                      : null,
                    chrome.filter.complexity
                      ? {
                          key: 'complexity' as const,
                          label: t(`mobile.reports.complexity.${chrome.filter.complexity}`),
                        }
                      : null,
                    chrome.filter.sort
                      ? { key: 'sort' as const, label: t(`mobile.reports.sort.${chrome.filter.sort}`) }
                      : null,
                  ].filter(Boolean) as Array<{ key: 'productId' | 'complexity' | 'sort'; label: string }>
                }
                onOpen={chrome.openFilters}
                onClear={chrome.reset}
                onRemove={(key) => chrome.setFilter({ ...chrome.filter, [key]: null })}
              />
            </ReportsDeskHeader>
            {query.isError ? (
              <ErrorState title={t('common.loadFailed')} onRetry={() => void query.refetch()} />
            ) : null}
            {query.isLoading && !query.data ? (
              <DealerBoard title={t('mobile.reports.tabs.products')} titleWeight={titleWeight}>
                <ActivityIndicator color={colors.brand} />
              </DealerBoard>
            ) : null}
            <DealerBoard title={t('mobile.reports.customWork')} titleWeight={titleWeight}>
              {(customQuery.data?.data ?? []).length ? (
                <CostPressableRow
                  accessibilityLabel={t('mobile.reports.customWork')}
                  onPress={() => {
                    if (onSelectCustom) {
                      onSelectCustom();
                      return;
                    }
                    router.push('/(app)/(admin)/reports/products/custom' as Href);
                  }}
                >
                  <AppText>{t('mobile.reports.customWork')}</AppText>
                  <AppText variant="caption" dir="ltr">
                    {String(customQuery.data?.data.length ?? 0)}
                  </AppText>
                </CostPressableRow>
              ) : (
                <DealerEmptyPanel nested compact text={t('mobile.reports.noCustomWork')} />
              )}
            </DealerBoard>
            {variants.length ? (
              <DealerBoard title={t('mobile.reports.variantSlot')} titleWeight={titleWeight}>
                <View style={{ gap: theme.spacing.sm }}>
                  {variants.map((row) => (
                    <VariantRow
                      key={row.variantId}
                      row={row}
                      onPress={() => {
                        const productId = row.variant?.productId;
                        if (!productId) return;
                        if (onSelectVariant) {
                          onSelectVariant(productId, row.variantId);
                          return;
                        }
                        router.push(
                          variantProfileHref(productId, row.variantId, {
                            from: range.from,
                            to: range.to,
                            dateBasis,
                          }),
                        );
                      }}
                    />
                  ))}
                </View>
              </DealerBoard>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? null : (
            <DealerEmptyPanel text={t('accounting.noData')} />
          )
        }
        renderItem={({ item, index }) => (
          <ListItemEnter index={index}>
            <DealerBoard
              title={localizedName(locale, item.product, item.product?.sku || item.productId)}
              titleWeight={titleWeight}
            >
              <CostPressableRow
                accessibilityLabel={item.product?.sku ?? item.productId}
                onPress={() => {
                  if (onSelectProduct) {
                    onSelectProduct(item.productId);
                    return;
                  }
                  router.push(
                    productProfileHref(item.productId, {
                      from: range.from,
                      to: range.to,
                      dateBasis,
                    }),
                  );
                }}
              >
                <ProductFacts row={item} />
              </CostPressableRow>
            </DealerBoard>
          </ListItemEnter>
        )}
      />
      <CostFilterSheet
        open={chrome.filterOpen}
        desk="products"
        onClose={() => chrome.setFilterOpen(false)}
        value={chrome.draft}
        onChange={chrome.setDraft}
        onApply={chrome.apply}
        onReset={chrome.reset}
        products={chrome.productOptions}
      />
    </AppScreen>
  );
}

function ProductFacts({ row }: { row: CostProductRow }) {
  const { t, locale } = useLocale();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" dir="ltr">
        {t('mobile.reports.avgActual')}: {formatCostMoney(locale, row.averageActualCost)}
      </AppText>
      <AppText variant="caption" dir="ltr">
        {t('mobile.reports.avgSale')}: {formatCostMoney(locale, row.averageSaleValue)}
      </AppText>
      <AppText variant="caption" dir="ltr">
        {t('accounting.grossMargin')}: {formatCostMoney(locale, row.averageMargin)}
      </AppText>
      <AppText variant="caption" color="muted" dir="ltr">
        {row.orderCount} · {row.unitsProduced ?? 0}{' '}
        {row.returnRate != null ? `· ${formatCostPercent(locale, row.returnRate * 100)}` : ''}
      </AppText>
    </View>
  );
}

function VariantRow({ row, onPress }: { row: CostVariantRow; onPress: () => void }) {
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  return (
    <CostPressableRow
      testID={`cost-variant-${row.variantId}`}
      accessibilityLabel={row.variant?.sku ?? row.variantId}
      onPress={onPress}
    >
      <AppText weight={titleWeight}>
        {localizedName(locale, row.variant, row.variant?.sku || row.variantId)}
      </AppText>
      <AppText variant="caption" dir="ltr">
        {formatCostMoney(locale, row.averageActualCost)} · {row.orderCount}
      </AppText>
    </CostPressableRow>
  );
}
