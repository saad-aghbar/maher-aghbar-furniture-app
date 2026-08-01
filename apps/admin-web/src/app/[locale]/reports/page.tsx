'use client';

import { PageHeader } from '@/components/admin/page-header';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import {
  Button,
  Card,
  EmptyState,
  Input,
  MetricCard,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@maher/i18n';
import { useMemo, useState } from 'react';

interface DashboardReport {
  activeOrders: number;
  ordersDueSoon: number;
  delayedProduction: number;
  waitingMaterials: number;
  pendingQuoteApprovals: number;
  outstandingInvoices: number;
  lowStock: number;
  criticalBlockers: number;
  dailyCompletions: number;
  revenueInvoiced?: number;
  receivablesAmount?: number;
  completedSalesOrders?: number;
  openPurchases?: number;
  generatedAt?: string;
}

interface SalesReport {
  ordersByStatus: Array<{ status: string; count: number; total: number }>;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orderCount: number;
    total: number;
  }>;
  recentQuotes: Array<{
    id: string;
    number: string;
    status: string;
    total: string | number;
    customer: string;
    createdAt?: string;
  }>;
}

interface ProductionReport {
  ordersByStatus: Array<{ status: string; _count: number }>;
  delayedOrders: Array<{
    id: string;
    number: string;
    status: string;
    requiredDeliveryDate?: string | null;
    salesOrderId?: string | null;
    salesOrder?: { id?: string; number: string } | null;
  }>;
  tasksByStatus: Array<{ status: string; _count: number }>;
}

interface InventoryReport {
  lowStock: Array<{
    sku: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    available: number;
    minStock: number;
  }>;
  onHand: Array<{
    sku: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    balances: Array<{ warehouse: string; availableQty: string | number }>;
  }>;
}

interface FinancialReport {
  invoicesByStatus: Array<{
    status: string;
    count: number;
    total: number;
    outstanding: number;
  }>;
  paymentsTotal: number;
  paymentCount: number;
  aging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    older: number;
  };
  openInvoices: Array<{
    id?: string;
    number: string;
    customer: string;
    dueDate?: string | null;
    outstanding: string | number;
  }>;
}

interface PurchasingReport {
  purchaseOrdersByStatus: Array<{
    status: string;
    _count: number;
    _sum?: { total?: string | number | null };
  }>;
  purchaseRequestsByStatus: Array<{ status: string; _count: number }>;
  recentReceipts: Array<{
    id: string;
    number?: string;
    createdAt?: string;
    purchaseOrder?: { id: string; number: string } | null;
    warehouse?: { code: string } | null;
  }>;
}

function isForbidden(error: unknown) {
  return error instanceof ApiClientError && error.status === 403;
}

function money(value: string | number | undefined | null) {
  return Number(value ?? 0).toFixed(2);
}

