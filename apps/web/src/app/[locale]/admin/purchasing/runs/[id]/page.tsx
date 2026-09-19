'use client';

import { apiFetch } from '@/lib/api-client';
import { ErrorState, FloorBoard, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Run = { id: string; status?: string; purchaseOrders?: Array<{ id: string; number: string }> };

export default function PurchaseRunPage({ params }: { params: { id: string } }) {
  const t = useTranslations('purchasing');
  const title = t('newOrder');
  const query = useQuery({
    queryKey: ['purchase-run', params.id],
    queryFn: () => apiFetch<Run>(`/api/v1/purchase-runs/${params.id}`),
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.isError || !query.data) return <ErrorState title={title} onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHero title={title} />
      <FloorBoard header={query.data.status ? <StatusBadge status={query.data.status} /> : null}>
        <ul className="space-y-2 text-sm">
          {(query.data.purchaseOrders ?? []).map((po) => (
            <li key={po.id} dir="ltr">
              {po.number}
            </li>
          ))}
        </ul>
      </FloorBoard>
    </div>
  );
}
