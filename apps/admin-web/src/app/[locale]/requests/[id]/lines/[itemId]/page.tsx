'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type RequestDetail = {
  id: string;
  number: string;
  status: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: string | number;
    notes?: string | null;
    manufacturingComplexity?: string | null;
    variantLabel?: string | null;
  }>;
};

export default function RequestLineDeskPage({
  params,
}: {
  params: { id: string; itemId: string };
}) {
  const t = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const query = useQuery({
    queryKey: ['request', params.id],
    queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('rfqRequests')} onRetry={() => query.refetch()} />;
  }
  const item = query.data.items.find((row) => row.id === params.itemId);
  if (!item) {
    return <ErrorState title={t('rfqRequests')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader backHref={`/requests/${params.id}`} title={item.productName} description={query.data.number} />
      <Card className="space-y-2 p-4">
        <StatusBadge status={query.data.status} />
        <p className="text-sm" dir="ltr">
          × {String(item.quantity)}
        </p>
        {item.variantLabel ? <p className="text-sm text-text-secondary">{item.variantLabel}</p> : null}
        {item.manufacturingComplexity ? (
          <p className="text-sm text-[var(--maher-brand)]">
            {item.manufacturingComplexity === 'CUSTOM'
              ? tc('lineKindCustom')
              : item.manufacturingComplexity === 'MODIFIED'
                ? tc('lineKindCustomized')
                : tc('lineKindStandard')}
          </p>
        ) : null}
        {item.notes ? <p className="text-sm">{item.notes}</p> : null}
      </Card>
    </div>
  );
}
