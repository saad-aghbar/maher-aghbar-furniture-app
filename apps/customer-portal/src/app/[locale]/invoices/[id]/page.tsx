'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch, API_URL } from '@/lib/api-client';
import { Link } from '@/i18n/navigation';
import {
  Button,
  Card,
  ErrorState,
  Ltr,
  PageHero,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type InvoiceDetail = {
  id: string;
  number: string;
  status: string;
  total: string | number;
  outstandingAmount?: string | number;
  issueDate?: string | null;
  dueDate?: string | null;
  salesOrder?: { id: string; number: string } | null;
  lines?: Array<{ id: string; description: string; quantity: string | number; unitPrice?: string | number }>;
};

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tAcc = useTranslations('accounting');

  const query = useQuery({
    queryKey: ['customer-invoice', params.id],
    queryFn: () => apiFetch<InvoiceDetail>(`/api/v1/invoices/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('invoices')} onRetry={() => query.refetch()} />;
  }
  const inv = query.data;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/invoices" />
      <PageHero
        tone="soft"
        title={inv.number}
        description={t('invoices')}
        actions={
          <Button
            variant="secondary"
            onClick={() => window.open(`${API_URL}/api/v1/invoices/${inv.id}/pdf`, '_blank')}
          >
            PDF
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={inv.status} />
          <Ltr className="text-lg font-medium">
            {String(inv.total)} {tCommon('currency')}
          </Ltr>
          <span className="text-sm text-text-secondary">
            {tCommon('outstanding')}: {String(inv.outstandingAmount ?? '—')}
          </span>
        </div>
        {inv.salesOrder ? (
          <p className="mt-3 text-sm">
            <Link href={`/orders/${inv.salesOrder.id}`} className="text-brand hover:underline">
              {inv.salesOrder.number}
            </Link>
          </p>
        ) : null}
        <Link href="/payments" className="mt-3 inline-block text-sm text-brand hover:underline">
          {t('payments')}
        </Link>
      </Card>
      {inv.lines?.length ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>{tAcc('description') ?? tCommon('details')}</TableHeaderCell>
              <TableHeaderCell>{tCommon('total')}</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inv.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.description}</TableCell>
                <TableCell dir="ltr">{String(line.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
