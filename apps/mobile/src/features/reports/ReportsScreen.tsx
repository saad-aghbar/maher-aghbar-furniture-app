import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { formatCurrency } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { ReportsMetricGrid } from './components/ReportsMetricGrid';
import { ReportsMoneyRows } from './components/ReportsMoneyRows';
import { ReportsPeriodChrome } from './components/ReportsPeriodChrome';
import { ReportsStatusRows } from './components/ReportsStatusRows';
import { ReportsTabBar } from './components/ReportsTabBar';
import {
  useDashboardReportQuery,
  useFinancialReportQuery,
  useProductionReportQuery,
  useSalesReportQuery,
} from './query';
import {
  reportsPeriodRange,
  selectDashboardSnapshot,
  selectStatusRows,
  type ReportsCategory,
  type ReportsPeriod,
} from './selectReports';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

const CATEGORIES: ReportsCategory[] = ['dashboard', 'sales', 'production', 'financial'];

const CATEGORY_TAB_KEY: Record<ReportsCategory, string> = {
  dashboard: 'mobile.reports.tabs.dashboard',
  sales: 'mobile.reports.tabs.sales',
  production: 'mobile.reports.tabs.production',
  financial: 'mobile.reports.tabs.financial',
};

const CATEGORY_TITLE_KEY: Record<ReportsCategory, string> = {
  dashboard: 'accounting.reportDashboard',
  sales: 'accounting.reportSales',
  production: 'accounting.reportProduction',
  financial: 'accounting.reportFinancial',
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

function SectionEyebrow({ label }: { label: string }) {
  const { isRTL, locale } = useLocale();
  return (
    <AppText
      variant="caption"
      color="muted"
      style={{
        textAlign: isRTL ? 'right' : 'left',
        fontSize: 10,
        letterSpacing: locale === 'ar' ? 0 : 0.45,
        textTransform: locale === 'ar' ? 'none' : 'uppercase',
      }}
    >
      {label}
    </AppText>
  );
}

/**
 * Admin Reports — floor boards: category pill, period chrome, parchment ledgers.
 */
export function ReportsScreen() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const canSales = can(user, 'report.sales.read');
  const canProduction = can(user, 'report.production.read');
  const canFinancial = can(user, 'report.financial.read');

  const categories = useMemo(
    () =>
      CATEGORIES.filter((key) => {
        if (key === 'dashboard' || key === 'sales') return canSales;
        if (key === 'production') return canProduction;
        return canFinancial;
      }),
    [canSales, canProduction, canFinancial],
  );

  const [period, setPeriod] = useState<ReportsPeriod>('month');
  const [category, setCategory] = useState<ReportsCategory>(
    () => categories[0] ?? 'dashboard',
  );

  const range = useMemo(() => reportsPeriodRange(period), [period]);

  const dashboardQuery = useDashboardReportQuery(canSales && category === 'dashboard');
  const salesQuery = useSalesReportQuery(range, canSales && category === 'sales');
  const productionQuery = useProductionReportQuery(
    range,
    canProduction && category === 'production',
  );
  const financialQuery = useFinancialReportQuery(canFinancial && category === 'financial');

  const activeQuery =
    category === 'dashboard'
      ? dashboardQuery
      : category === 'sales'
        ? salesQuery
        : category === 'production'
          ? productionQuery
          : financialQuery;

  const snapshot = useMemo(
    () => selectDashboardSnapshot(locale, dashboardQuery.data),
    [dashboardQuery.data, locale],
  );

  const salesRows = useMemo(
    () => selectStatusRows(salesQuery.data?.ordersByStatus),
    [salesQuery.data],
  );
  const productionOrderRows = useMemo(
    () => selectStatusRows(productionQuery.data?.ordersByStatus),
    [productionQuery.data],
  );
  const productionTaskRows = useMemo(
    () => selectStatusRows(productionQuery.data?.tasksByStatus),
    [productionQuery.data],
  );
  const financialRows = useMemo(
    () => selectStatusRows(financialQuery.data?.invoicesByStatus),
    [financialQuery.data],
  );

  const aging = financialQuery.data?.aging;
  const agingRows = aging
    ? [
        {
          key: 'current',
          label: t('accounting.agingCurrent'),
          value: formatCurrency(locale, Number(aging.current) || 0),
        },
        {
          key: 'd1',
          label: t('accounting.agingD1_30'),
          value: formatCurrency(locale, Number(aging.d1_30) || 0),
        },
        {
          key: 'd31',
          label: t('accounting.agingD31_60'),
          value: formatCurrency(locale, Number(aging.d31_60) || 0),
          tone: 'warning' as const,
        },
        {
          key: 'd61',
          label: t('accounting.agingD61_90'),
          value: formatCurrency(locale, Number(aging.d61_90) || 0),
          tone: 'error' as const,
        },
        {
          key: 'older',
          label: t('accounting.agingOlder'),
          value: formatCurrency(locale, Number(aging.older) || 0),
          tone: 'error' as const,
        },
      ]
    : [];

  if (categories.length === 0) {
    return (
      <AppScreen>
        <ReportsTitle titleWeight={titleWeight} />
        <DealerEmptyPanel text={t('mobile.noReportsAccess')} icon="lock-closed-outline" />
      </AppScreen>
    );
  }

  const activeCategory = categories.includes(category) ? category : categories[0]!;
  const showPeriod = activeCategory === 'sales' || activeCategory === 'production';
  const hasBody = Boolean(activeQuery.data);
  const loading = activeQuery.isLoading && !activeQuery.data;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ReportsTitle titleWeight={titleWeight} />

      <ReportsTabBar
        tabs={categories.map((key) => ({
          key,
          label: t(CATEGORY_TAB_KEY[key]),
        }))}
        value={activeCategory}
        onChange={setCategory}
      />

      {showPeriod ? (
        <ReportsPeriodChrome
          period={period}
          from={range.from}
          to={range.to}
          onChange={setPeriod}
        />
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.brand}
            refreshing={Boolean(activeQuery.isFetching && !activeQuery.isLoading)}
            onRefresh={() => {
              void activeQuery.refetch();
            }}
          />
        }
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: SURFACE_TAB_BAR_CLEARANCE,
        }}
        showsVerticalScrollIndicator={false}
      >
        {activeQuery.isError && !activeQuery.isLoading ? (
          <ErrorState
            title={t('common.loadFailed')}
            onRetry={() => {
              void activeQuery.refetch();
            }}
          />
        ) : null}

        {loading ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t(CATEGORY_TITLE_KEY[activeCategory])} titleWeight={titleWeight}>
              <ActivityIndicator color={colors.brand} />
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'dashboard' && dashboardQuery.data ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t('accounting.reportDashboard')} titleWeight={titleWeight}>
              <ReportsMetricGrid metrics={snapshot} />
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'sales' && salesQuery.data ? (
          <ListItemEnter index={0}>
            <DealerBoard title={t('accounting.reportSales')} titleWeight={titleWeight}>
              <SectionEyebrow label={t('accounting.ordersByStatus')} />
              <ReportsStatusRows rows={salesRows} />
            </DealerBoard>
          </ListItemEnter>
        ) : null}

        {activeCategory === 'production' && productionQuery.data ? (
          <>
            <ListItemEnter index={0}>
              <DealerBoard title={t('accounting.ordersByStatus')} titleWeight={titleWeight}>
                <ReportsStatusRows rows={productionOrderRows} />
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={1}>
              <DealerBoard title={t('accounting.tasksByStatus')} titleWeight={titleWeight}>
                <ReportsStatusRows rows={productionTaskRows} />
              </DealerBoard>
            </ListItemEnter>
          </>
        ) : null}

        {activeCategory === 'financial' && financialQuery.data ? (
          <>
            <ListItemEnter index={0}>
              <DealerBoard title={t('accounting.arAging')} titleWeight={titleWeight}>
                {agingRows.length > 0 ? (
                  <ReportsMoneyRows rows={agingRows} />
                ) : (
                  <DealerEmptyPanel nested compact text={t('accounting.noData')} />
                )}
              </DealerBoard>
            </ListItemEnter>
            <ListItemEnter index={1}>
              <DealerBoard title={t('accounting.invoicesByStatus')} titleWeight={titleWeight}>
                <ReportsStatusRows rows={financialRows} />
              </DealerBoard>
            </ListItemEnter>
          </>
        ) : null}

        {!loading && !activeQuery.isError && !hasBody ? (
          <DealerEmptyPanel text={t('accounting.noData')} icon="stats-chart-outline" />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
