'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch } from '@/lib/api-client';
import { useRouter } from '@/i18n/navigation';
import { Alert, Button, Card, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Delivery = {
  id: string;
  number: string;
  status: string;
  deliveryAddress?: string | null;
  salesOrder?: { id: string; number: string } | null;
  items?: Array<{ id: string; description: string; quantity: string | number }>;
};

export default function DeliveryReceiptPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['customer-delivery', params.id],
    queryFn: () => apiFetch<Delivery>(`/api/v1/deliveries/${params.id}`),
  });

  const confirm = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/deliveries/${params.id}/confirm-receipt`, {
        method: 'POST',
        body: '{}',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer-delivery', params.id] });
      router.push('/dealer/deliveries');
    },
    onError: (err) => setError(err instanceof Error ? err.message : tCommon('actionFailed')),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('deliveries')} onRetry={() => query.refetch()} />;
  }
  const row = query.data;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/dealer/deliveries" />
      <PageHero tone="soft" title={row.number} />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <Card className="space-y-3">
        <StatusBadge status={row.status} />
        {row.deliveryAddress ? <p className="text-sm">{row.deliveryAddress}</p> : null}
        {row.salesOrder ? <p className="text-sm font-medium">{row.salesOrder.number}</p> : null}
        {row.items?.map((item) => (
          <p key={item.id} className="text-sm text-text-secondary">
            {item.description} · {String(item.quantity)}
          </p>
        ))}
        {row.status !== 'DELIVERED' ? (
          <Button loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {tCommon('confirm')}
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
