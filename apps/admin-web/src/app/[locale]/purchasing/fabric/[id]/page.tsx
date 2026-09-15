'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, QrDisplay, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Job = {
  id: string;
  state?: string;
  qrCode?: string | null;
  requestedLabel?: string | null;
  remainingQty?: string | number;
  salesOrder?: { id?: string; number?: string } | null;
};

export default function FabricJobDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const query = useQuery({
    queryKey: ['fabric-procurement', params.id],
    queryFn: () => apiFetch<Job>(`/api/v1/fabric-procurements/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={t('fabricJobs')} onRetry={() => query.refetch()} />;
  }
  const job = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/purchasing/fabric"
        title={job.requestedLabel ?? job.qrCode ?? params.id}
        description={job.salesOrder?.number}
      />
      <Card className="space-y-3 p-4">
        <StatusBadge status={job.state ?? 'OPEN'} />
        {job.qrCode ? <QrDisplay value={job.qrCode} /> : null}
      </Card>
    </div>
  );
}
