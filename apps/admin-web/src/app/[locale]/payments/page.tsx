'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  Skeleton,
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

interface PaymentRow {
  id: string;
  number: string;
  amount: string | number;
  method?: string | null;
  referenceNumber?: string | null;
  paymentDate?: string;
  createdAt?: string;
  customer?: {
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  invoice?: { number: string } | null;
}

export default function PaymentsPage() {
  const locale = useLocale();
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const ta = useTranslations('accounting');
  const tCommon = useTranslations('common');

  const listQuery = useQuery({
    queryKey: ['payments'],
    queryFn: () =>
      apiFetch<{ data: PaymentRow[] }>('/api/v1/payments?pageSize=100').then((r) => r.data),
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
        title={t('payments')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('payments')} description={tc('paymentsDescription')} />
      {rows.length === 0 ? (
        <EmptyState title={tc('noPayments')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tc('customer')}</TableHeaderCell>
              <TableHeaderCell>{tc('invoice')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
              <TableHeaderCell>{tc('paymentMethod')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('date')}</TableHeaderCell>
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
                <TableCell dir="ltr">{row.invoice?.number ?? '—'}</TableCell>
                <TableCell dir="ltr">{Number(row.amount).toFixed(2)}</TableCell>
                <TableCell>
                  {row.method
                    ? ta(`method${row.method}` as 'methodCASH')
                    : '—'}
                </TableCell>
                <TableCell dir="ltr">
                  {(row.paymentDate ?? row.createdAt)?.slice(0, 10) ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
