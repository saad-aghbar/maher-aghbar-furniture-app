'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface DealerDeliveryRow {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  productName?: { name?: string; nameEn?: string | null; nameAr?: string | null };
  calendarDate?: string | null;
  customerStatus?: string;
  committedDeliveryDate?: string | null;
}

export default function DeliveriesPage() {
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const td = useTranslations('production.dealerDelivery');

  return (
    <ListPage<DealerDeliveryRow>
      title={t('deliveries')}
      description={tCommon('deliveriesSubtitle')}
      queryKey={['customer-own-deliveries']}
      fetchPath="/api/v1/scheduling/own-deliveries"
      emptyTitle={tCommon('noDeliveries')}
      emptyDescription={tCommon('noDeliveriesHint')}
      columns={[
        {
          key: 'number',
          header: tSales('number'),
          render: (row) => (
            <Link
              href={`/orders/${row.salesOrderId}`}
              className="font-medium text-brand hover:underline"
            >
              <span dir="ltr">{row.salesOrderNumber}</span>
            </Link>
          ),
        },
        {
          key: 'product',
          header: tSales('description'),
          render: (row) =>
            row.productName?.nameAr || row.productName?.nameEn || row.productName?.name || '—',
        },
        {
          key: 'date',
          header: td('confirmed'),
          render: (row) => (
            <span dir="ltr">
              {row.calendarDate ?? row.committedDeliveryDate?.slice(0, 10) ?? '—'}
            </span>
          ),
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (row) => <StatusBadge status={row.customerStatus ?? ''} />,
        },
      ]}
    />
  );
}
