'use client';

import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  outstandingAmount?: string | number;
}

export default function CustomerInvoicesPage() {
  const t = useTranslations('accounting');

  return (
    <ListPage<Row>
      title={t('invoices')}
      queryKey={['customer-invoices']}
      fetchPath="/api/v1/invoices"
      emptyTitle={t('empty')}
      columns={[
        { key: 'number', header: t('invoiceNumber'), render: (r) => r.number },
        { key: 'total', header: t('amount'), render: (r) => String(r.total ?? '—') },
        { key: 'out', header: 'Outstanding', render: (r) => String(r.outstandingAmount ?? '—') },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
