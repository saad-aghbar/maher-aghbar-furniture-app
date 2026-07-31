'use client';

import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function ReportsPage() {
  const t = useTranslations('navigation');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports-sales'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/v1/reports/sales'),
  });
  const financial = useQuery({
    queryKey: ['reports-financial'],
    queryFn: () => apiFetch<{ aging: Record<string, number | string>; paymentsTotal: number | string }>(
      '/api/v1/reports/financial',
    ),
  });

  if (isLoading || financial.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || financial.isError) {
    return (
      <ErrorState
        title={t('reports')}
        description="Failed to load reports"
        onRetry={() => {
          void refetch();
          void financial.refetch();
        }}
      />
    );
  }

  const topCustomers = (data?.topCustomers as Array<{ customerName: string; total: string; orderCount: number }>) ?? [];
  const aging = financial.data?.aging;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('reports')}</h1>
        <div className="flex gap-2 text-sm">
          <a className="text-brand underline" href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/reports/export/sales.csv`}>
            Export sales CSV
          </a>
          <a className="text-brand underline" href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/reports/export/financial.csv`}>
            Export aging CSV
          </a>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Top customers">
          <ul className="space-y-2 text-sm">
            {topCustomers.map((c) => (
              <li key={c.customerName} className="flex justify-between gap-4">
                <span>{c.customerName}</span>
                <span className="font-medium">
                  {c.orderCount} · {c.total} JOD
                </span>
              </li>
            ))}
            {!topCustomers.length ? <li>No sales yet</li> : null}
          </ul>
        </Card>
        <Card title="AR aging">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {aging
              ? Object.entries(aging).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[var(--maher-text-secondary)]">{k}</dt>
                    <dd className="font-medium">{v} JOD</dd>
                  </div>
                ))
              : null}
          </dl>
          <p className="mt-4 text-sm text-[var(--maher-text-secondary)]">
            Payments total: {financial.data?.paymentsTotal ?? 0} JOD
          </p>
        </Card>
      </div>
    </div>
  );
}
