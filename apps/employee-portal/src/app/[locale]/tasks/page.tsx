'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { isDeliveryFloorWorker } from '@/lib/is-delivery-floor-worker';
import type { AuthUser } from '@maher/types';
import {
  EmptyState,
  ErrorState,
  Ltr,
  PageHero,
  Skeleton,
  StatusBadge,
  StaggerGrid,
  SurfaceCard,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type WorkerMyOrder = {
  id: string;
  number: string;
  salesOrderId?: string | null;
  salesOrderNumber: string | null;
  productDescription: string | null;
  productImageUrl: string | null;
  status: string;
  quantity?: string | number | null;
  product?: { nameEn?: string | null; nameAr?: string | null; nameHe?: string | null } | null;
};

type WorkerMySalesOrder = {
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  deadline: string | null;
  myTaskCount: number;
  items: WorkerMyOrder[];
};

type DeliveryRow = {
  id: string;
  number: string;
  status: string;
  deliveryAddress?: string | null;
};

export default function TasksPage() {
  const locale = useLocale();
  const t = useTranslations('production');
  const tNav = useTranslations('navigation');
  const tCommon = useTranslations('common');

  const me = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch<AuthUser>('/api/v1/auth/me'),
  });
  const delivery = isDeliveryFloorWorker(me.data);

  const ordersQuery = useQuery({
    queryKey: ['my-orders', 'open'],
    enabled: !delivery,
    queryFn: () =>
      apiFetch<{ data?: WorkerMySalesOrder[]; orders?: WorkerMySalesOrder[] }>(
        '/api/v1/tasks/my-orders?segment=open',
      ).then((r) => r.data ?? r.orders ?? []),
  });

  const deliveriesQuery = useQuery({
    queryKey: ['my-deliveries'],
    enabled: delivery,
    queryFn: () =>
      apiFetch<{ data: DeliveryRow[] }>('/api/v1/deliveries?mine=true&pageSize=50').then(
        (r) => r.data ?? [],
      ),
  });

  if (me.isLoading || ordersQuery.isLoading || deliveriesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (delivery) {
    if (deliveriesQuery.isError) {
      return <ErrorState title={tNav('deliveries')} onRetry={() => deliveriesQuery.refetch()} />;
    }
    const rows = deliveriesQuery.data ?? [];
    return (
      <div className="space-y-4">
        <PageHero tone="soft" title={tNav('deliveries')} />
        {rows.length === 0 ? (
          <EmptyState title={t('empty')} />
        ) : (
          <StaggerGrid className="space-y-3">
            {rows.map((row) => (
              <Link key={row.id} href={`/deliveries/${row.id}`}>
                <SurfaceCard className="p-4">
                  <Ltr className="font-medium">{row.number}</Ltr>
                  <StatusBadge status={row.status} />
                  <p className="text-sm text-text-secondary">{row.deliveryAddress}</p>
                </SurfaceCard>
              </Link>
            ))}
          </StaggerGrid>
        )}
      </div>
    );
  }

  if (ordersQuery.isError) {
    return <ErrorState title={t('todayTasks')} onRetry={() => ordersQuery.refetch()} />;
  }

  const groups = ordersQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHero tone="soft" title={t('todayTasks')} description={tCommon('employeeTasksSubtitle')} />
      {groups.length === 0 ? (
        <EmptyState title={t('empty')} description={tCommon('employeeTasksEmptyHint')} />
      ) : (
        <StaggerGrid className="space-y-3">
          {groups.map((group) => {
            const href = group.salesOrderId
              ? `/orders/${group.salesOrderId}`
              : group.items[0]
                ? `/lane/${group.items[0].id}`
                : '/tasks';
            return (
              <Link key={group.salesOrderId ?? group.items[0]?.id ?? 'g'} href={href}>
                <SurfaceCard className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Ltr className="font-medium">
                      {group.salesOrderNumber ?? group.items[0]?.number}
                    </Ltr>
                    <span className="text-xs text-text-secondary">{group.myTaskCount}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {group.items.slice(0, 4).map((item) => (
                      <li key={item.id} className="truncate">
                        {item.product
                          ? localizedName(locale, item.product, item.productDescription ?? item.number)
                          : item.productDescription ?? item.number}
                      </li>
                    ))}
                  </ul>
                </SurfaceCard>
              </Link>
            );
          })}
        </StaggerGrid>
      )}
    </div>
  );
}
