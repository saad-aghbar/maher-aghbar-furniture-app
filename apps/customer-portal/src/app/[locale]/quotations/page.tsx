'use client';

import { ListPage } from '@/components/list-page';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface Row {
  id: string;
  number: string;
  version: number;
  status: string;
  total?: string | number;
}

export default function CustomerQuotationsPage() {
  const t = useTranslations('quotations');

  return (
    <ListPage<Row>
      title={t('title')}
      queryKey={['customer-quotations-list']}
      fetchPath="/api/v1/quotations"
      emptyTitle={t('empty')}
      columns={[
        {
          key: 'number',
          header: t('number'),
          render: (r) => (
            <Link href={`/quotations/${r.id}`} className="font-medium text-brand hover:underline">
              {r.number} v{r.version}
            </Link>
          ),
        },
        { key: 'total', header: t('total'), render: (r) => String(r.total ?? '—') },
        { key: 'status', header: t('status'), render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
