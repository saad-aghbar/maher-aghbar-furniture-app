'use client';

import { apiFetch } from '@/lib/api-client';
import { Card, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const t = useTranslations('sales');

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () =>
      apiFetch<{
        number: string;
        status: string;
        productionOrders?: Array<{
          number: string;
          currentStageCode?: string;
          progressPercent: number;
          status: string;
        }>;
      }>(`/api/v1/sales-orders/${params.id}`),
  });

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{data.number}</h1>
      <StatusBadge status={data.status} />
      <Card title={t('tracking')}>
        <ul className="space-y-3">
          {(data.productionOrders ?? []).map((po) => (
            <li key={po.number} className="rounded-md border border-border p-3">
              <p className="font-medium">{po.number}</p>
              <p className="text-sm text-[var(--maher-text-secondary)]">
                {po.currentStageCode ?? '—'} · {po.progressPercent}%
              </p>
              <StatusBadge status={po.status} />
            </li>
          ))}
          {(data.productionOrders ?? []).length === 0 ? (
            <p className="text-sm text-[var(--maher-text-secondary)]">No production yet</p>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
