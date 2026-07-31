'use client';

import { Link } from '@/i18n/navigation';
import { Card, MetricCard, Skeleton, ErrorState } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function CustomerDashboard() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-me'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/me`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('auth');
      return res.json() as Promise<{ name: string }>;
    },
  });

  const quotes = useQuery({
    queryKey: ['customer-quotations'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/quotations`,
        { credentials: 'include' },
      );
      if (!res.ok) return { data: [] };
      return res.json() as Promise<{ data: unknown[] }>;
    },
  });

  const orders = useQuery({
    queryKey: ['customer-orders'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/sales-orders`,
        { credentials: 'include' },
      );
      if (!res.ok) return { data: [] };
      return res.json() as Promise<{ data: unknown[] }>;
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError) {
    return <ErrorState title={t('dashboard')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tCommon('welcome')}</h1>
        <p className="text-sm text-[var(--maher-text-secondary)]">{data?.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard label={t('myQuotes')} value={quotes.data?.data?.length ?? 0} />
        <MetricCard label={t('orders')} value={orders.data?.data?.length ?? 0} />
      </div>
      <Card title={t('requestQuote')}>
        <Link href="/quotations/request" className="text-brand hover:underline">
          {t('requestQuote')} →
        </Link>
      </Card>
    </div>
  );
}
