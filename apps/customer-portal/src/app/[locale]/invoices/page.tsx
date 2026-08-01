'use client';

import { apiFetch, API_URL } from '@/lib/api-client';
import {
  Button,
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

interface Invoice {
  id: string;
  number: string;
  total: string | number;
  outstandingAmount?: string | number;
  status: string;
}

export default function InvoicesPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-invoices'],
    queryFn: async () => {
      const json = await apiFetch<{ data: Invoice[] } | Invoice[]>('/api/v1/invoices?pageSize=50');
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <TableSkeleton columns={5} />
      </div>
    );
  }
  if (isError) {
    return <ErrorState title={t('invoices')} onRetry={() => refetch()} />;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('invoices')} description={tCommon('invoicesSubtitle')} />
      {rows.length === 0 ? (
        <EmptyState title={tCommon('emptyList')} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tCommon('number')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('outstanding')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('status')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('actions')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.number}</TableCell>
                <TableCell>
                  {String(row.total)} {tCommon('currency')}
                </TableCell>
                <TableCell>{String(row.outstandingAmount ?? '—')}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      window.open(`${API_URL}/api/v1/invoices/${row.id}/pdf`, '_blank')
                    }
                  >
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
