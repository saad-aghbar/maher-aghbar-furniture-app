'use client';

import { ReturnDetailSheet } from '@/components/returns/return-detail-sheet';
import type { ReturnRow } from '@/components/returns/return-types';
import { apiFetch } from '@/lib/api-client';
import { PermissionGate } from '@/session/permission-gate';
import { ErrorState, FloorBoard, PageHero, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export default function AdminReturnDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('lifecycle');
  const query = useQuery({
    queryKey: ['return', params.id],
    queryFn: () => apiFetch<ReturnRow>(`/api/v1/returns/${params.id}`),
  });

  return (
    <PermissionGate anyOf={['return.read']}>
      <div className="space-y-6">
        <PageHero title={t('returns')} />
        {query.isPending ? <Skeleton className="h-48" /> : null}
        {query.isError ? <ErrorState title={t('returns')} onRetry={() => query.refetch()} /> : null}
        {query.data ? (
          <FloorBoard>
            <ReturnDetailSheet open row={query.data} onClose={() => undefined} />
          </FloorBoard>
        ) : null}
      </div>
    </PermissionGate>
  );
}
