'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type PO = {
  id: string;
  number: string;
  status: string;
  supplier?: { name?: string | null } | null;
};

export default function InventoryReceivePage() {
  const t = useTranslations('navigation');
  const ti = useTranslations('inventory');
  const query = useQuery({
    queryKey: ['purchase-orders-receive'],
    queryFn: () =>
      apiFetch<{ data: PO[] }>('/api/v1/purchase-orders?pageSize=50').then((r) => r.data ?? []),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState title={t('receive')} onRetry={() => query.refetch()} />;
  const rows = (query.data ?? []).filter((row) =>
    ['SENT', 'CONFIRMED', 'PARTIAL'].includes(row.status),
  );

  return (
    <div className="space-y-6">
      <PageHero title={t('receive')} tone="soft" />
      <InventoryScanBar />
      {rows.length === 0 ? (
        <EmptyState title={ti('empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Link key={row.id} href={`/admin/inventory/receive/${row.id}`}>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium" dir="ltr">
                    {row.number}
                  </p>
                  <p className="text-sm text-text-secondary">{row.supplier?.name}</p>
                </div>
                <StatusBadge status={row.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
