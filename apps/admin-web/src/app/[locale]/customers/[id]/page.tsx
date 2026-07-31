'use client';

import { Link } from '@/i18n/navigation';
import { Card, Skeleton, ErrorState, StatusBadge, Button } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface CustomerDetail {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  customerType: string;
}

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('customers');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer', params.id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/customers/${params.id}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<CustomerDetail>;
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return (
      <ErrorState title={t('detail')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            {tCommon('back')}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <StatusBadge status={data.status} />
      </div>
      <Card title={t('detail')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('code')}</dt>
            <dd className="font-medium">{data.code}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('type')}</dt>
            <dd className="font-medium">{data.customerType}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('email')}</dt>
            <dd className="font-medium">{data.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--maher-text-secondary)]">{t('phone')}</dt>
            <dd className="font-medium">{data.phone ?? '—'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
