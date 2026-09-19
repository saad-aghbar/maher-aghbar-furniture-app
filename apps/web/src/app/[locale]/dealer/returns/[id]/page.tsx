'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch } from '@/lib/api-client';
import { Button, Card, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type ReturnDetail = {
  id: string;
  number: string;
  status?: string;
  approvalStatus?: string;
  productDesc?: string;
  quantity?: string | number;
  reason?: string;
  salesOrder?: { id: string; number: string } | null;
  pieces?: Array<{ id: string; decision?: string | null; status?: string }>;
};

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const query = useQuery({
    queryKey: ['customer-return', params.id],
    queryFn: () => apiFetch<ReturnDetail>(`/api/v1/returns/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('returns')} onRetry={() => query.refetch()} />;
  }
  const row = query.data;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/dealer/returns" />
      <PageHero tone="soft" title={row.number} description={row.productDesc} />
      <Card className="space-y-2">
        <StatusBadge status={row.status ?? row.approvalStatus ?? 'OPEN'} />
        <p className="text-sm text-text-secondary">
          {tCommon('status')}: {row.reason ?? '—'}
        </p>
        {row.salesOrder ? (
          <p className="text-sm">
            {row.salesOrder.number} · {String(row.quantity ?? '')}
          </p>
        ) : null}
        {row.pieces?.length ? (
          <ul className="text-sm text-text-secondary">
            {row.pieces.map((p) => (
              <li key={p.id}>
                {p.decision ?? p.status ?? '—'}
              </li>
            ))}
          </ul>
        ) : null}
        <Button variant="secondary" onClick={() => query.refetch()}>
          {tCommon('retry')}
        </Button>
      </Card>
    </div>
  );
}
