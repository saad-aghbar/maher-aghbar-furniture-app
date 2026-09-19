'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useReportsFilterQs } from '@/components/cost-performance/reports-chrome';
import { Card, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableNumericCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Row = {
  id: string;
  sku: string;
  nameEn?: string | null;
  onHandQty?: number;
  availableQty?: number;
  standardCost?: number | null;
};

export default function ReportsInventoryPage() {
  const ta = useTranslations('accounting');
  const qs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-inventory-items', qs],
    queryFn: () =>
      apiFetch<{ data: Row[] }>(`/api/v1/reports/cost/inventory/items${qs}`).then((r) => r.data ?? []),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  const rows = query.data ?? [];

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-medium">{ta('sectionInventory')}</h2>
      {rows.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('sectionInventory')}</TableHeaderCell>
              <TableHeaderCell>{ta('amount')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/reports/inventory/${row.id}${qs}`} className="text-brand hover:underline">
                    {row.sku}
                  </Link>
                </TableCell>
                <TableNumericCell>{String(row.standardCost ?? row.onHandQty ?? '—')}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
