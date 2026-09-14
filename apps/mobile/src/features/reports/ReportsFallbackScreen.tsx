import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { useCostFloorScrollPad } from './costFloorScroll';
import { ReportsMetricGrid } from './components/ReportsMetricGrid';
import { ReportsMoneyRows } from './components/ReportsMoneyRows';
import { ReportsPeriodChrome } from './components/ReportsPeriodChrome';
import { ReportsStatusRows } from './components/ReportsStatusRows';
import { ReportsTabBar } from './components/ReportsTabBar';
import { ReportsRangeSheet } from './components/ReportsRangeSheet';
import { EMPTY_COST_FILTER } from './costFilters';
import {
  useDashboardReportQuery,
  useFinancialReportQuery,
  useProductionReportQuery,
  useSalesReportQuery,
} from './query';
import { useReportsPeriod } from './reportsPeriod';
import {
  selectDashboardSnapshot,
  selectStatusRows,
  type ReportsCategory,
} from './selectReports';
import { formatCurrency } from '@/i18n/format';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

const TAB_KEY: Record<ReportsCategory, string> = {
  money: 'mobile.reports.tabs.money',
  orders: 'mobile.reports.tabs.orders',
  products: 'mobile.reports.tabs.products',
  inventory: 'mobile.reports.tabs.inventory',
  returns: 'mobile.reports.tabs.returns',
  coverage: 'mobile.reports.tabs.coverage',
  dashboard: 'mobile.reports.tabs.dashboard',
  sales: 'mobile.reports.tabs.sales',
  production: 'mobile.reports.tabs.production',
  financial: 'mobile.reports.tabs.financial',
};

export function ReportsFallbackScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const scrollPad = useCostFloorScrollPad();
  const canSales = can(user, 'report.sales.read');
  const canProduction = can(user, 'report.production.read');
  const canFinancial = can(user, 'report.financial.read');
  const categories = useMemo(() => {
    const fallback: ReportsCategory[] = [];
    if (canSales) fallback.push('dashboard', 'sales');
    if (canProduction) fallback.push('production');
    if (canFinancial) fallback.push('financial');
    return fallback;
  }, [canSales, canProduction, canFinancial]);
  const [category, setCategory] = useState<ReportsCategory>(() => categories[0] ?? 'dashboard');
  const { period, range, dateBasis, setPeriod, setCustomRange, setDateBasis } = useReportsPeriod();
  const [rangeOpen, setRangeOpen] = useState(false);
  const active = categories.includes(category) ? category : categories[0] ?? 'dashboard';
  const dashboardQuery = useDashboardReportQuery(canSales && (active === 'dashboard' || active === 'money'));
  const salesQuery = useSalesReportQuery(range, EMPTY_COST_FILTER, canSales && active === 'sales');
  const productionQuery = useProductionReportQuery(range, canProduction && active === 'production');
  const financialQuery = useFinancialReportQuery(canFinancial && active === 'financial');
  const snapshot = useMemo(
    () => selectDashboardSnapshot(locale, dashboardQuery.data),
    [dashboardQuery.data, locale],
  );
  const leadSize = theme.sizes.touch.min;

  if (!categories.length) {
    return (
      <AppScreen>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {t('accounting.reportsTitle')}
        </AppText>
        <DealerEmptyPanel text={t('mobile.noReportsAccess')} icon="lock-closed-outline" />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={false}
            onRefresh={() => {
              void dashboardQuery.refetch();
              void salesQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: scrollPad, flexGrow: 1 }}
      >
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
            style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
          >
            {t('accounting.reportsTitle')}
          </AppText>
        </View>
        <ReportsTabBar
          tabs={categories.map((key) => ({ key, label: t(TAB_KEY[key]) }))}
          value={active}
          onChange={setCategory}
        />
        <ReportsPeriodChrome
          period={period}
          from={range.from}
          to={range.to}
          dateBasis={dateBasis}
          onChange={setPeriod}
          onCustomPress={() => setRangeOpen(true)}
          onDateBasisChange={setDateBasis}
        />
        {active === 'dashboard' && dashboardQuery.data ? (
          <DealerBoard title={t('accounting.reportDashboard')} titleWeight={titleWeight}>
            <ReportsMetricGrid metrics={snapshot} />
          </DealerBoard>
        ) : null}
        {active === 'sales' && salesQuery.data ? (
          <DealerBoard title={t('accounting.reportSales')} titleWeight={titleWeight}>
            <ReportsStatusRows rows={selectStatusRows(salesQuery.data.ordersByStatus)} />
          </DealerBoard>
        ) : null}
        {active === 'production' && productionQuery.data ? (
          <DealerBoard title={t('accounting.ordersByStatus')} titleWeight={titleWeight}>
            <ReportsStatusRows rows={selectStatusRows(productionQuery.data.ordersByStatus)} />
          </DealerBoard>
        ) : null}
        {active === 'financial' && financialQuery.data?.aging ? (
          <DealerBoard title={t('accounting.arAging')} titleWeight={titleWeight}>
            <ReportsMoneyRows
              rows={[
                {
                  key: 'current',
                  label: t('accounting.agingCurrent'),
                  value: formatCurrency(locale, financialQuery.data.aging.current),
                },
              ]}
            />
          </DealerBoard>
        ) : null}
      </ScrollView>
      <ReportsRangeSheet
        open={rangeOpen}
        from={range.from}
        to={range.to}
        onClose={() => setRangeOpen(false)}
        onApply={(next) => {
          setCustomRange(next);
          setPeriod('custom');
          setRangeOpen(false);
        }}
        onClear={() => {
          setPeriod('month');
          setRangeOpen(false);
        }}
      />
    </AppScreen>
  );
}
