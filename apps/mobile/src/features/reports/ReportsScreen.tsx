import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { localizedName } from '@maher/i18n';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { DealerPickerSheet } from '@/features/dealers/components/DealerPickerSheet';
import { useDealersListQuery } from '@/features/dealers/query';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { CostFilterSheet } from './components/CostFilterSheet';
import { CostPressableRow } from './components/CostPressableRow';
import { ReportsMetricGrid } from './components/ReportsMetricGrid';
import { ReportsMoneyRows } from './components/ReportsMoneyRows';
import { ReportsPeriodChrome } from './components/ReportsPeriodChrome';
import { ReportsStatusRows } from './components/ReportsStatusRows';
import { ReportsTabBar } from './components/ReportsTabBar';
import { EMPTY_COST_FILTER, costFilterActive, type CostFilterState } from './costFilters';
import {
  useCostCoverageQuery,
  useCostOrdersQuery,
  useCostProductsQuery,
  useCostReturnsQuery,
  useCoverageBackfillMutation,
  useDashboardReportQuery,
  useFinancialReportQuery,
  useLaborRatesQuery,
  useLaborActualsQuery,
  useProductionReportQuery,
  useSalesReportQuery,
} from './query';
import {
  reportsPeriodRange,
  selectDashboardSnapshot,
  selectMoneyDesk,
  selectStatusRows,
  type ReportsCategory,
  type ReportsPeriod,
} from './selectReports';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

const COST_TABS: ReportsCategory[] = ['money', 'orders', 'products', 'returns', 'coverage'];

const TAB_KEY: Record<ReportsCategory, string> = {
  money: 'mobile.reports.tabs.money',
  orders: 'mobile.reports.tabs.orders',
  products: 'mobile.reports.tabs.products',
  returns: 'mobile.reports.tabs.returns',
  coverage: 'mobile.reports.tabs.coverage',
  dashboard: 'mobile.reports.tabs.dashboard',
  sales: 'mobile.reports.tabs.sales',
  production: 'mobile.reports.tabs.production',
  financial: 'mobile.reports.tabs.financial',
};

function ReportsTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
  const { t, isRTL, locale } = useLocale();
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
          {t('accounting.reportsTitle')}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color="muted"
        align="center"
        style={{
          paddingHorizontal: theme.spacing.lg,
          letterSpacing: locale === 'ar' ? 0 : 0.2,
        }}
      >
        {t('accounting.reportsSubtitle')}
      </AppText>
    </View>
  );
}

