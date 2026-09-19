'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { apiFetch } from '@/lib/api-client';
import { Button, Card, ErrorState, Skeleton, StatusBadge } from '@maher/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

function ReceiveAction({ poId, onDone }: { poId: string; onDone: () => void }) {
  const ti = useTranslations('inventory');
  const receive = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/purchase-orders/${poId}/goods-receipts`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: onDone,
  });
  return (
    <Button onClick={() => receive.mutate()} loading={receive.isPending}>
      {ti('receive')}
    </Button>
  );
}

type PO = {
  id: string;
  number: string;
  status: string;
  lines?: Array<{ id: string; description: string; quantity: string | number }>;
};

export default function InventoryReceivePoPage({ params }: { params: { id: string } }) {
  const ti = useTranslations('inventory');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['purchase-order', params.id],
    queryFn: () => apiFetch<PO>(`/api/v1/purchase-orders/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('receive')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/admin/inventory/receive" title={query.data.number} />
      <InventoryScanBar />
      <Card className="space-y-2 p-4">
        <StatusBadge status={query.data.status} />
        <ul className="text-sm">
          {(query.data.lines ?? []).map((line) => (
            <li key={line.id} className="flex justify-between gap-2 py-1">
              <span>{line.description}</span>
              <span dir="ltr">× {String(line.quantity)}</span>
            </li>
          ))}
        </ul>
        <ReceiveAction poId={query.data.id} onDone={() => queryClient.invalidateQueries({ queryKey: ['purchase-order', params.id] })} />
      </Card>
    </div>
  );
}
