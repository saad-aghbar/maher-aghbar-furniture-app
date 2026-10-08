'use client';

import { useRouter } from '@/i18n/navigation';
import { Skeleton } from '@maher/ui';
import { useEffect } from 'react';

/** Old menu links used `/plan`. The page is `/production-plan`. */
export default function SalesOrderPlanAlias({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/sales-orders/${params.id}/production-plan`);
  }, [router, params.id]);

  return <Skeleton className="h-48 w-full" />;
}
