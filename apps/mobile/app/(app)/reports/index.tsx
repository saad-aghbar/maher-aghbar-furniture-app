import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useItemQuery } from '../../../src/api/hooks';
import { MetricIcon } from '../../../src/features/home/MetricIcon';
import { formatMoney, formatNumber } from '../../../src/lib/format';
import { can } from '../../../src/permissions/can';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { spacing } from '../../../src/theme/tokens';
import {
  Card,
  ErrorState,
  Grid,
  ListSkeleton,
  MetricCard,
  Row,
  Screen,
  Section,
  Text,
} from '../../../src/ui';

type DashboardReport = {
  activeOrders?: number;
  ordersDueSoon?: number;
  delayedProduction?: number;
  waitingMaterials?: number;
  pendingQuoteApprovals?: number;
  outstandingInvoices?: number;
  lowStock?: number;
  criticalBlockers?: number;
  dailyCompletions?: number;
  revenueInvoiced?: number;
  receivablesAmount?: number;
  completedSalesOrders?: number;
  openPurchases?: number;
  generatedAt?: string;
};

type StatusCountRow = {
  status?: string;
  count?: unknown;
  _count?: number | { _all?: number } | null;
};

type SalesReport = {
  ordersByStatus?: StatusCountRow[];
  topCustomers?: unknown[];
  recentQuotes?: unknown[];
};

type FinancialReport = {
  invoicesByStatus?: StatusCountRow[];
  paymentsTotal?: unknown;
  paymentCount?: unknown;
  aging?: Record<string, unknown>;
  openInvoices?: unknown[];
};

type ProductionReport = {
  ordersByStatus?: StatusCountRow[];
  delayedOrders?: unknown[];
  tasksByStatus?: StatusCountRow[];
};

function statusCount(row: StatusCountRow): number {
  if (typeof row.count === 'number') return row.count;
  if (typeof row._count === 'number') return row._count;
  if (row._count && typeof row._count === 'object') {
    return Number(row._count._all ?? 0);
  }
  return 0;
}

function StatusBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: StatusCountRow[] | undefined;
}) {
  const { t } = useI18n();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <Card title={title}>
      {rows.map((s, i) => (
        <Row
          key={`${s.status ?? 'unknown'}-${i}`}
          label={t(`statuses.${s.status ?? ''}`, s.status ?? '—')}
          value={formatNumber(statusCount(s), 0)}
          latin
        />
      ))}
    </Card>
  );
}

