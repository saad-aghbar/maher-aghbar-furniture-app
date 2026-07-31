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
  customer?: { name: string };
}

export default function InvoicesPage() {
  const t = useTranslations('navigation');
  const ta = useTranslations('accounting');

  return (
    <ListPage<Row>
      title={t('invoices')}
      queryKey={['invoices']}
      fetchPath="/api/v1/invoices"
      emptyTitle={ta('empty')}
      columns={[
        { key: 'number', header: ta('invoiceNumber'), render: (r) => r.number },
        { key: 'customer', header: 'Customer', render: (r) => r.customer?.name ?? '—' },
        { key: 'total', header: ta('amount'), render: (r) => String(r.total ?? '—') },
        { key: 'outstanding', header: 'Outstanding', render: (r) => String(r.outstandingAmount ?? '—') },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
