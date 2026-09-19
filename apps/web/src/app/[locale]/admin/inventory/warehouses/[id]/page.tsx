'use client';

import { PageHeader } from '@/components/admin/page-header';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { apiFetch } from '@/lib/api-client';
import { Card, ErrorState, QrDisplay, Skeleton, StatusBadge } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type Warehouse = {
  id: string;
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  type?: string | null;
  locations?: Array<{ id: string; code: string; name?: string | null; qrCode?: string | null }>;
};

export default function InventoryWarehousePage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const query = useQuery({
    queryKey: ['warehouse', params.id],
    queryFn: () => apiFetch<Warehouse>(`/api/v1/warehouses/${params.id}`),
  });

  if (query.isLoading) return <Skeleton className="h-48 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('warehouses')} onRetry={() => query.refetch()} />;
  }
  const wh = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/admin/warehouses"
        title={localizedName(locale, wh, wh.nameEn)}
        description={wh.code}
      />
      <InventoryScanBar />
      <Card className="space-y-3 p-4">
        {wh.type ? <StatusBadge status={wh.type} /> : null}
        <ul className="grid gap-4 sm:grid-cols-2">
          {(wh.locations ?? []).map((loc) => (
            <li key={loc.id} className="rounded-xl border border-border p-3">
              <p className="font-medium" dir="ltr">
                {loc.code}
              </p>
              <p className="text-sm text-text-secondary">{loc.name}</p>
              {loc.qrCode ? <QrDisplay value={loc.qrCode} size={120} /> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
