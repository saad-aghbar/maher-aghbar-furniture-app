'use client';

import { PlanLineOutputs } from '@/components/sales-orders/plan-line-outputs';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { productionPlanHref, type ProductionDestinationInput } from '@/lib/production-destination';
import { BoardSkeleton, DetailHero, ErrorBoard } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type ProductionPlanOrder = ProductionDestinationInput & {
  number: string;
  productDescription?: string | null;
  salesOrder?: { id: string; number: string } | null;
};

/** Sales lines open the parent plan. Return and other origins stay on this order. */
export default function ProductionOrderPlanPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tSales = useTranslations('sales');
  const router = useRouter();
  const query = useQuery({
    queryKey: ['production-order', params.id],
    queryFn: () => apiFetch<ProductionPlanOrder>(`/api/v1/production-orders/${params.id}`),
  });
  const order = query.data;
  const href = order
    ? productionPlanHref({
        ...order,
        salesOrderId: order.salesOrder?.id ?? order.salesOrderId,
      })
    : null;

  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);

  if (query.isLoading || href) return <BoardSkeleton rows={4} />;
  if (query.isError || !order) return <ErrorBoard title={t('production')} onRetry={() => query.refetch()} />;

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        LinkComponent={Link}
        back={{ label: t('production'), href: `/admin/production/${order.id}` }}
        code={order.number}
        title={order.productDescription || order.number}
        status={{ label: order.originType || order.status || t('productionPlan'), tone: 'brand' }}
        facts={[{ label: tSales('linkedProduction'), value: order.number, ltr: true }]}
      />
      <PlanLineOutputs productionOrderId={order.id} />
    </div>
  );
}
