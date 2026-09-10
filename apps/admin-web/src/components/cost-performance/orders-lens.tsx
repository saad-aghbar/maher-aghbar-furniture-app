'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  Card,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableNumericCell,
  TableRow,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

export type CostOrderRow = {
  id: string;
  number: string;
  status: string;
  orderDate: string;
  dealer?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
  productSummary: string;
  quantity: number;
  actualCost: number | null;
  saleValue: number | null;
  grossMargin: number | null;
  marginPct: number | null;
  coverage: 'FINAL' | 'PARTIAL' | 'UNPRICED';
  workerEffortMinutes: number;
  wallClockMinutes: number | null;
};

function money(locale: string, value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(value);
}

function hours(minutes: number | null) {
  if (minutes == null) return '—';
  return `${(minutes / 60).toFixed(1)} h`;
}

export function OrdersLens({ periodQs }: { periodQs: string }) {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['cost-orders', periodQs],
    queryFn: () =>
      apiFetch<{ data: CostOrderRow[] }>(`/api/v1/reports/cost/orders${periodQs}`),
    retry: (count, error) => {
      if (error instanceof ApiClientError && error.status === 403) return false;
      return count < 1;
    },
  });

  if (query.isLoading) return <Skeleton className="h-56 w-full" />;
  if (query.isError) return null;
  const rows = query.data?.data ?? [];

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{ta('lensOrders')}</h2>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('reportSales')}</TableHeaderCell>
              <TableHeaderCell>{ta('saleValue')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('grossMargin')}</TableHeaderCell>
              <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
              <TableHeaderCell>{ta('coverage')}</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.number}</div>
                  <div className="text-xs text-muted-foreground">{row.productSummary}</div>
                </TableCell>
                <TableNumericCell>{money(locale, row.saleValue)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.actualCost)}</TableNumericCell>
                <TableNumericCell>
                  {money(locale, row.grossMargin)}
                  {row.marginPct != null ? ` (${row.marginPct}%)` : ''}
                </TableNumericCell>
                <TableNumericCell>
                  {hours(row.workerEffortMinutes)}
                  {row.wallClockMinutes != null ? ` / ${hours(row.wallClockMinutes)}` : ''}
                </TableNumericCell>
                <TableCell>
                  {row.coverage === 'FINAL'
                    ? ta('coverageFinal')
                    : row.coverage === 'PARTIAL'
                      ? ta('coveragePartial')
                      : ta('coverageUnpriced')}
                </TableCell>
                <TableCell>
                  <Link href={`/reports/orders/${row.id}`} className="text-sm underline">
                    {ta('openDossier')}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
