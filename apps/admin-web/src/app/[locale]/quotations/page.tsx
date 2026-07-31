'use client';

import { Link } from '@/i18n/navigation';
import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface QuotationRow {
  id: string;
  number: string;
  customerName: string;
  total: number;
  status: string;
}

export default function QuotationsPage() {
  const t = useTranslations('quotations');
  const tCommon = useTranslations('common');

  return (
    <ListPage<QuotationRow>
      title={t('title')}
      queryKey={['quotations']}
      fetchPath="/api/v1/quotations"
      emptyTitle={t('empty')}
      columns={[
        {
          key: 'number',
          header: t('number'),
          render: (r) => (
            <Link href={`/quotations/${r.id}`} className="font-medium text-brand hover:underline">
              {r.number}
            </Link>
          ),
        },
        { key: 'customer', header: t('customer'), render: (r) => r.customerName },
        {
          key: 'total',
          header: t('total'),
          render: (r) => `${r.total.toLocaleString('ar-JO')} ${tCommon('currency')}`,
        },
        {
          key: 'status',
          header: tCommon('status'),
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}
