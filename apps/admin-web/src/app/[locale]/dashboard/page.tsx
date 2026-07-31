'use client';

import { MetricCard, Skeleton, ErrorState } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface DashboardMetrics {
  activeOrders: number;
  ordersDueSoon: number;
  delayedProduction: number;
  waitingMaterials: number;
  pendingQuoteApprovals: number;
  outstandingInvoices: number;
  lowStock: number;
  criticalBlockers: number;
  dailyCompletions: number;
}

export default function DashboardPage() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/reports/dashboard`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<DashboardMetrics>;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title={t('dashboard')}
        description={tCommon('noResults')}
        onRetry={() => refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const metrics = [
    { label: 'أوامر نشطة', value: data.activeOrders },
    { label: 'تسليم قريب', value: data.ordersDueSoon },
    { label: 'إنتاج متأخر', value: data.delayedProduction },
    { label: 'بانتظار مواد', value: data.waitingMaterials },
    { label: 'عروض بانتظار اعتماد', value: data.pendingQuoteApprovals },
    { label: 'فواتير مستحقة', value: data.outstandingInvoices },
    { label: 'مخزون منخفض', value: data.lowStock },
    { label: 'عوائق حرجة', value: data.criticalBlockers },
    { label: 'إنجاز اليوم', value: data.dailyCompletions },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <p className="mt-1 text-sm text-[var(--maher-text-secondary)]">{tCommon('welcome')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  );
}
