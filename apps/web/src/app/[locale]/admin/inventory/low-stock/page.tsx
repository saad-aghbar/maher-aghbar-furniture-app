'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Button, DataBoard, ErrorBoard, Figure, Ltr, Meter, Stamp, useToast } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type Item = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  unit?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  materialGroup?: string | null;
  minStock?: string | number | null;
  reorderQty?: string | number | null;
  onHandQty?: number;
  availableQty?: number;
  reservedQty?: number;
};

/**
 * Low stock — raw materials at or under their minimum. Reads the dedicated
 * `GET /inventory/low-stock` (same source as mobile) and offers the one action
 * that matters here: raise a purchase request for everything on the list.
 */
export default function LowStockPage() {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => apiFetch<Item[]>('/api/v1/inventory/low-stock'),
  });
  const orderMaterials = useMutation({
    mutationFn: () => apiFetch<{ id: string }>('/api/v1/purchase-requests/from-low-stock', { method: 'POST' }),
    onSuccess: async (created) => {
      toast.success(ti('orderMaterialsCreated'));
      await qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      if (created?.id) router.push(`/admin/purchasing/${created.id}`);
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError) return <ErrorBoard title={t('lowStock')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />;
  const rows = [...(query.data ?? [])].sort((a, b) => ratio(a) - ratio(b));
  const outCount = rows.filter((r) => Number(r.onHandQty ?? 0) <= 0).length;

  return (
    <div className="maher-stagger space-y-5">
      <Board tone={rows.length ? (outCount ? 'error' : 'warning') : 'success'} wash="top">
        <Board.Body className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0 max-w-xl">
            <h1 className="m-0 text-[26px] font-semibold leading-8 text-[var(--maher-text-primary)]">{t('lowStock')}</h1>
            <p className="mt-1 text-[14px] leading-5 text-[var(--maher-text-secondary)]">{ti('lowStockHint')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-6">
            <Figure value={rows.length} label={ti('lowStock')} tone={rows.length ? 'warning' : 'success'} />
            <Figure value={outCount} label={ti('outOfStock')} tone={outCount ? 'error' : 'neutral'} />
            {rows.length ? (
              <Button leadingIcon={<ShoppingCart className="h-4 w-4" />} loading={orderMaterials.isPending} onClick={() => orderMaterials.mutate()}>
                {ti('orderMaterials')}
              </Button>
            ) : null}
          </div>
        </Board.Body>
      </Board>

      <InventoryScanBar />

      <DataBoard<Item>
        rows={rows}
        rowKey={(r) => r.id}
        empty={<Board.Empty title={ti('lowStockEmpty')} description={ti('lowStockEmptyHint')} />}
        rowHref={(r) => `/admin/inventory/items/${r.id}`}
        LinkComponent={Link}
        columns={[
          { key: 'photo', header: ti('itemPhoto'), width: '56px', cell: (r) => <InventoryItemThumb src={r.imageUrl} alt="" size={36} /> },
          { key: 'sku', header: ti('sku'), cell: (r) => <Ltr className="font-medium text-[var(--maher-brand)]">{r.sku}</Ltr> },
          { key: 'name', header: ti('name'), cell: (r) => localizedName(locale, r, r.nameEn) },
          {
            key: 'level',
            header: ti('onHand'),
            cell: (r) => {
              const onHand = Number(r.onHandQty ?? 0);
              const min = Number(r.minStock ?? 0);
              return (
                <span className="flex min-w-[180px] flex-col gap-1">
                  <span className="flex items-center justify-between gap-2 text-[12px]">
                    <Stamp tone={onHand <= 0 ? 'error' : 'warning'} size="sm">
                      <Ltr>
                        {onHand} / {min} {r.unit ?? ''}
                      </Ltr>
                    </Stamp>
                    {r.reorderQty ? (
                      <span className="text-[var(--maher-text-tertiary)]">
                        {ti('reorderQty')}: <Ltr>{String(r.reorderQty)}</Ltr>
                      </span>
                    ) : null}
                  </span>
                  <Meter value={Math.max(0, Math.min(onHand, min || 1))} max={min || 1} size="sm" tone={onHand <= 0 ? 'error' : 'warning'} showValue={false} />
                </span>
              );
            },
          },
          { key: 'reserved', header: ti('reserved'), numeric: true, width: '90px', cell: (r) => <Ltr>{String(r.reservedQty ?? 0)}</Ltr> },
        ]}
        mobileRow={(r) => ({
          leading: <InventoryItemThumb src={r.imageUrl} alt="" size={36} />,
          title: localizedName(locale, r, r.nameEn),
          meta: r.sku,
          trailing: (
            <Stamp tone={Number(r.onHandQty ?? 0) <= 0 ? 'error' : 'warning'} size="sm">
              <Ltr>
                {Number(r.onHandQty ?? 0)} / {Number(r.minStock ?? 0)}
              </Ltr>
            </Stamp>
          ),
        })}
      />
    </div>
  );
}

function ratio(r: Item): number {
  const min = Number(r.minStock ?? 0);
  const onHand = Number(r.onHandQty ?? 0);
  return min > 0 ? onHand / min : onHand;
}
