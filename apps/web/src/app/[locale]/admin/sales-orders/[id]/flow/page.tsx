'use client';

import { salesOrderTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { OrderWorkflowSection } from '@/components/workflow/order-workflow-section';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, DetailHero, ErrorBoard } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface FlowOrder {
  id: string;
  number: string;
  status: string;
  projectName?: string | null;
  customer?: { id: string; name: string; nameAr?: string | null; nameEn?: string | null; nameHe?: string | null } | null;
  productionOrders?: Array<{ id: string; number: string; status: string; progressPercent?: number | null }>;
}

/** One board per production order, each with its live stage map. */
export default function SalesOrderFlowPage({ params }: { params: { id: string } }) {
  const copy = useOrdersCopy();
  const t = useTranslations('production');
  const tSales = useTranslations('sales');
  const query = useQuery({ queryKey: ['sales-order', params.id], queryFn: () => apiFetch<FlowOrder>(`/api/v1/sales-orders/${params.id}`) });

  if (query.isPending) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={1} header={false} className="h-40" />
        <BoardSkeleton rows={4} />
      </div>
    );
  }
  if (query.isError) return <ErrorBoard title={t('title')} onRetry={() => query.refetch()} />;

  const order = query.data;
  const pos = order.productionOrders ?? [];

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        LinkComponent={Link}
        back={{ label: order.number, href: `/admin/sales-orders/${params.id}` }}
        code={order.number}
        title={tSales('desk.viewFlow')}
        subtitle={[order.customer ? localizedName(copy.locale, order.customer, order.customer.name) : null, order.projectName].filter(Boolean).join(' · ') || undefined}
        status={{ label: copy.status(order.status), tone: salesOrderTone(order.status) }}
        facts={[
          { label: tSales('linkedProduction'), value: String(pos.length), ltr: true },
          ...(pos.length ? [{ label: tSales('progress'), value: `${Math.round(pos.reduce((a, p) => a + (p.progressPercent ?? 0), 0) / pos.length)}%`, ltr: true }] : []),
        ]}
      />
      {pos.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={tSales('noProductionYet')} description={tSales('productionSetupRequired')} />
        </Board>
      ) : (
        pos.map((po) => <OrderWorkflowSection key={po.id} productionOrderId={po.id} title={po.number} />)
      )}
    </div>
  );
}
