'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { useReportsFilterQs } from '@/components/cost-performance/reports-chrome';
import { Card, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableNumericCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Row = {
  id: string;
  number?: string;
  description?: string | null;
  actualCost?: number | null;
  quantity?: number;
};

export default function ReportsCustomWorkPage() {
  const ta = useTranslations('accounting');
  const qs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-custom-work', qs],
    queryFn: () =>
      apiFetch<{ data: Row[] }>(`/api/v1/reports/cost/custom-work${qs}`).then((r) => r.data ?? []),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  const rows = query.data ?? [];

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-lg font-medium">{ta('sectionCustom')}</h2>
      {rows.length === 0 ? (
        <EmptyState title={ta('noData')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{ta('sectionCustom')}</TableHeaderCell>
              <TableHeaderCell>{ta('actualCost')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/reports/orders/${row.id}${qs}`} className="text-brand hover:underline">
                    {row.number ?? row.description ?? row.id}
                  </Link>
                </TableCell>
                <TableNumericCell>{String(row.actualCost ?? '—')}</TableNumericCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
