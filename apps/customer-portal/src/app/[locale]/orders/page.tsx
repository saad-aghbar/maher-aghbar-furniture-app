'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  status: string;
}

export default function OrdersPage() {
  const t = useTranslations('sales');

  return (
    <ListPage<Row>
      title={t('title')}
      queryKey={['customer-orders-list']}
      fetchPath="/api/v1/sales-orders"
      emptyTitle={t('empty')}
      columns={[
        {
          key: 'number',
          header: t('number'),
          render: (r) => (
            <Link href={`/orders/${r.id}`} className="font-medium text-brand hover:underline">
              {r.number}
            </Link>
          ),
        },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
