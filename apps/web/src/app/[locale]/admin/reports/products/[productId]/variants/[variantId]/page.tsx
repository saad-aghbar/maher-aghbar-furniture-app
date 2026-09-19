'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { useReportsFilterQs } from '@/components/cost-performance/reports-chrome';
import { Card, ErrorState, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Profile = {
  variant?: { sku?: string; nameEn?: string | null };
  orderCount?: number;
  averageActualCost?: number | null;
};

export default function ReportsVariantProfilePage({
  params,
}: {
  params: { productId: string; variantId: string };
}) {
  const ta = useTranslations('accounting');
  const qs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-variant-profile', params.productId, params.variantId, qs],
    queryFn: () =>
      apiFetch<Profile>(
        `/api/v1/reports/cost/products/${params.productId}/variants/${params.variantId}${qs}`,
      ),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ta('variantSlot')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/reports/products/${params.productId}${qs}`}
        title={query.data.variant?.sku ?? params.variantId}
      />
      <Card className="space-y-2 p-4">
        <p className="text-sm">
          {ta('orderCount')}: {query.data.orderCount ?? 0}
        </p>
        <p className="text-sm" dir="ltr">
          {ta('actualCost')}: {String(query.data.averageActualCost ?? '—')}
        </p>
      </Card>
    </div>
  );
}
