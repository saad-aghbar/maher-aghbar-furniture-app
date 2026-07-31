'use client';

import { Link } from '@/i18n/navigation';
import { ListPage } from '@/components/list-page';
import { StatusBadge } from '@maher/ui';
import { useTranslations } from 'next-intl';

interface CustomerRow {
  id: string;
  code: string;
  name: string;
  phone?: string;
  status: string;
}

export default function CustomersPage() {
  const t = useTranslations('customers');

  return (
    <ListPage<CustomerRow>
      title={t('title')}
      queryKey={['customers']}
      fetchPath="/api/v1/customers"
      emptyTitle={t('empty')}
      columns={[
        { key: 'code', header: t('code'), render: (r) => r.code },
        {
          key: 'name',
          header: t('name'),
          render: (r) => (
            <Link href={`/customers/${r.id}`} className="font-medium text-brand hover:underline">
              {r.name}
            </Link>
          ),
        },
        { key: 'phone', header: t('phone'), render: (r) => r.phone ?? '—' },
        {
          key: 'status',
          header: t('status'),
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
    />
  );
}
