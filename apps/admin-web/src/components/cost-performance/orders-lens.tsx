'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import {
  Button,
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
import { useMemo, useState } from 'react';
import { useReportsFilterQs } from './reports-chrome';

export type CostOrderRow = {
  id: string;
  number: string;
  status: string;
  orderDate: string;
  dealer?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
  productSummary: string;
  quantity: number;
  actualCost: number | null;
  plannedCost: number | null;
  variance: number | null;
  saleValue: number | null;
  grossMargin: number | null;
  marginPct: number | null;
  coverage: 'FINAL' | 'PARTIAL' | 'UNPRICED';
  labor: number | null;
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

type SortKey = 'number' | 'saleValue' | 'plannedCost' | 'actualCost' | 'variance' | 'grossMargin';

export function OrdersLens() {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const periodQs = useReportsFilterQs();
  const [sort, setSort] = useState<SortKey>('number');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['cost-orders', periodQs, page],
    queryFn: () =>
      apiFetch<{ data: CostOrderRow[]; meta?: { page: number; pageSize: number; totalItems: number } }>(
        `/api/v1/reports/cost/orders${periodQs}${periodQs ? '&' : '?'}page=${page}&pageSize=50`,
      ),
    retry: (count, error) => {
      if (error instanceof ApiClientError && error.status === 403) return false;
      return count < 1;
    },
  });

  const rows = useMemo(() => {
    const list = [...(query.data?.data ?? [])];
    list.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === 'number' && typeof bv === 'number') return bv - av;
      return String(av ?? '').localeCompare(String(bv ?? ''));
    });
    return list;
  }, [query.data, sort]);

  if (query.isLoading) return <Skeleton className="h-56 w-full" />;
  if (query.isError) return null;

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
              {(
                [
                  ['number', ta('lensOrders')],
                  ['saleValue', ta('saleValue')],
                  ['plannedCost', ta('plannedCost')],
                  ['actualCost', ta('actualCost')],
                  ['variance', ta('variance')],
                  ['grossMargin', ta('grossMargin')],
                ] as const
              ).map(([key, label]) => (
                <TableHeaderCell key={key}>
                  <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSort(key)}>
                    {label}
                  </button>
                </TableHeaderCell>
              ))}
              <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
              <TableHeaderCell>{ta('laborCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('coverage')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/reports/orders/${row.id}${periodQs}`} className="font-medium underline">
                    {row.number}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.productSummary}</div>
                </TableCell>
                <TableNumericCell>{money(locale, row.saleValue)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.plannedCost)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.actualCost)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.variance)}</TableNumericCell>
                <TableNumericCell>
                  {money(locale, row.grossMargin)}
                  {row.marginPct != null ? ` (${row.marginPct}%)` : ''}
                </TableNumericCell>
                <TableNumericCell>
                  {hours(row.workerEffortMinutes)}
                  {row.wallClockMinutes != null ? ` / ${hours(row.wallClockMinutes)}` : ''}
                </TableNumericCell>
                <TableNumericCell>{money(locale, row.labor)}</TableNumericCell>
                <TableCell>
                  {row.coverage === 'FINAL'
                    ? ta('coverageFinal')
                    : row.coverage === 'PARTIAL'
                      ? ta('coveragePartial')
                      : ta('coverageUnpriced')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="subtle" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ←
        </Button>
        <Button
          size="sm"
          variant="subtle"
          disabled={(query.data?.data?.length ?? 0) < 50}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </Button>
      </div>
    </Card>
  );
}
