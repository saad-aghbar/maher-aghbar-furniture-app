'use client';

import { BackButton } from '@/components/back-button';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Alert, Button, Card, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type LaneNode = {
  id: string;
  taskId?: string | null;
  status: string;
  stageCode?: string;
  nameEn?: string;
  nameAr?: string | null;
  lockState?: { kind?: string };
};

type Workflow = {
  number: string;
  productDescription?: string | null;
  lane: LaneNode[];
};

export default function WorkerLanePage({ params }: { params: { id: string } }) {
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const router = useRouter();
  const query = useQuery({
    queryKey: ['my-order-workflow', params.id],
    queryFn: () => apiFetch<Workflow>(`/api/v1/tasks/my-orders/${params.id}/workflow`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={tNav('myLane')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/tasks" />
      <PageHero tone="soft" title={query.data.number} description={query.data.productDescription ?? undefined} />
      <ol className="space-y-2">
        {query.data.lane.map((node) => {
          const needsReceive = node.lockState?.kind === 'needs_receive';
          const href = node.taskId
            ? needsReceive
              ? `/tasks/${node.taskId}/take-in`
              : `/tasks/${node.taskId}`
            : null;
          return (
            <li key={node.id}>
              <Card className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{node.nameEn ?? node.stageCode}</p>
                  <StatusBadge status={node.status} />
                </div>
                {href ? (
                  <Button size="sm" onClick={() => router.push(href)}>
                    {needsReceive ? tNav('takeIn') : t('startTask')}
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