export default function ReportsScreen() {
  const { t } = useI18n();
  const { user } = useAuth();

  const canSales = can(user, 'report.sales.read');
  const canFinancial = can(user, 'report.financial.read');
  const canProduction = can(user, 'report.production.read');

  const dashboard = useItemQuery<DashboardReport>(
    ['reports', 'dashboard'],
    '/reports/dashboard',
    { enabled: canSales },
  );
  const sales = useItemQuery<SalesReport>(['reports', 'sales'], '/reports/sales', {
    enabled: canSales,
  });
  const financial = useItemQuery<FinancialReport>(
    ['reports', 'financial'],
    '/reports/financial',
    { enabled: canFinancial },
  );
  const production = useItemQuery<ProductionReport>(
    ['reports', 'production'],
    '/reports/production',
    { enabled: canProduction },
  );

  const queries = [
    canSales ? dashboard : null,
    canSales ? sales : null,
    canFinancial ? financial : null,
    canProduction ? production : null,
  ].filter(Boolean) as {
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  }[];

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const isFetching = queries.some((q) => q.isFetching);

  const refetchAll = () => {
    queries.forEach((q) => {
      void q.refetch();
    });
  };

  const d = dashboard.data;

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.reports', 'Reports') }} />
      <Screen refreshing={isFetching} onRefresh={refetchAll}>
        {!canSales && !canFinancial && !canProduction ? (
          <Text variant="caption" color="secondary">
            {t('mobile.noReportsAccess', 'No report permissions for your account.')}
          </Text>
        ) : null}

        {isLoading ? <ListSkeleton rows={4} /> : null}
        {isError && !isLoading ? <ErrorState onRetry={refetchAll} /> : null}

        {!isLoading && !isError && canSales && d ? (
          <Section title={t('mobile.overview', 'Overview')}>
            <Grid>
              <MetricCard
                label={t('common.metricActiveOrders', 'Active orders')}
                value={formatNumber(d.activeOrders ?? 0, 0)}
                tone="brand"
                icon={<MetricIcon name="file" tone="brand" />}
              />
              <MetricCard
                label={t('common.metricOrdersDueSoon', 'Due soon')}
                value={formatNumber(d.ordersDueSoon ?? 0, 0)}
                tone="warning"
                icon={<MetricIcon name="clock" tone="warning" />}
              />
              <MetricCard
                label={t('common.metricDelayedProduction', 'Delayed production')}
                value={formatNumber(d.delayedProduction ?? 0, 0)}
                tone="error"
                icon={<MetricIcon name="alert" tone="error" />}
              />
              <MetricCard
                label={t('common.metricWaitingMaterials', 'Waiting on materials')}
                value={formatNumber(d.waitingMaterials ?? 0, 0)}
                tone="warning"
                icon={<MetricIcon name="box" tone="warning" />}
              />
              <MetricCard
                label={t('common.metricPendingQuoteApprovals', 'Quotes awaiting approval')}
                value={formatNumber(d.pendingQuoteApprovals ?? 0, 0)}
                tone="info"
                icon={<MetricIcon name="file" tone="info" />}
              />
              <MetricCard
                label={t('common.metricOutstandingInvoices', 'Outstanding invoices')}
                value={formatNumber(d.outstandingInvoices ?? 0, 0)}
                tone="warning"
                icon={<MetricIcon name="money" tone="warning" />}
              />
              <MetricCard
                label={t('common.metricRevenueInvoiced', 'Revenue (invoiced)')}
                value={formatMoney(d.revenueInvoiced ?? 0)}
                tone="success"
                icon={<MetricIcon name="money" tone="success" />}
              />
              <MetricCard
                label={t('common.metricReceivables', 'Receivables')}
                value={formatMoney(d.receivablesAmount ?? 0)}
                tone="brand"
                icon={<MetricIcon name="money" tone="brand" />}
              />
              <MetricCard
                label={t('common.metricCompletedOrders', 'Completed / delivered SOs')}
                value={formatNumber(d.completedSalesOrders ?? 0, 0)}
                tone="success"
                icon={<MetricIcon name="check" tone="success" />}
              />
              <MetricCard
                label={t('common.metricOpenPurchases', 'Open purchase orders')}
                value={formatNumber(d.openPurchases ?? 0, 0)}
                tone="info"
                icon={<MetricIcon name="truck" tone="info" />}
              />
              <MetricCard
                label={t('common.metricLowStock', 'Low stock items')}
                value={formatNumber(d.lowStock ?? 0, 0)}
                tone="warning"
                icon={<MetricIcon name="box" tone="warning" />}
              />
              <MetricCard
                label={t('common.metricCriticalBlockers', 'Critical blockers')}
                value={formatNumber(d.criticalBlockers ?? 0, 0)}
                tone="error"
                icon={<MetricIcon name="alert" tone="error" />}
              />
              <MetricCard
                label={t('common.metricDailyCompletions', 'Completed today')}
                value={formatNumber(d.dailyCompletions ?? 0, 0)}
                tone="success"
                icon={<MetricIcon name="check" tone="success" />}
              />
            </Grid>
          </Section>
        ) : null}

        {!isLoading && !isError && canSales ? (
          <StatusBreakdown
            title={t('mobile.ordersByStatus', 'Orders by status')}
            rows={sales.data?.ordersByStatus}
          />
        ) : null}

        {!isLoading && !isError && canFinancial ? (
          <Section title={t('mobile.financial', 'Financial')}>
            <Grid>
              <MetricCard
                label={t('mobile.paymentsTotal', 'Payments total')}
                value={formatMoney(financial.data?.paymentsTotal ?? 0)}
                tone="success"
                icon={<MetricIcon name="money" tone="success" />}
              />
              <MetricCard
                label={t('mobile.paymentCount', 'Payment count')}
                value={formatNumber(financial.data?.paymentCount ?? 0, 0)}
                tone="info"
                icon={<MetricIcon name="file" tone="info" />}
              />
            </Grid>
            <View style={styles.gap}>
              <StatusBreakdown
                title={t('mobile.invoicesByStatus', 'Invoices by status')}
                rows={financial.data?.invoicesByStatus}
              />
            </View>
          </Section>
        ) : null}

        {!isLoading && !isError && canProduction ? (
          <Section title={t('navigation.production', 'Production')}>
            <StatusBreakdown
              title={t('mobile.productionByStatus', 'Production by status')}
              rows={production.data?.ordersByStatus}
            />
            <StatusBreakdown
              title={t('mobile.tasksByStatus', 'Tasks by status')}
              rows={production.data?.tasksByStatus}
            />
          </Section>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.sm },
});
