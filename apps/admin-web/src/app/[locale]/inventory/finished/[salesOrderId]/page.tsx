'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Order = {
  id: string;
  number: string;
  status: string;
};

export default function FinishedOrderPage({ params }: { params: { salesOrderId: string } }) {
  const ti = useTranslations('inventory');
  const query = useQuery({
    queryKey: ['sales-order', params.salesOrderId],
    queryFn: () => apiFetch<Order>(`/api/v1/sales-orders/${params.salesOrderId}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('finishedGoods')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/inventory" title={query.data.number} />
      <InventoryScanBar />
      <Card className="space-y-2 p-4">
        <StatusBadge status={query.data.status} />
        <p className="text-sm text-text-secondary">{ti('finishedGoods')}</p>
      </Card>
    </div>
  );
}
