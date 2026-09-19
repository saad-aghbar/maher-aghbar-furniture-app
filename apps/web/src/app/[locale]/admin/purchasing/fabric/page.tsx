'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { EmptyState, ErrorState, PageHero, Skeleton, StatusBadge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Job = {
  id: string;
  state?: string;
  qrCode?: string | null;
  salesOrder?: { number?: string } | null;
  requestedLabel?: string | null;
};

export default function FabricJobsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const query = useQuery({
    queryKey: ['fabric-procurements'],
    queryFn: () => apiFetch<Job[] | { data: Job[] }>('/api/v1/fabric-procurements').then((json) =>
      Array.isArray(json) ? json : json.data ?? [],
    ),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState title={t('fabricJobs')} onRetry={() => query.refetch()} />;
  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero title={t('fabricJobs')} tone="soft" />
      {rows.length === 0 ? (
        <EmptyState title={t('fabricJobs')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{t('fabricJobs')}</TableHeaderCell>
              <TableHeaderCell>{t('salesOrders')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/purchasing/fabric/${row.id}`} className="text-brand hover:underline">
                    {row.requestedLabel ?? row.qrCode ?? row.id}
                  </Link>
                </TableCell>
                <TableCell>{row.salesOrder?.number ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={row.state ?? 'OPEN'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
