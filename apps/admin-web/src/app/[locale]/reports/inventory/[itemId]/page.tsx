'use client';

import { PageHeader } from '@/components/admin/page-header';
import { apiFetch } from '@/lib/api-client';
import { useReportsFilterQs } from '@/components/cost-performance/reports-chrome';
import { Card, ErrorState, Skeleton } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Profile = {
  sku?: string;
  nameEn?: string | null;
  onHandQty?: number;
  standardCost?: number | null;
  flow?: Array<{ date: string; qty: number; cost: number | null }>;
};

export default function ReportsInventoryItemPage({ params }: { params: { itemId: string } }) {
  const ta = useTranslations('accounting');
  const qs = useReportsFilterQs();
  const query = useQuery({
    queryKey: ['cost-inventory-item', params.itemId, qs],
    queryFn: () => apiFetch<Profile>(`/api/v1/reports/cost/inventory/items/${params.itemId}${qs}`),
    retry: 0,
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ta('sectionInventory')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader backHref={`/reports/inventory${qs}`} title={query.data.sku ?? params.itemId} description={query.data.nameEn ?? undefined} />
      <Card className="p-4">
        <p className="text-sm" dir="ltr">
          {ta('amount')}: {String(query.data.standardCost ?? '—')}
        </p>
      </Card>
    </div>
  );
}
