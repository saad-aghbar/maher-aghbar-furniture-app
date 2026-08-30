import { useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenBackLead } from '@/components/layout/ScreenBackLead';
import { useNetwork } from '@/components/network/NetworkProvider';
import { formatCurrency, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useTheme } from '@/theme';
import {
  useDashboardReportQuery,
  useFinancialReportQuery,
  useProductionReportQuery,
  useSalesReportQuery,
} from './query';
import {
  reportsDateRangeParts,
  reportsPeriodRange,
  selectDashboardSnapshot,
  selectStatusRows,
  type ReportsCategory,
  type ReportsPeriod,
  type StatusCountRow,
} from './selectReports';

const BACK_FALLBACK = '/(app)/(admin)/(tabs)/more' as Href;

const PERIODS: ReportsPeriod[] = ['today', 'week', 'month'];
const CATEGORIES: ReportsCategory[] = ['dashboard', 'sales', 'production', 'financial'];

const PERIOD_KEY: Record<ReportsPeriod, string> = {
  today: 'mobile.reports.today',
  week: 'mobile.reports.thisWeek',
  month: 'mobile.reports.thisMonth',
};

const CATEGORY_KEY: Record<ReportsCategory, string> = {
  dashboard: 'accounting.reportDashboard',
  sales: 'accounting.reportSales',
  production: 'accounting.reportProduction',
  financial: 'accounting.reportFinancial',
};

function ReportsTitle({ titleWeight }: { titleWeight: 'medium' | 'semibold' }) {
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
          {t('accounting.reportsTitle')}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color="muted"
        align="center"
        style={{ paddingHorizontal: theme.spacing.lg }}
      >
        {t('accounting.reportsSubtitle')}
      </AppText>
    </View>
  );
}

function ChipRow<T extends string>({
  items,
  value,
  onChange,
  labelFor,
}: {
  items: T[];
  value: T;
  onChange: (next: T) => void;
  labelFor: (item: T) => string;
}) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        paddingVertical: 2,
      }}
    >
      {items.map((item) => {
        const active = item === value;
        const label = labelFor(item);
        return (
          <AnimatedPressable
            key={item}
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => {
              if (item === value) return;
              void haptics.selection();
              onChange(item);
            }}
            style={{
              flexShrink: 0,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              minHeight: 36,
              borderRadius: theme.radius.full,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: active ? colors.brand : colors.border,
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="caption"
              weight={active ? titleWeight : 'medium'}
              numberOfLines={1}
              style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 16 }}
            >
              {label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

function DateRangeLine({ from, to }: { from: string; to: string }) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const parts = reportsDateRangeParts(locale, { from, to });

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="caption" color="muted" style={{ color: colors.textSecondary }}>
        {parts.start}
      </AppText>
      <AppText variant="caption" color="muted" style={{ color: colors.textSecondary }}>
        {parts.dash}
      </AppText>
      <AppText variant="caption" color="muted" style={{ color: colors.textSecondary }}>
        {parts.end}
      </AppText>
    </View>
  );
}

function MetricGrid({
  metrics,
}: {
  metrics: ReturnType<typeof selectDashboardSnapshot>;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}
    >
      {metrics.map((metric) => (
        <View
          key={metric.key}
          style={{
            width: '48%',
            flexGrow: 1,
            minWidth: 140,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            padding: theme.spacing.md,
            gap: 6,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText
            variant="caption"
            color="muted"
            style={{
              textAlign: isRTL ? 'right' : 'left',
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {t(metric.labelKey)}
          </AppText>
          <AppText
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              color: colors.textPrimary,
              fontSize: 18,
              lineHeight: 22,
            }}
          >
            {metric.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function StatusRows({ rows }: { rows: StatusCountRow[] }) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (rows.length === 0) {
    return <EmptyState title={t('accounting.noData')} />;
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {rows.map((row) => {
        const statusKey = `statuses.${row.status}`;
        const statusLabel = t(statusKey);
        return (
          <View
            key={row.status}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <AppText
              variant="body"
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {statusLabel === statusKey ? row.status : statusLabel}
            </AppText>
            <AppText weight={titleWeight} dir="ltr" style={{ color: colors.textPrimary }}>
              {row.total != null
                ? `${formatNumber(locale, row.count, { maximumFractionDigits: 0 })} · ${formatCurrency(locale, row.total)}`
                : formatNumber(locale, row.count, { maximumFractionDigits: 0 })}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function ReportCard({ title, children }: { title: string; children: ReactNode }) {
  const { locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AppText variant="heading" weight={titleWeight}>
        {`● ${title}`}
      </AppText>
      {children}
    </View>
  );
}

/**
 * Admin Reports — leftover polish only: live date language, Financial chip in full.
 */
export function ReportsScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { theme } = useTheme();
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
    ? ([
        ['accounting.agingCurrent', aging.current],
        ['accounting.agingD1_30', aging.d1_30],
        ['accounting.agingD31_60', aging.d31_60],
        ['accounting.agingD61_90', aging.d61_90],
        ['accounting.agingOlder', aging.older],
      ] as const)
    : [];

  if (categories.length === 0) {
    return (
      <AppScreen>
        <ReportsTitle titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noReportsAccess')} />
      </AppScreen>
    );
  }

  const activeCategory = categories.includes(category) ? category : categories[0]!;

  return (
    <AppScreen>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ReportsTitle titleWeight={titleWeight} />

      <ChipRow
        items={PERIODS}
        value={period}
        onChange={setPeriod}
        labelFor={(item) => t(PERIOD_KEY[item])}
      />
      <DateRangeLine from={range.from} to={range.to} />
      <ChipRow
        items={categories}
        value={activeCategory}
        onChange={setCategory}
        labelFor={(item) => t(CATEGORY_KEY[item])}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
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

        {activeCategory === 'dashboard' && dashboardQuery.data ? (
          <ReportCard title={t('accounting.reportDashboard')}>
            <MetricGrid metrics={snapshot} />
          </ReportCard>
        ) : null}

        {activeCategory === 'sales' && salesQuery.data ? (
          <ReportCard title={t('accounting.reportSales')}>
            <AppText variant="label" color="muted">
              {t('accounting.ordersByStatus')}
            </AppText>
            <StatusRows rows={salesRows} />
          </ReportCard>
        ) : null}

        {activeCategory === 'production' && productionQuery.data ? (
          <ReportCard title={t('accounting.reportProduction')}>
            <AppText variant="label" color="muted">
              {t('accounting.ordersByStatus')}
            </AppText>
            <StatusRows rows={productionOrderRows} />
            <AppText variant="label" color="muted">
              {t('accounting.tasksByStatus')}
            </AppText>
            <StatusRows rows={productionTaskRows} />
          </ReportCard>
        ) : null}

        {activeCategory === 'financial' && financialQuery.data ? (
          <ReportCard title={t('accounting.reportFinancial')}>
            <AppText variant="label" color="muted">
              {t('accounting.arAging')}
            </AppText>
            {agingRows.map(([key, amount]) => (
              <View
                key={key}
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <AppText variant="body">{t(key)}</AppText>
                <AppText weight={titleWeight} dir="ltr">
                  {formatCurrency(locale, Number(amount) || 0)}
                </AppText>
              </View>
            ))}
            <AppText variant="label" color="muted">
              {t('accounting.invoicesByStatus')}
            </AppText>
            <StatusRows rows={financialRows} />
          </ReportCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
