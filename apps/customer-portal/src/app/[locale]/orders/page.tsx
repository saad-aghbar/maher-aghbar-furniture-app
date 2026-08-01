'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface OrderRow {
  id: string;
  number: string;
  status: string;
  productionOrders?: Array<{ currentStageCode?: string; progressPercent?: number }>;
}

export default function OrdersPage() {
  const t = useTranslations('sales');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  return (
    <ListPage<OrderRow>
      title={tNav('orders')}
      description={tCommon('ordersSubtitle')}
      queryKey={['customer-orders']}
      fetchPath="/api/v1/sales-orders?pageSize=50"
      emptyTitle={t('empty')}
      columns={[
        {
          key: 'number',
          header: t('number'),
          render: (row) => (
            <Link href={`/orders/${row.id}`} className="font-medium text-brand hover:underline">
              {row.number}
            </Link>
          ),
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (row) => <StatusBadge status={row.status} />,
        },
        {
          key: 'stage',
          header: t('tracking'),
          render: (row) => {
            const po = row.productionOrders?.[0];
            if (!po) return '—';
            return (
              <span className="text-sm">
                {po.currentStageCode ?? '—'} · {po.progressPercent ?? 0}%
              </span>
            );
          },
        },
      ]}
    />
  );
}
