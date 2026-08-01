'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface DeliveryRow {
  id: string;
  number: string;
  status: string;
  deliveryAddress?: string;
  deliveryDate?: string;
  salesOrder?: { id: string; number: string };
}

export default function DeliveriesPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  return (
    <ListPage<DeliveryRow>
      title={t('deliveries')}
      description={tCommon('deliveriesSubtitle')}
      queryKey={['customer-deliveries']}
      fetchPath="/api/v1/deliveries?pageSize=50"
      emptyTitle={tCommon('noDeliveries')}
      emptyDescription={tCommon('noDeliveriesHint')}
      columns={[
        {
          key: 'number',
          header: t('deliveries'),
          render: (row) =>
            row.salesOrder ? (
              <Link
                href={`/orders/${row.salesOrder.id}`}
                className="font-medium text-brand hover:underline"
              >
                {row.number}
              </Link>
            ) : (
              row.number
            ),
        },
        {
          key: 'address',
          header: tCommon('address'),
          render: (row) => row.deliveryAddress ?? '—',
        },
        {
          key: 'date',
          header: tCommon('date'),
          render: (row) => row.deliveryDate?.slice(0, 10) ?? '—',
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (row) => <StatusBadge status={row.status} />,
        },
      ]}
    />
  );
}