function inDateRange(value: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const day = value.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiClientError(`Export failed (${res.status})`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useReportQuery<T>(key: string, path: string) {
  return useQuery({
    queryKey: ['reports', key],
    queryFn: () => apiFetch<T>(path),
    retry: (failureCount, error) => {
      if (isForbidden(error)) return false;
      return failureCount < 1;
    },
  });
}

export default function ReportsPage() {
  const t = useTranslations('navigation');
  const ta = useTranslations('accounting');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const dashboard = useReportQuery<DashboardReport>('dashboard', '/api/v1/reports/dashboard');
  const sales = useReportQuery<SalesReport>('sales', '/api/v1/reports/sales');
  const production = useReportQuery<ProductionReport>('production', '/api/v1/reports/production');
  const inventory = useReportQuery<InventoryReport>('inventory', '/api/v1/reports/inventory');
  const financial = useReportQuery<FinancialReport>('financial', '/api/v1/reports/financial');
  const purchasing = useReportQuery<PurchasingReport>('purchasing', '/api/v1/reports/purchasing');

  const filteredRecentQuotes = useMemo(
    () =>
      (sales.data?.recentQuotes ?? []).filter((q) =>
        inDateRange(q.createdAt, dateFrom, dateTo),
      ),
    [sales.data?.recentQuotes, dateFrom, dateTo],
  );
  const filteredOpenInvoices = useMemo(
    () =>
      (financial.data?.openInvoices ?? []).filter((inv) =>
        inDateRange(inv.dueDate, dateFrom, dateTo),
      ),
    [financial.data?.openInvoices, dateFrom, dateTo],
  );
  const filteredDelayedOrders = useMemo(
    () =>
      (production.data?.delayedOrders ?? []).filter((po) =>
        inDateRange(po.requiredDeliveryDate, dateFrom, dateTo),
      ),
    [production.data?.delayedOrders, dateFrom, dateTo],
  );

  const anyLoading =
    dashboard.isLoading ||
    sales.isLoading ||
    production.isLoading ||
    inventory.isLoading ||
    financial.isLoading ||
    purchasing.isLoading;

  if (anyLoading && !dashboard.data && !sales.data && !financial.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const showDashboard = dashboard.isSuccess && !!dashboard.data;
  const showSales = sales.isSuccess && !!sales.data;
  const showProduction = production.isSuccess && !!production.data;
  const showInventory = inventory.isSuccess && !!inventory.data;
  const showFinancial = financial.isSuccess && !!financial.data;
  const showPurchasing = purchasing.isSuccess && !!purchasing.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('reports')}
        description={ta('reportsSubtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="date"
              label={ta('dateFrom')}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              label={ta('dateTo')}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
            {showSales ? (
              <Button
                size="sm"
                variant="subtle"
                onClick={() => void downloadCsv('/api/v1/reports/export/sales.csv', 'sales-report.csv')}
              >
                {ta('exportSalesCsv')}
              </Button>
            ) : null}
            {showFinancial ? (
              <Button
                size="sm"
                variant="subtle"
                onClick={() =>
                  void downloadCsv('/api/v1/reports/export/financial.csv', 'financial-aging.csv')
                }
              >
                {ta('exportFinancialCsv')}
              </Button>
            ) : null}
          </div>
        }
      />

      {dateFrom || dateTo ? (
        <p className="text-sm text-text-secondary">{ta('dateRangeHint')}</p>
      ) : null}

      {showDashboard ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportDashboard')}</h2>
          {dashboard.data.generatedAt ? (
            <p className="text-sm text-text-secondary" dir="ltr">
              {ta('generatedAt')} {dashboard.data.generatedAt.slice(0, 19).replace('T', ' ')}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={tCommon('metricActiveOrders')} value={<span dir="ltr">{dashboard.data.activeOrders}</span>} />
            <MetricCard label={tCommon('metricOrdersDueSoon')} value={<span dir="ltr">{dashboard.data.ordersDueSoon}</span>} />
            <MetricCard
              label={tCommon('metricDelayedProduction')}
              value={<span dir="ltr">{dashboard.data.delayedProduction}</span>}
            />
            <MetricCard
              label={tCommon('metricOutstandingInvoices')}
              value={<span dir="ltr">{dashboard.data.outstandingInvoices}</span>}
            />
            <MetricCard
              label={tCommon('metricRevenueInvoiced')}
              value={<span dir="ltr">{money(dashboard.data.revenueInvoiced)}</span>}
            />
            <MetricCard
              label={tCommon('metricReceivables')}
              value={<span dir="ltr">{money(dashboard.data.receivablesAmount)}</span>}
            />
            <MetricCard label={tCommon('metricLowStock')} value={<span dir="ltr">{dashboard.data.lowStock}</span>} />
            <MetricCard
              label={tCommon('metricOpenPurchases')}
              value={<span dir="ltr">{dashboard.data.openPurchases ?? 0}</span>}
            />
          </div>
        </section>
      ) : isForbidden(dashboard.error) ? null : dashboard.isError ? (
        <ForbiddenOrError title={ta('reportDashboard')} message={tCommon('loadFailed')} />
      ) : null}

      {showSales ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportSales')}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ta('ordersByStatus')}>
              <StatusCountTable
                rows={sales.data.ordersByStatus.map((r) => ({
                  status: r.status,
                  count: r.count,
                  total: r.total,
                }))}
                showTotal
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
            <Card title={ta('topCustomers')}>
              {(sales.data.topCustomers ?? []).length === 0 ? (
                <EmptyState title={ta('noData')} />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>{ta('customer')}</TableHeaderCell>
                      <TableHeaderCell>{ta('orderCount')}</TableHeaderCell>
                      <TableHeaderCell>{ta('total')}</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sales.data.topCustomers.map((c) => (
                      <TableRow key={c.customerId}>
                        <TableCell>
                          <Link
                            href={`/customers/${c.customerId}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {c.customerName}
                          </Link>
                        </TableCell>
                        <TableCell dir="ltr">{c.orderCount}</TableCell>
                        <TableCell dir="ltr">{money(c.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
          <Card title={ta('recentQuotes')}>
            {filteredRecentQuotes.length === 0 ? (
              <EmptyState title={ta('noData')} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                    <TableHeaderCell>{ta('customer')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                    <TableHeaderCell>{ta('total')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecentQuotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Link
                          href={`/quotations/${q.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {q.number}
                        </Link>
                      </TableCell>
                      <TableCell>{q.customer}</TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                      <TableCell dir="ltr">{money(q.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      ) : isForbidden(sales.error) ? null : sales.isError ? (
        <ForbiddenOrError title={ta('reportSales')} message={tCommon('loadFailed')} />
      ) : null}

      {showFinancial ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportFinancial')}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ta('arAging')}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {(
                  [
                    ['agingCurrent', financial.data.aging.current],
                    ['agingD1_30', financial.data.aging.d1_30],
                    ['agingD31_60', financial.data.aging.d31_60],
                    ['agingD61_90', financial.data.aging.d61_90],
                    ['agingOlder', financial.data.aging.older],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-text-secondary">{ta(key)}</dt>
                    <dd className="font-medium" dir="ltr">
                      {money(value)} {tCommon('currency')}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-text-secondary">
                {ta('paymentsTotal')}:{' '}
                <span dir="ltr" className="font-medium text-text-primary">
                  {money(financial.data.paymentsTotal)} {tCommon('currency')}
                </span>
                {' · '}
                {ta('paymentCount')}:{' '}
                <span dir="ltr" className="font-medium text-text-primary">
                  {financial.data.paymentCount}
                </span>
              </p>
            </Card>
            <Card title={ta('invoicesByStatus')}>
              <StatusCountTable
                rows={financial.data.invoicesByStatus.map((r) => ({
                  status: r.status,
                  count: r.count,
                  total: r.total,
                }))}
                showTotal
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
          </div>
          <Card title={ta('openInvoices')}>
            {filteredOpenInvoices.length === 0 ? (
              <EmptyState title={ta('noData')} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{ta('invoiceNumber')}</TableHeaderCell>
                    <TableHeaderCell>{ta('customer')}</TableHeaderCell>
                    <TableHeaderCell>{ta('dueDate')}</TableHeaderCell>
                    <TableHeaderCell>{ta('outstanding')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredOpenInvoices.map((inv) => (
                    <TableRow key={inv.id ?? inv.number}>
                      <TableCell>
                        {inv.id ? (
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="font-medium text-brand hover:underline"
                          >
                            {inv.number}
                          </Link>
                        ) : (
                          inv.number
                        )}
                      </TableCell>
                      <TableCell>{inv.customer}</TableCell>
                      <TableCell dir="ltr">{inv.dueDate?.toString().slice(0, 10) ?? '—'}</TableCell>
                      <TableCell dir="ltr">{money(inv.outstanding)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      ) : isForbidden(financial.error) ? null : financial.isError ? (
        <ForbiddenOrError title={ta('reportFinancial')} message={tCommon('loadFailed')} />
      ) : null}

      {showProduction ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportProduction')}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ta('ordersByStatus')}>
              <StatusCountTable
                rows={production.data.ordersByStatus.map((r) => ({
                  status: r.status,
                  count: r._count,
                }))}
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
            <Card title={ta('tasksByStatus')}>
              <StatusCountTable
                rows={production.data.tasksByStatus.map((r) => ({
                  status: r.status,
                  count: r._count,
                }))}
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
          </div>
          <Card title={ta('delayedOrders')}>
            {filteredDelayedOrders.length === 0 ? (
              <EmptyState title={ta('noData')} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                    <TableHeaderCell>{ta('salesOrder')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
                    <TableHeaderCell>{ta('dueDate')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDelayedOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>
                        <Link
                          href={`/production/${po.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {po.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {po.salesOrder?.id || po.salesOrderId ? (
                          <Link
                            href={`/sales-orders/${po.salesOrder?.id ?? po.salesOrderId}`}
                            className="text-brand hover:underline"
                          >
                            {po.salesOrder?.number ?? '—'}
                          </Link>
                        ) : (
                          (po.salesOrder?.number ?? '—')
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={po.status} />
                      </TableCell>
                      <TableCell dir="ltr">
                        {po.requiredDeliveryDate?.toString().slice(0, 10) ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      ) : isForbidden(production.error) ? null : production.isError ? (
        <ForbiddenOrError title={ta('reportProduction')} message={tCommon('loadFailed')} />
      ) : null}

      {showInventory ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportInventory')}</h2>
          <Card title={ta('lowStock')}>
            {(inventory.data.lowStock ?? []).length === 0 ? (
              <EmptyState title={ta('noData')} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{ta('sku')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('details')}</TableHeaderCell>
                    <TableHeaderCell>{ta('available')}</TableHeaderCell>
                    <TableHeaderCell>{ta('minStock')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inventory.data.lowStock.map((item) => (
                    <TableRow key={item.sku}>
                      <TableCell dir="ltr">{item.sku}</TableCell>
                      <TableCell>{localizedName(locale, item)}</TableCell>
                      <TableCell dir="ltr">{item.available}</TableCell>
                      <TableCell dir="ltr">{item.minStock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      ) : isForbidden(inventory.error) ? null : inventory.isError ? (
        <ForbiddenOrError title={ta('reportInventory')} message={tCommon('loadFailed')} />
      ) : null}

      {showPurchasing ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{ta('reportPurchasing')}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={ta('purchaseOrdersByStatus')}>
              <StatusCountTable
                rows={purchasing.data.purchaseOrdersByStatus.map((r) => ({
                  status: r.status,
                  count: r._count,
                  total: Number(r._sum?.total ?? 0),
                }))}
                showTotal
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
            <Card title={ta('purchaseRequestsByStatus')}>
              <StatusCountTable
                rows={purchasing.data.purchaseRequestsByStatus.map((r) => ({
                  status: r.status,
                  count: r._count,
                }))}
                countLabel={ta('count')}
                totalLabel={ta('total')}
                statusLabel={tCommon('status')}
                empty={ta('noData')}
              />
            </Card>
          </div>
          <Card title={ta('recentReceipts')}>
            {(purchasing.data.recentReceipts ?? []).length === 0 ? (
              <EmptyState title={ta('noData')} />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
                    <TableHeaderCell>{ta('purchaseOrder')}</TableHeaderCell>
                    <TableHeaderCell>{ta('warehouse')}</TableHeaderCell>
                    <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchasing.data.recentReceipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.number ?? r.id.slice(0, 8)}</TableCell>
                      <TableCell>
                        {r.purchaseOrder ? (
                          <Link
                            href={`/purchasing/${r.purchaseOrder.id}`}
                            className="text-brand hover:underline"
                          >
                            {r.purchaseOrder.number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell dir="ltr">{r.warehouse?.code ?? '—'}</TableCell>
                      <TableCell dir="ltr">{r.createdAt?.slice(0, 10) ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      ) : isForbidden(purchasing.error) ? null : purchasing.isError ? (
        <ForbiddenOrError title={ta('reportPurchasing')} message={tCommon('loadFailed')} />
      ) : null}
    </div>
  );
}

function ForbiddenOrError({ title, message }: { title: string; message: string }) {
  return (
    <Card title={title}>
      <p className="text-sm text-text-secondary">{message}</p>
    </Card>
  );
}

function StatusCountTable({
  rows,
  showTotal,
  countLabel,
  totalLabel,
  statusLabel,
  empty,
}: {
  rows: Array<{ status: string; count: number; total?: number }>;
  showTotal?: boolean;
  countLabel: string;
  totalLabel: string;
  statusLabel: string;
  empty: string;
}) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{statusLabel}</TableHeaderCell>
          <TableHeaderCell>{countLabel}</TableHeaderCell>
          {showTotal ? <TableHeaderCell>{totalLabel}</TableHeaderCell> : null}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.status}>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell dir="ltr">{row.count}</TableCell>
            {showTotal ? <TableCell dir="ltr">{money(row.total)}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
