'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, Ltr, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type QuoteDetail = {
  id: string;
  number: string;
  status: string;
  lines?: Array<{
    id: string;
    description: string;
    quantity: string | number;
    unitPrice?: string | number;
    manufacturingComplexity?: string | null;
  }>;
};

export default function QuotationLineDeskPage({
  params,
}: {
  params: { id: string; lineId: string };
}) {
  const t = useTranslations('quotations');
  const tc = useTranslations('catalog');
  const query = useQuery({
    queryKey: ['quotation', params.id],
    queryFn: () => apiFetch<QuoteDetail>(`/api/v1/quotations/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('title')} onRetry={() => query.refetch()} />;
  }
  const line = (query.data.lines ?? []).find((row) => row.id === params.lineId);
  if (!line) {
    return <ErrorState title={t('title')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader backHref={`/quotations/${params.id}`} title={line.description} description={query.data.number} />
      <Card className="space-y-2 p-4">
        <StatusBadge status={query.data.status} />
        <Ltr className="text-sm">× {String(line.quantity)}</Ltr>
        <p className="text-sm text-[var(--maher-brand)]">
          {line.manufacturingComplexity === 'CUSTOM'
            ? tc('lineKindCustom')
            : line.manufacturingComplexity === 'MODIFIED'
              ? tc('lineKindCustomized')
              : tc('lineKindStandard')}
        </p>
      </Card>
    </div>
  );
}
