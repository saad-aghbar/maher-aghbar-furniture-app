'use client';

import { BackButton } from '@/components/back-button';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Card, EmptyState, ErrorState, PageHero, Skeleton, StatusBadge } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type Item = {
  id: string;
  number: string;
  productDescription: string | null;
  productImageUrl: string | null;
  status: string;
  quantity?: string | number | null;
  product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
};

type Group = {
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  items: Item[];
};

export default function WorkerSalesOrderPage({ params }: { params: { salesOrderId: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const query = useQuery({
    queryKey: ['my-orders', 'open'],
    queryFn: () =>
      apiFetch<{ data?: Group[]; orders?: Group[] }>('/api/v1/tasks/my-orders?segment=open').then(
        (r) => r.data ?? r.orders ?? [],
      ),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError) return <ErrorState title={t('todayTasks')} onRetry={() => query.refetch()} />;
  const group = (query.data ?? []).find((g) => g.salesOrderId === params.salesOrderId);

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/tasks" />
      <PageHero tone="soft" title={group?.salesOrderNumber ?? params.salesOrderId} />
      {!group?.items.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="space-y-3">
          {group.items.map((item) => (
            <Link key={item.id} href={`/lane/${item.id}`}>
              <Card className="flex items-center gap-3 p-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg bg-[var(--maher-surface-muted)]">
                  {item.productImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.productImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {item.product
                      ? localizedName(locale, item.product, item.productDescription ?? item.number)
                      : item.productDescription ?? item.number}
                  </p>
                  <p className="text-xs text-text-secondary" dir="ltr">
                    × {String(item.quantity ?? '')}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
