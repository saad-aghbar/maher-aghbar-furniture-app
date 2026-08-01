'use client';

import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSkeleton,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface ContractRow {
  id: string;
  number: string;
  status: string;
  contractValue: string | number;
  currency?: string;
  paymentSchedule?: string | null;
  salesOrder?: { id: string; number: string } | null;
}

export default function ContractsPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-contracts'],
    queryFn: () =>
      apiFetch<{ data: ContractRow[] }>('/api/v1/contracts?pageSize=50').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <TableSkeleton columns={4} />
      </div>
    );
  }
  if (isError) {
    return <ErrorState title={t('contracts')} onRetry={() => refetch()} />;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('contracts')} description="Sales contracts linked to your orders." />
      {rows.length === 0 ? (
        <EmptyState title="No contracts yet" />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell>Order</TableHeaderCell>
              <TableHeaderCell>Value</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.number}</TableCell>
                <TableCell>{row.salesOrder?.number ?? '—'}</TableCell>
                <TableCell>
                  {Number(row.contractValue).toLocaleString('ar-JO')}{' '}
                  {row.currency ?? tCommon('currency')}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
