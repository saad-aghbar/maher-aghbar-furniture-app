'use client';

import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  status: string;
  total?: string | number;
  customer?: { name: string };
}

export default function SalesOrdersPage() {
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');

  return (
    <ListPage<Row>
      title={t('salesOrders')}
      queryKey={['sales-orders']}
      fetchPath="/api/v1/sales-orders"
      emptyTitle={tSales('empty')}
      columns={[
        {
          key: 'number',
          header: tSales('number'),
          render: (r) => (
            <span className="font-medium text-brand">{r.number}</span>
          ),
        },
        { key: 'customer', header: tSales('customer'), render: (r) => r.customer?.name ?? '—' },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'total', header: tSales('total'), render: (r) => String(r.total ?? '—') },
      ]}
    />
  );
}
