'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Semi = {
  productionOrderId?: string;
  number?: string;
  status?: string;
  kits?: Array<{ id: string; qrCode?: string; status?: string }>;
};

export default function SemiOrderPage({ params }: { params: { orderId: string } }) {
  const ti = useTranslations('inventory');
  const query = useQuery({
    queryKey: ['semi-order', params.orderId],
    queryFn: () =>
      apiFetch<Semi>(`/api/v1/production-orders/${params.orderId}`).catch(() => null),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('semiFinished')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/inventory" title={query.data.number ?? params.orderId} />
      <InventoryScanBar />
      <Card className="space-y-2 p-4">
        <StatusBadge status={query.data.status ?? 'IN_PROGRESS'} />
        <p className="text-sm text-text-secondary">{ti('semiFinished')}</p>
      </Card>
    </div>
  );
}
