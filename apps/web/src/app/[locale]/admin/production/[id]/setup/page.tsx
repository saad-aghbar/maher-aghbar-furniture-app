'use client';

import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { productionSetupHref, type ProductionDestinationInput } from '@/lib/production-destination';
import { BoardSkeleton, ErrorBoard } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type SetupOrder = ProductionDestinationInput & {
  salesOrder?: { id: string } | null;
};

/** Unreleased sales work opens the parent plan. Unreleased return work opens this order's plan. */
export default function ProductionSetupRedirect({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const router = useRouter();
  const query = useQuery({
    queryKey: ['production-order', params.id],
    queryFn: () => apiFetch<SetupOrder>(`/api/v1/production-orders/${params.id}`),
  });
  const href = query.data
    ? productionSetupHref({
        ...query.data,
        salesOrderId: query.data.salesOrder?.id ?? query.data.salesOrderId,
      })
    : null;

  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);

  if (query.isError) return <ErrorBoard title={t('production')} onRetry={() => query.refetch()} />;
  return <BoardSkeleton rows={4} />;
}
