'use client';

import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  productDescription: string;
  status: string;
  progressPercent: number;
}

export default function ProductionPage() {
  const t = useTranslations('navigation');
  const tp = useTranslations('production');

  return (
    <ListPage<Row>
      title={t('production')}
      queryKey={['production-orders']}
      fetchPath="/api/v1/production-orders"
      emptyTitle={tp('empty')}
      columns={[
        { key: 'number', header: 'Number', render: (r) => r.number },
        { key: 'product', header: 'Product', render: (r) => r.productDescription },
        { key: 'progress', header: 'Progress', render: (r) => `${r.progressPercent}%` },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
