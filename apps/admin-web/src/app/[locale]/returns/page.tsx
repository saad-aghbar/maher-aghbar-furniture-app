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

interface ReturnRow {
  id: string;
  number: string;
  productDesc: string;
  quantity: string | number;
  reason: string;
  approvalStatus?: string;
  customer?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  salesOrder?: { number: string } | null;
}

export default function ReturnsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');

  const listQuery = useQuery({
    queryKey: ['returns'],
    queryFn: () =>
      apiFetch<{ data: ReturnRow[] }>('/api/v1/returns?pageSize=100').then((r) => r.data),
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
        title={t('returns')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data ?? [];

  function reasonLabel(reason: string) {
    try {
      return tc(`returnReason.${reason}` as 'returnReason.OTHER');
    } catch {
      return reason;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('returns')} description={tc('returnsDescription')} />
      {rows.length === 0 ? (
        <EmptyState title={tc('noReturns')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tc('customer')}</TableHeaderCell>
              <TableHeaderCell>{tc('product')}</TableHeaderCell>
              <TableHeaderCell>{tc('qty')}</TableHeaderCell>
              <TableHeaderCell>{tc('reason')}</TableHeaderCell>
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
                <TableCell>{row.productDesc}</TableCell>
                <TableCell dir="ltr">{Number(row.quantity)}</TableCell>
                <TableCell>{reasonLabel(row.reason)}</TableCell>
                <TableCell>
                  <StatusBadge status={row.approvalStatus ?? 'PENDING'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
