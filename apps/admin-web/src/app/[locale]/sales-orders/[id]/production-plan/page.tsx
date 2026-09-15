'use client';

import { OrderProductionSetupView } from '@/components/sales-orders/order-production-setup-view';
import { Skeleton } from '@maher/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PlanInner({ salesOrderId }: { salesOrderId: string }) {
  const searchParams = useSearchParams();
  return (
    <OrderProductionSetupView
      salesOrderId={salesOrderId}
      initialLineId={searchParams.get('lineId')}
    />
  );
}

export default function SalesOrderProductionPlanPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <PlanInner salesOrderId={params.id} />
    </Suspense>
  );
}
