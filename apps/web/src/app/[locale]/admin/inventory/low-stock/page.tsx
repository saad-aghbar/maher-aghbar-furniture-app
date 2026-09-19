'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { EmptyState, ErrorState, PageHero, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type Item = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  minStock?: string | number;
  onHandQty?: number;
};

export default function LowStockPage() {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const t = useTranslations('navigation');
  const query = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () =>
      apiFetch<{ data: Item[] }>('/api/v1/inventory/items?lowStock=true&pageSize=100').then(
        (r) => r.data ?? [],
      ),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState title={t('lowStock')} onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero title={t('lowStock')} description={ti('lowStockHint')} tone="soft" />
      <InventoryScanBar />
      {rows.length === 0 ? (
        <EmptyState title={ti('empty')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ti('sku')}</TableHeaderCell>
              <TableHeaderCell>{ti('name')}</TableHeaderCell>
              <TableHeaderCell>{ti('onHand')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/inventory/items/${row.id}`} className="text-brand hover:underline">
                    {row.sku}
                  </Link>
                </TableCell>
                <TableCell>{localizedName(locale, row, row.nameEn)}</TableCell>
                <TableCell dir="ltr">{String(row.onHandQty ?? '—')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
