'use client';

import { ProductionFlowMap } from '@/components/workflow/production-flow-map';
import { apiFetch } from '@/lib/api-client';
import { ErrorState, FloorBoard, PageHero, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function SalesOrderFlowPage({ params }: { params: { id: string } }) {
  const t = useTranslations('production');
  const query = useQuery({
    queryKey: ['sales-order-flow', params.id],
    queryFn: () => apiFetch<{ stages?: unknown[] }>(`/api/v1/sales-orders/${params.id}`),
  });
  if (query.isPending) return <Skeleton className="h-48" />;
  if (query.isError) return <ErrorState title={t('title')} onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHero title={t('title')} />
      <FloorBoard>
        <ProductionFlowMap stages={[]} />
      </FloorBoard>
    </div>
  );
}
