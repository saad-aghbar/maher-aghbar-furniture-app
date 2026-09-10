'use client';

import { apiFetch } from '@/lib/api-client';
import { Card, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableNumericCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

function money(locale: string, value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(value);
}

export function ReturnsLens() {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['cost-returns'],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
          number: string;
          salesOrder: { number: string } | null;
          pieceCount: number;
          returnGrossCost: number | null;
          recoveredValue: number | null;
          disposedValue: number | null;
        }>;
      }>('/api/v1/reports/cost/returns'),
    retry: 0,
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!query.data) return null;
  const rows = query.data.data;
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">{ta('lensReturns')}</h2>
      {rows.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Return</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('recoveredValue')}</TableHeaderCell>
              <TableHeaderCell>{ta('disposedValue')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.number}
                  {row.salesOrder ? ` · ${row.salesOrder.number}` : ''} · {row.pieceCount}
                </TableCell>
                <TableNumericCell>{money(locale, row.returnGrossCost)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.recoveredValue)}</TableNumericCell>
                <TableNumericCell>{money(locale, row.disposedValue)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

export function ProductAnalyticsLens() {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const query = useQuery({
    queryKey: ['cost-products'],
    queryFn: () =>
      apiFetch<{
        products: Array<{
          productId: string;
          orderCount: number;
          averageActualCost: number | null;
          lowestActualCost: number | null;
          highestActualCost: number | null;
          averageEffortMinutes: number | null;
          product: { sku: string; nameEn: string } | null;
        }>;
      }>('/api/v1/reports/cost/products'),
    retry: 0,
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!query.data) return null;
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Products</h2>
      <p className="text-sm text-muted-foreground">{ta('perPieceNote')}</p>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Product</TableHeaderCell>
            <TableHeaderCell>Orders</TableHeaderCell>
            <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data.products.map((row) => (
            <TableRow key={row.productId}>
              <TableCell>{row.product?.sku ?? row.productId}</TableCell>
              <TableNumericCell>{row.orderCount}</TableNumericCell>
              <TableNumericCell>
                {row.averageActualCost == null
                  ? '—'
                  : new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(
                      row.averageActualCost,
                    )}
              </TableNumericCell>
              <TableNumericCell>
                {row.averageEffortMinutes == null ? '—' : `${(row.averageEffortMinutes / 60).toFixed(1)} h`}
              </TableNumericCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function MaterialsCoverageLens() {
  const ta = useTranslations('accounting');
  const query = useQuery({
    queryKey: ['cost-coverage'],
    queryFn: () =>
      apiFetch<{
        totalItems: number;
        pricedItems: number;
        unpricedItems: number;
        coveragePct: number;
        unpriced: Array<{ sku: string; nameEn: string }>;
      }>('/api/v1/reports/cost/coverage'),
    retry: 0,
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!query.data) return null;
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">{ta('lensMaterials')}</h2>
      <p>
        {query.data.pricedItems}/{query.data.totalItems} ({query.data.coveragePct}%)
      </p>
      <h3 className="text-sm font-medium">{ta('unpricedSkus')}</h3>
      {query.data.unpriced.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <ul className="text-sm">
          {query.data.unpriced.slice(0, 40).map((item) => (
            <li key={item.sku}>
              {item.sku} · {item.nameEn}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
