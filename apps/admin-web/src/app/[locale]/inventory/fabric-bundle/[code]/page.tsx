'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, QrDisplay, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

type Bundle = {
  id: string;
  qrCode?: string;
  status?: string;
  remainingQty?: string | number;
  fabricProcurement?: { id?: string; state?: string } | null;
};

export default function FabricBundlePage({ params }: { params: { code: string } }) {
  const ti = useTranslations('inventory');
  const code = decodeURIComponent(params.code);
  const query = useQuery({
    queryKey: ['fabric-bundle', code],
    queryFn: () => apiFetch<Bundle>(`/api/v1/fabric-procurements/by-code/${encodeURIComponent(code)}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('fabricBundle')} onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader backHref="/purchasing/fabric" title={ti('fabricBundle')} description={code} />
      <InventoryScanBar />
      <Card className="space-y-3 p-4">
        <StatusBadge status={query.data.status ?? query.data.fabricProcurement?.state ?? 'OPEN'} />
        <p className="text-sm" dir="ltr">
          {String(query.data.remainingQty ?? '')}
        </p>
        <QrDisplay value={query.data.qrCode ?? code} />
      </Card>
    </div>
  );
}
