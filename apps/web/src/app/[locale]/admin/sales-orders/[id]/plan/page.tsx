'use client';

import { useRouter } from '@/i18n/navigation';
import { Skeleton } from '@maher/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function PlanAlias({ salesOrderId }: { salesOrderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(`/admin/sales-orders/${salesOrderId}/production-plan${qs ? `?${qs}` : ''}`);
  }, [router, salesOrderId, searchParams]);

  return <Skeleton className="h-48 w-full" />;
}

/** Old menu links used `/plan`. The page is `/production-plan`. */
export default function SalesOrderPlanAlias({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <PlanAlias salesOrderId={params.id} />
    </Suspense>
  );
}