export function ReportsScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const canCost = can(user, 'inventory.cost.read');
  const canSales = can(user, 'report.sales.read');
  const canProduction = can(user, 'report.production.read');
  const canFinancial = can(user, 'report.financial.read');

  const categories = useMemo(() => {
    if (canCost) return COST_TABS;
    const fallback: ReportsCategory[] = [];
    if (canSales) fallback.push('dashboard', 'sales');
    if (canProduction) fallback.push('production');
    if (canFinancial) fallback.push('financial');
    return fallback;
  }, [canCost, canSales, canProduction, canFinancial]);

  const [period, setPeriod] = useState<ReportsPeriod>('month');
  const [category, setCategory] = useState<ReportsCategory>(() => categories[0] ?? 'money');
  const [filter, setFilter] = useState<CostFilterState>(EMPTY_COST_FILTER);
  const [draftFilter, setDraftFilter] = useState<CostFilterState>(EMPTY_COST_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dealerName, setDealerName] = useState<string | null>(null);

  const range = useMemo(() => reportsPeriodRange(period), [period]);
  const activeCategory = categories.includes(category) ? category : categories[0] ?? 'money';
  const dealersQuery = useDealersListQuery({ page: 1, pageSize: 80 });

  const costOrdersQuery = useCostOrdersQuery(range, filter, canCost);
  const costProductsQuery = useCostProductsQuery(
    range,
    filter,
    canCost && activeCategory === 'products',
  );
  const costReturnsQuery = useCostReturnsQuery(
    range,
    filter,
    canCost && activeCategory === 'returns',
  );
  const coverageQuery = useCostCoverageQuery(canCost && activeCategory === 'coverage');
  const dashboardQuery = useDashboardReportQuery(
    canSales && (activeCategory === 'money' || activeCategory === 'dashboard'),
  );
  const salesQuery = useSalesReportQuery(
    range,
    filter,
    canSales && (activeCategory === 'money' || activeCategory === 'sales'),
  );
  const productionQuery = useProductionReportQuery(
    range,
    canProduction && (activeCategory === 'money' || activeCategory === 'production'),
  );
  const financialQuery = useFinancialReportQuery(canFinancial && activeCategory === 'financial');
  const laborRatesQuery = useLaborRatesQuery(canCost && activeCategory === 'money');
  const laborActualsQuery = useLaborActualsQuery(range, canCost && activeCategory === 'money');
  const backfill = useCoverageBackfillMutation();

  const money = selectMoneyDesk(costOrdersQuery.data?.data);
  const snapshot = useMemo(
    () => selectDashboardSnapshot(locale, dashboardQuery.data),
    [dashboardQuery.data, locale],
  );
  const salesRows = useMemo(
    () => selectStatusRows(salesQuery.data?.ordersByStatus),
    [salesQuery.data],
  );
  const dealerOptions = useMemo(
    () =>
      (dealersQuery.data?.data ?? []).map((row) => ({
        id: row.id,
        name: localizedName(locale, row, row.name || row.code),
        code: row.code,
      })),
    [dealersQuery.data, locale],
  );
  const productLabel = useMemo(() => {
    if (!filter.productId) return null;
    const fromProducts = (
      costProductsQuery.data?.data ??
      costProductsQuery.data?.products ??
      []
    ).find((row) => row.productId === filter.productId);
    const fromSales = salesQuery.data?.topProducts?.find((row) => row.productId === filter.productId);
    return (
      fromProducts?.product?.nameEn ||
      fromProducts?.product?.sku ||
      fromSales?.name ||
      fromSales?.sku ||
      t('accounting.filterProduct')
    );
  }, [costProductsQuery.data, filter.productId, salesQuery.data, t]);

  const fmt = (value: number | null | undefined) =>
    value == null ? '—' : formatCurrency(locale, value);

  const loading = costOrdersQuery.isLoading && !costOrdersQuery.data && activeCategory !== 'coverage';

  if (categories.length === 0) {
    return (
      <AppScreen>
        <ReportsTitle titleWeight={titleWeight} />
        <DealerEmptyPanel text={t('mobile.noReportsAccess')} icon="lock-closed-outline" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ReportsTitle titleWeight={titleWeight} />

      <ReportsTabBar
        tabs={categories.map((key) => ({ key, label: t(TAB_KEY[key]) }))}
        value={activeCategory}
        onChange={setCategory}
      />

      <ReportsPeriodChrome period={period} from={range.from} to={range.to} onChange={setPeriod} />

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.reports.filterTitle')}
        onPress={() => {
          void haptics.selection();
          setDraftFilter(filter);
          setFilterOpen(true);
        }}
        style={{
          minHeight: 48,
          borderRadius: theme.radius.xl,
          borderWidth: 1.5,
          borderColor: costFilterActive(filter) ? colors.brand : colors.borderStrong,
          backgroundColor: costFilterActive(filter) ? colors.brandSoft : colors.surface,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
        }}
      >
        <AppText weight={titleWeight}>
          {costFilterActive(filter) ? t('mobile.reports.filterActive') : t('mobile.reports.filterTitle')}
        </AppText>
      </AnimatedPressable>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(costOrdersQuery.isFetching && !costOrdersQuery.isLoading)}
            onRefresh={() => {
              void costOrdersQuery.refetch();
              void dashboardQuery.refetch();
              void salesQuery.refetch();
              void laborRatesQuery.refetch();
              void laborActualsQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: SURFACE_TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
      >
        {costOrdersQuery.isError && activeCategory !== 'coverage' ? (
          <ErrorState title={t('common.loadFailed')} onRetry={() => void costOrdersQuery.refetch()} />
        ) : null}

        {loading ? (
          <DealerBoard title={t(TAB_KEY[activeCategory])} titleWeight={titleWeight}>
            <ActivityIndicator color={colors.brand} />
          </DealerBoard>
        ) : null}

        {activeCategory === 'money' ? (
          <>
            <ListItemEnter index={0}>
              <DealerBoard title={t('mobile.reports.moneyDesk')} titleWeight={titleWeight}>
                <View style={{ gap: theme.spacing.sm }}>
                  {(
                    [
                      { key: 'revenue', label: t('accounting.saleValue'), value: fmt(money.revenue), go: 'orders' },
                      { key: 'material', label: t('accounting.actualCost'), value: fmt(money.material), go: 'orders' },
                      { key: 'labor', label: t('accounting.laborCost'), value: money.labor == null ? t('mobile.reports.notConfigured') : fmt(money.labor), go: 'money' },
                      { key: 'margin', label: t('accounting.grossMargin'), value: fmt(money.margin), go: 'orders' },
                    ] as const
                  ).map((tile) => (
                    <CostPressableRow
                      key={tile.key}
                      testID={`cost-tile-${tile.key}`}
                      accessibilityLabel={tile.label}
                      onPress={() => setCategory(tile.go)}
                    >
                      <AppText variant="caption" color="muted">
                        {tile.label}
                      </AppText>
                      <AppText weight={titleWeight} dir="ltr">
                        {tile.value}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={1}>
              <DealerBoard title={t('mobile.reports.laborByWorker')} titleWeight={titleWeight}>
                {(laborActualsQuery.data?.byWorker ?? []).length ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {(laborActualsQuery.data?.byWorker ?? []).map((row) => (
                      <CostPressableRow
                        key={row.userId}
                        testID={`cost-labor-worker-${row.userId}`}
                        accessibilityLabel={row.name}
                        onPress={() => router.push('/(app)/(admin)/users' as Href)}
                      >
                        <AppText weight={titleWeight}>{row.name}</AppText>
                        <AppText variant="caption" dir="ltr">
                          {row.actual == null
                            ? t('mobile.reports.notConfigured')
                            : formatCurrency(locale, row.actual)}
                          {row.minutes ? ` · ${(row.minutes / 60).toFixed(1)} h` : ''}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                ) : (
                  <DealerEmptyPanel nested compact text={t('mobile.reports.noLaborActuals')} />
                )}
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={2}>
              <DealerBoard title={t('mobile.reports.laborRates')} titleWeight={titleWeight}>
                {(laborRatesQuery.data ?? []).filter((row) => row.userId && !row.effectiveTo).length ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {(laborRatesQuery.data ?? [])
                      .filter((row) => row.userId && !row.effectiveTo)
                      .map((row) => {
                        const name = row.user
                          ? `${row.user.firstName} ${row.user.lastName}`.trim()
                          : row.userId;
                        const label = name?.trim() || row.id;
                        return (
                          <CostPressableRow
                            key={row.id}
                            testID={`cost-labor-rate-${row.id}`}
                            accessibilityLabel={label}
                            onPress={() => router.push('/(app)/(admin)/users' as Href)}
                          >
                            <AppText weight={titleWeight}>{name}</AppText>
                            <AppText variant="caption" dir="ltr">
                              {formatCurrency(locale, Number(row.hourlyRate))}
                            </AppText>
                          </CostPressableRow>
                        );
                      })}
                  </View>
                ) : (
                  <DealerEmptyPanel nested compact text={t('mobile.reports.noWorkerRates')} />
                )}
              </DealerBoard>
            </ListItemEnter>
            {dashboardQuery.data ? (
              <ListItemEnter index={2}>
                <DealerBoard title={t('accounting.reportDashboard')} titleWeight={titleWeight}>
                  <ReportsMetricGrid metrics={snapshot} />
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {salesQuery.data ? (
              <ListItemEnter index={3}>
                <DealerBoard title={t('accounting.topCustomers')} titleWeight={titleWeight}>
                  {(salesQuery.data.topCustomers ?? []).length ? (
                    <View style={{ gap: theme.spacing.sm }}>
                      {(salesQuery.data.topCustomers ?? []).map((row) => (
                        <CostPressableRow
                          key={row.customerId}
                          accessibilityLabel={row.customerName}
                          onPress={() => {
                            setFilter((prev) => ({ ...prev, customerId: row.customerId }));
                            setCategory('orders');
                          }}
                        >
                          <AppText weight={titleWeight}>{row.customerName}</AppText>
                          <AppText variant="caption" dir="ltr">
                            {formatCurrency(locale, row.total)} · {row.orderCount}
                          </AppText>
                        </CostPressableRow>
                      ))}
                    </View>
                  ) : (
                    <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                  )}
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {salesQuery.data?.topProducts?.length ? (
              <ListItemEnter index={4}>
                <DealerBoard title={t('accounting.topProducts')} titleWeight={titleWeight}>
                  <View style={{ gap: theme.spacing.sm }}>
                    {salesQuery.data.topProducts.map((row) => (
                      <CostPressableRow
                        key={row.productId ?? row.sku ?? row.name ?? 'p'}
                        accessibilityLabel={row.name ?? row.sku ?? t('accounting.topProducts')}
                        onPress={() => {
                          if (row.productId) {
                            setFilter((prev) => ({ ...prev, productId: row.productId }));
                          }
                          setCategory('products');
                        }}
                      >
                        <AppText weight={titleWeight}>{row.name ?? row.sku ?? '—'}</AppText>
                        <AppText variant="caption" dir="ltr">
                          {formatCurrency(locale, row.total)}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {salesRows.length ? (
              <ListItemEnter index={5}>
                <DealerBoard title={t('accounting.ordersByStatus')} titleWeight={titleWeight}>
                  <ReportsStatusRows
                    rows={salesRows}
                    onPressStatus={(status) => {
                      setFilter((prev) => ({ ...prev, status }));
                      setCategory('orders');
                    }}
                  />
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {salesQuery.data?.bySalesRep?.length ? (
              <ListItemEnter index={6}>
                <DealerBoard title={t('accounting.bySalesRep')} titleWeight={titleWeight}>
                  <View style={{ gap: theme.spacing.sm }}>
                    {salesQuery.data.bySalesRep.map((row) => (
                      <CostPressableRow
                        key={row.salesRepId ?? row.name}
                        accessibilityLabel={row.name}
                        onPress={() => setCategory('orders')}
                      >
                        <AppText weight={titleWeight}>{row.name}</AppText>
                        <AppText variant="caption" dir="ltr">
                          {formatNumber(locale, row.count, { maximumFractionDigits: 0 })}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                </DealerBoard>
              </ListItemEnter>
            ) : null}
            {salesQuery.data?.recentQuotes?.length ? (
              <ListItemEnter index={7}>
                <DealerBoard title={t('accounting.recentQuotes')} titleWeight={titleWeight}>
                  <View style={{ gap: theme.spacing.sm }}>
                    {salesQuery.data.recentQuotes.map((row) => (
                      <CostPressableRow
                        key={row.id}
                        accessibilityLabel={row.number}
                        onPress={() => router.push(`/(app)/(admin)/quotations/${row.id}` as Href)}
                      >
                        <AppText weight={titleWeight}>{row.number}</AppText>
                        <AppText variant="caption">
                          {row.customerName ?? row.status}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                </DealerBoard>
              </ListItemEnter>
            ) : null}
          </>
        ) : null}

        {activeCategory === 'orders' ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t('accounting.lensOrders')} titleWeight={titleWeight}>
              {(costOrdersQuery.data?.data ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(costOrdersQuery.data?.data ?? []).map((row) => (
                    <CostPressableRow
                      key={row.id}
                      testID={`cost-order-${row.id}`}
                      accessibilityLabel={row.number}
                      onPress={() => router.push(`/(app)/(admin)/reports/order/${row.id}` as Href)}
                    >
                      <AppText weight={titleWeight}>{row.number}</AppText>
                      <AppText variant="caption" color="muted">
                        {row.productSummary || row.status}
                      </AppText>
                      <AppText variant="caption" dir="ltr">
                        {fmt(row.saleValue)} · {fmt(row.actualCost)} · {fmt(row.variance)}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'products' ? (
          <>
            <ListItemEnter index={0}>
              <DealerBoard title={t('mobile.reports.tabs.products')} titleWeight={titleWeight}>
                {(costProductsQuery.data?.data ?? costProductsQuery.data?.products ?? []).length ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {(costProductsQuery.data?.data ?? costProductsQuery.data?.products ?? []).map((row) => (
                      <CostPressableRow
                        key={row.productId}
                        accessibilityLabel={row.product?.sku ?? row.productId}
                        onPress={() => {
                          setFilter((prev) => ({ ...prev, productId: row.productId }));
                          setCategory('orders');
                        }}
                      >
                        <AppText weight={titleWeight}>
                          {row.product?.nameEn || row.product?.sku || row.productId}
                        </AppText>
                        <AppText variant="caption" dir="ltr">
                          {fmt(row.averageActualCost)} · {formatNumber(locale, row.orderCount, { maximumFractionDigits: 0 })}
                        </AppText>
                        <AppText variant="caption" color="muted" dir="ltr">
                          {fmt(row.lowestActualCost)} – {fmt(row.highestActualCost)}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                ) : (
                  <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                )}
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={1}>
              <DealerBoard title={t('mobile.reports.variantSlot')} titleWeight={titleWeight}>
                {(costProductsQuery.data?.variants ?? []).length ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {(costProductsQuery.data?.variants ?? []).map((row) => (
                      <CostPressableRow
                        key={row.variantId}
                        testID={`cost-variant-${row.variantId}`}
                        accessibilityLabel={row.variant?.sku ?? row.variantId}
                        onPress={() => {
                          setFilter((prev) => ({
                            ...prev,
                            productId: row.variant?.productId ?? prev.productId,
                            variantId: row.variantId,
                          }));
                          setCategory('orders');
                        }}
                      >
                        <AppText weight={titleWeight}>
                          {row.variant?.nameEn || row.variant?.sku || row.variantId}
                        </AppText>
                        <AppText variant="caption" dir="ltr">
                          {fmt(row.averageActualCost)} · {formatNumber(locale, row.orderCount, { maximumFractionDigits: 0 })}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                ) : (
                  <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                )}
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={2}>
              <DealerBoard title={t('mobile.reports.optionSlot')} titleWeight={titleWeight}>
                {(costProductsQuery.data?.byOption ?? []).length ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    {(costProductsQuery.data?.byOption ?? []).map((row) => (
                      <CostPressableRow
                        key={row.optionValueId}
                        testID={`cost-option-${row.optionValueId}`}
                        accessibilityLabel={row.optionName ?? row.optionCode ?? row.optionValueId}
                        onPress={() => {
                          setFilter((prev) => ({ ...prev, optionValueId: row.optionValueId }));
                          setCategory('orders');
                        }}
                      >
                        <AppText weight={titleWeight}>
                          {[row.groupName, row.optionName || row.optionCode].filter(Boolean).join(' · ')}
                        </AppText>
                        <AppText variant="caption" dir="ltr">
                          {fmt(row.averageActualCost)} · {formatNumber(locale, row.orderCount, { maximumFractionDigits: 0 })}
                        </AppText>
                      </CostPressableRow>
                    ))}
                  </View>
                ) : (
                  <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                )}
              </DealerBoard>
            </ListItemEnter>
          </>
        ) : null}

        {activeCategory === 'returns' ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t('accounting.lensReturns')} titleWeight={titleWeight}>
              {(costReturnsQuery.data?.data ?? []).length ? (
                <View style={{ gap: theme.spacing.sm }}>
                  {(costReturnsQuery.data?.data ?? []).map((row) => (
                    <CostPressableRow
                      key={row.id}
                      accessibilityLabel={row.number}
                      onPress={() => router.push(`/(app)/(admin)/reports/returns/${row.id}` as Href)}
                    >
                      <AppText weight={titleWeight}>{row.number}</AppText>
                      <AppText variant="caption" color="muted">
                        {row.salesOrder?.number ?? row.lifecycleState ?? ''}
                      </AppText>
                    </CostPressableRow>
                  ))}
                </View>
              ) : (
                <DealerEmptyPanel nested compact text={t('accounting.noData')} />
              )}
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'coverage' ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t('mobile.reports.tabs.coverage')} titleWeight={titleWeight}>
              <View style={{ gap: theme.spacing.md }}>
                {(coverageQuery.data?.unpriced ?? []).map((item) => (
                  <CostPressableRow
                    key={item.id}
                    accessibilityLabel={item.sku}
                    onPress={() => router.push(`/(app)/(admin)/inventory/items/${item.id}` as Href)}
                  >
                    <AppText weight={titleWeight} dir="ltr">
                      {item.sku}
                    </AppText>
                    <AppText variant="caption">{item.nameEn ?? item.category ?? ''}</AppText>
                  </CostPressableRow>
                ))}
                {!(coverageQuery.data?.unpriced ?? []).length ? (
                  <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                ) : null}
                <PrimaryButton
                  label={t('mobile.reports.backfill')}
                  loading={backfill.isPending}
                  onPress={() => void backfill.mutateAsync()}
                />
              </View>
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'dashboard' && dashboardQuery.data ? (
          <DealerBoard title={t('accounting.reportDashboard')} titleWeight={titleWeight}>
            <ReportsMetricGrid metrics={snapshot} />
          </DealerBoard>
        ) : null}

        {activeCategory === 'sales' && salesQuery.data ? (
          <DealerBoard title={t('accounting.reportSales')} titleWeight={titleWeight}>
            <ReportsStatusRows rows={salesRows} />
          </DealerBoard>
        ) : null}

        {activeCategory === 'production' && productionQuery.data ? (
          <DealerBoard title={t('accounting.ordersByStatus')} titleWeight={titleWeight}>
            <ReportsStatusRows rows={selectStatusRows(productionQuery.data.ordersByStatus)} />
          </DealerBoard>
        ) : null}

        {activeCategory === 'financial' && financialQuery.data?.aging ? (
          <DealerBoard title={t('accounting.arAging')} titleWeight={titleWeight}>
            <ReportsMoneyRows
              rows={[
                { key: 'current', label: t('accounting.agingCurrent'), value: formatCurrency(locale, financialQuery.data.aging.current) },
              ]}
            />
          </DealerBoard>
        ) : null}
      </ScrollView>

      <CostFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={draftFilter}
        onChange={setDraftFilter}
        onApply={() => setFilter(draftFilter)}
        onReset={() => {
          setDraftFilter(EMPTY_COST_FILTER);
          setFilter(EMPTY_COST_FILTER);
          setDealerName(null);
        }}
        onPickDealer={() => {
          setFilterOpen(false);
          setDealerOpen(true);
        }}
        dealerLabel={
          dealerName ||
          dealerOptions.find((d) => d.id === draftFilter.customerId)?.name ||
          t('accounting.allCustomers')
        }
        productLabel={
          draftFilter.productId
            ? productLabel ?? t('accounting.filterProduct')
            : null
        }
      />
      <DealerPickerSheet
        open={dealerOpen}
        onClose={() => setDealerOpen(false)}
        title={t('accounting.dealersTitle')}
        searchPlaceholder={t('accounting.searchDealers')}
        emptyLabel={t('accounting.noDealersMatch')}
        allLabel={t('accounting.allCustomers')}
        dealers={dealerOptions}
        selectedId={draftFilter.customerId}
        mode="confirm"
        confirmLabel={t('accounting.confirmDealer')}
        onSelect={(dealer) => {
          setDraftFilter((prev) => ({ ...prev, customerId: dealer?.id ?? null }));
          setDealerName(dealer?.name ?? null);
          setDealerOpen(false);
          setFilterOpen(true);
        }}
      />
    </AppScreen>
  );
}
