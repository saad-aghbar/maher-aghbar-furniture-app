'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { PageHeader } from '@/components/admin/page-header';
import { apiFetch, apiUpload, API_URL } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  CameraCapture,
  Card,
  ErrorState,
  QrDisplay,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Item = {
  id: string;
  sku: string;
  barcode?: string | null;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  balances?: Array<{
    availableQty: string | number;
    warehouse?: { code: string; nameEn?: string; nameAr?: string };
  }>;
};

export default function InventoryItemPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['inventory-item', params.id],
    queryFn: () => apiFetch<Item>(`/api/v1/inventory/items/${params.id}`),
  });

  const photo = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiUpload<{ downloadPath: string }>(
        `/api/v1/uploads?category=INVENTORY_IMAGE&inventoryItemId=${params.id}`,
        form,
      );
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['inventory-item', params.id] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <Skeleton className="h-64 w-full" />;
  if (query.isError || !query.data) {
    return <ErrorState title={ti('item')} onRetry={() => query.refetch()} />;
  }
  const item = query.data;
  const qrValue = item.barcode?.trim() || item.sku;

  return (
    <div className="space-y-6">
      <PageHeader backHref="/inventory" title={localizedName(locale, item, item.nameEn)} description={item.sku} />
      <InventoryScanBar />
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <Card className="space-y-3 p-4">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="aspect-[5/4] w-full rounded-xl object-cover" />
          ) : null}
          <CameraCapture
            label={tCommon('takePhoto')}
            onUploadFile={async (file: File) => {
              await photo.mutateAsync(file);
            }}
          />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{ti('warehouse')}</TableHeaderCell>
                <TableHeaderCell>{ti('available')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(item.balances ?? []).map((b, i) => (
                <TableRow key={`${item.id}-${i}`}>
                  <TableCell>{b.warehouse?.code ?? '—'}</TableCell>
                  <TableCell dir="ltr">{String(b.availableQty)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-4">
          <QrDisplay value={qrValue} label={ti('itemQr')} />
        </Card>
      </div>
    </div>
  );
}
