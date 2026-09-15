'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useReportsFilterQs } from './reports-chrome';

function money(locale: string, value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(value);
}

export function ReturnsLens() {
  const ta = useTranslations('accounting');
  const locale = useLocale();
  const periodQs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-returns', periodQs],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
          number: string;
          salesOrder: { id: string; number: string } | null;
          pieceCount: number;
          returnGrossCost: number | null;
          recoveredValue: number | null;
          disposedValue: number | null;
        }>;
      }>(`/api/v1/reports/cost/returns${periodQs}`),
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
              <TableHeaderCell>{ta('lensReturns')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('recoveredValue')}</TableHeaderCell>
              <TableHeaderCell>{ta('disposedValue')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/reports/returns/${row.id}${periodQs}`} className="font-medium underline">
                    {row.number}
                  </Link>
                  {row.salesOrder ? (
                    <>
                      {' · '}
                      <Link href={`/orders/${row.salesOrder.id}`} className="text-xs underline">
                        {row.salesOrder.number}
                      </Link>
                    </>
                  ) : null}{' '}
                  · {row.pieceCount}
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
  const periodQs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-products', periodQs],
    queryFn: () =>
      apiFetch<{
        data?: Array<{
          productId: string;
          orderCount: number;
          averageActualCost: number | null;
          lowestActualCost: number | null;
          highestActualCost: number | null;
          averageEffortMinutes: number | null;
          product: { sku: string; nameEn: string } | null;
        }>;
        products: Array<{
          productId: string;
          orderCount: number;
          averageActualCost: number | null;
          lowestActualCost: number | null;
          highestActualCost: number | null;
          averageEffortMinutes: number | null;
          product: { sku: string; nameEn: string } | null;
        }>;
        variants?: Array<{
          variantId: string;
          orderCount: number;
          averageActualCost: number | null;
          variant?: { sku?: string | null; nameEn?: string | null; productId?: string } | null;
        }>;
        byOption?: Array<{
          optionValueId: string;
          optionCode?: string | null;
          optionName?: string | null;
          groupName?: string | null;
          orderCount: number;
          averageActualCost: number | null;
        }>;
      }>(`/api/v1/reports/cost/products${periodQs}`),
    retry: 0,
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!query.data) return null;
  const rows = query.data.data ?? query.data.products;
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">{ta('sectionProducts')}</h2>
        <p className="text-sm text-muted-foreground">{ta('perPieceNote')}</p>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('sectionProducts')}</TableHeaderCell>
              <TableHeaderCell>{ta('orderCount')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
              <TableHeaderCell>{ta('factoryTime')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.productId}>
                <TableCell>
                  <Link
                    href={`/reports/products/${row.productId}${periodQs}`}
                    className="underline"
                  >
                    {row.product?.sku ?? row.productId}
                  </Link>
                </TableCell>
                <TableNumericCell>{row.orderCount}</TableNumericCell>
                <TableNumericCell>
                  {money(locale, row.averageActualCost)}
                  {row.lowestActualCost != null || row.highestActualCost != null
                    ? ` (${money(locale, row.lowestActualCost)} – ${money(locale, row.highestActualCost)})`
                    : ''}
                </TableNumericCell>
                <TableNumericCell>
                  {row.averageEffortMinutes == null ? '—' : `${(row.averageEffortMinutes / 60).toFixed(1)} h`}
                </TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">{ta('variantSlot')}</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('variantSlot')}</TableHeaderCell>
              <TableHeaderCell>{ta('orderCount')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(query.data.variants ?? []).map((row) => (
              <TableRow key={row.variantId}>
                <TableCell>
                  <Link
                    href={`/reports/orders${periodQs}${periodQs ? '&' : '?'}variantId=${row.variantId}`}
                    className="underline"
                  >
                    {row.variant?.sku ?? row.variantId}
                  </Link>
                </TableCell>
                <TableNumericCell>{row.orderCount}</TableNumericCell>
                <TableNumericCell>{money(locale, row.averageActualCost)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(query.data.variants ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{ta('noData')}</p>
        ) : null}
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">{ta('optionSlot')}</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('optionSlot')}</TableHeaderCell>
              <TableHeaderCell>{ta('orderCount')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(query.data.byOption ?? []).map((row) => (
              <TableRow key={row.optionValueId}>
                <TableCell>
                  <Link
                    href={`/reports/orders${periodQs}${periodQs ? '&' : '?'}optionValueId=${row.optionValueId}`}
                    className="underline"
                  >
                    {[row.groupName, row.optionName || row.optionCode].filter(Boolean).join(' · ') ||
                      row.optionValueId}
                  </Link>
                </TableCell>
                <TableNumericCell>{row.orderCount}</TableNumericCell>
                <TableNumericCell>{money(locale, row.averageActualCost)}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(query.data.byOption ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{ta('noData')}</p>
        ) : null}
      </Card>
    </div>
  );
}

export function MaterialsCoverageLens() {
  const ta = useTranslations('accounting');
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['cost-coverage'],
    queryFn: () =>
      apiFetch<{
        totalItems?: number;
        pricedItems?: number;
        pricedCount?: number;
        unpricedCount?: number;
        unpricedItems?: number;
        coveragePct?: number;
        unpriced: Array<{ id?: string; sku: string; nameEn?: string | null }>;
      }>('/api/v1/reports/cost/coverage'),
    retry: 0,
  });
  const backfill = useMutation({
    mutationFn: () => apiFetch('/api/v1/reports/cost/coverage/backfill', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cost-coverage'] }),
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!query.data) return null;
  const priced = query.data.pricedItems ?? query.data.pricedCount ?? 0;
  const total = query.data.totalItems ?? priced + (query.data.unpricedItems ?? query.data.unpricedCount ?? 0);
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">{ta('coverage')}</h2>
      <p>
        {priced}/{total}
        {query.data.coveragePct != null ? ` (${query.data.coveragePct}%)` : ''}
      </p>
      <h3 className="text-sm font-medium">{ta('unpricedSkus')}</h3>
      {query.data.unpriced.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <ul className="text-sm">
          {query.data.unpriced.slice(0, 40).map((item) => (
            <li key={item.id ?? item.sku}>
              {item.id ? (
                <Link href={`/inventory/items/${item.id}`} className="underline">
                  {item.sku}
                </Link>
              ) : (
                item.sku
              )}{' '}
              · {item.nameEn}
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" onClick={() => void backfill.mutateAsync()} disabled={backfill.isPending}>
        {ta('backfillPrices')}
      </Button>
    </Card>
  );
}
