'use client';

import { useRouter } from '@/i18n/navigation';
import { Skeleton } from '@maher/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function RedirectInner({ salesOrderId }: { salesOrderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const lineId = searchParams.get('lineId');
    const qs = lineId ? `?lineId=${encodeURIComponent(lineId)}` : '';
    router.replace(`/admin/sales-orders/${salesOrderId}/production-plan${qs}`);
  }, [router, salesOrderId, searchParams]);

  return <Skeleton className="h-48 w-full" />;
}

export default function SalesOrderProductionSetupRedirect({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <RedirectInner salesOrderId={params.id} />
    </Suspense>
  );
}
