'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

interface ContractRow {
  id: string;
  number: string;
  status: string;
  contractValue?: string | number;
  startDate?: string | null;
  endDate?: string | null;
  customer?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  salesOrder?: { number: string } | null;
}

export default function ContractsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');

  const listQuery = useQuery({
    queryKey: ['contracts'],
    queryFn: () =>
      apiFetch<{ data: ContractRow[] }>('/api/v1/contracts?pageSize=100').then((r) => r.data),
  });

  if (listQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        title={t('contracts')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('contracts')} description={tc('contractsDescription')} />
      {rows.length === 0 ? (
        <EmptyState title={tc('noContracts')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tc('customer')}</TableHeaderCell>
              <TableHeaderCell>{tc('salesOrder')}</TableHeaderCell>
              <TableHeaderCell>{tc('value')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell dir="ltr">{row.number}</TableCell>
                <TableCell>
                  {row.customer
                    ? localizedName(locale, row.customer, row.customer.name)
                    : '—'}
                </TableCell>
                <TableCell dir="ltr">{row.salesOrder?.number ?? '—'}</TableCell>
                <TableCell dir="ltr">
                  {row.contractValue != null ? Number(row.contractValue).toFixed(2) : '—'}
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
