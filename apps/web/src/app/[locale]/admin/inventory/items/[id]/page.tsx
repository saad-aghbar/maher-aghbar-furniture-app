'use client';

import { InventoryScanBar } from '@/components/inventory/inventory-scan-bar';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { apiFetch, apiUpload } from '@/lib/api-client';
import type { Paginated } from '@/lib/paginated';
import { localizedName } from '@maher/i18n';
import { Board, BoardSkeleton, Button, CameraCapture, DetailHero, DocumentActions, ErrorBoard, Figure, KeyFacts, Ledger, LedgerRow, Ltr, Meter, QrDisplay, Stamp, Timeline, useToast, type BoardTone } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, ShoppingCart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type Item = {
  id: string;
  sku: string;
  barcode?: string | null;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  category?: string;
  itemClass?: string;
  materialType?: string | null;
  minStock?: string | number | null;
  reorderQty?: string | number | null;
  standardCost?: string | number | null;
  isActive?: boolean;
  balances?: Array<{ id?: string; availableQty: string | number; reservedQty?: string | number; onHandQty?: string | number; warehouse?: { id?: string; code: string; nameEn?: string; nameAr?: string; nameHe?: string | null }; location?: { code: string; nameEn?: string; nameAr?: string } | null }>;
};

type Tx = { id: string; number: string; type: string; quantity: string | number; unitCost?: string | number | null; referenceType?: string | null; referenceId?: string | null; createdAt: string; warehouse?: { code: string; nameEn: string; nameAr: string } | null; productionOrderId?: string | null; salesOrderId?: string | null; notes?: string | null };

const txTone = (type: string): BoardTone => (/RECEIPT|RECEIVE|IN\b|RETURN/.test(type) ? 'success' : /ISSUE|CONSUME|OUT\b|SCRAP/.test(type) ? 'warning' : /ADJUST|COUNT/.test(type) ? 'info' : 'neutral');

export default function InventoryItemPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const ti = useTranslations('inventory');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const toast = useToast();
  const qc = useQueryClient();
  const { openPdf, pdfDialog } = usePdfDownload();

  const query = useQuery({ queryKey: ['inventory-item', params.id], queryFn: () => apiFetch<Item>(`/api/v1/inventory/items/${params.id}`) });
  const txQuery = useQuery({ queryKey: ['inventory-item-transactions', params.id], queryFn: () => apiFetch<Paginated<Tx>>(`/api/v1/inventory/items/${params.id}/transactions?page=1&pageSize=30`) });

  const photo = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiUpload<{ downloadPath: string }>(`/api/v1/uploads?category=INVENTORY_IMAGE&inventoryItemId=${params.id}`, form);
    },
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await qc.invalidateQueries({ queryKey: ['inventory-item', params.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError || !query.data) return <ErrorBoard title={ti('item')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const item = query.data;
  const qrValue = item.barcode?.trim() || item.sku;
  const name = localizedName(locale, item, item.nameEn);
  const balances = item.balances ?? [];
  const onHand = balances.reduce((s, b) => s + Number(b.onHandQty ?? b.availableQty ?? 0), 0);
  const reserved = balances.reduce((s, b) => s + Number(b.reservedQty ?? 0), 0);
  const available = balances.reduce((s, b) => s + Number(b.availableQty ?? 0), 0);
  const min = Number(item.minStock ?? 0);
  const low = min > 0 && onHand < min;
  const tone: BoardTone = onHand <= 0 ? 'error' : low ? 'warning' : 'success';
  const status = (s: string) => (tStatus.has(s as never) ? tStatus(s as never) : s.replace(/_/g, ' '));
  const maxBalance = Math.max(1, ...balances.map((b) => Number(b.onHandQty ?? b.availableQty ?? 0)));
  const money = (v: unknown) => (v == null || v === '' ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(Number(v)));
  const date = (v: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(v));

  return (
    <div className="maher-stagger space-y-5">
      <DetailHero
        back={{ label: ti('items'), href: '/admin/inventory' }}
        LinkComponent={Link}
        code={item.sku}
        title={name}
        subtitle={[item.category ? status(item.category) : null, item.itemClass ? status(item.itemClass) : null, item.materialType].filter(Boolean).join(' · ')}
        status={{ label: onHand <= 0 ? ti('outOfStock') : low ? ti('lowStock') : ti('inStock'), tone }}
        tone={tone}
        media={
          <span className="block h-20 w-20 overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-24 sm:w-24">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[var(--maher-text-tertiary)]">
                <Boxes className="h-8 w-8 opacity-50" />
              </span>
            )}
          </span>
        }
        facts={[
          { label: ti('onHand'), value: `${onHand} ${item.unit ?? ''}`, ltr: true, tone },
          { label: ti('reserved'), value: `${reserved} ${item.unit ?? ''}`, ltr: true },
          { label: ti('available'), value: `${available} ${item.unit ?? ''}`, ltr: true },
          { label: ti('minStock'), value: min ? `${min} ${item.unit ?? ''}` : '—', ltr: true },
          { label: tc('materialCost'), value: money(item.standardCost), ltr: true },
        ]}
        primary={
          <Button leadingIcon={<ShoppingCart className="h-4 w-4" />} onClick={() => (window.location.href = `/${locale}/admin/purchasing?itemId=${item.id}`)}>
            {ti('orderMaterials')}
          </Button>
        }
        actions={<DocumentActions size="sm" actions={[{ id: 'label', kind: 'label', label: ti('itemQr'), onClick: () => openPdf({ path: `/api/v1/inventory/items/${item.id}/qr-label`, documentName: `${ti('itemQr')} · ${item.sku}`, filename: `${item.sku}-qr.pdf` }) }, { id: 'report', kind: 'pdf', label: ti('itemReport'), onClick: () => openPdf({ path: `/api/v1/inventory/items/${item.id}/label`, documentName: `${name} · ${item.sku}`, filename: `${item.sku}.pdf` }) }]} />}
      >
        {min > 0 ? <Meter value={Math.min(onHand, min * 2)} max={min * 2} target={min} label={ti('minStock')} valueLabel={`${onHand} / ${min} ${item.unit ?? ''}`} tone={tone} /> : null}
      </DetailHero>
      <InventoryScanBar />

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone={tone} className="xl:col-span-5">
          <Board.Header title={ti('warehouse')} meta={<Stamp tone="neutral" size="sm">{balances.length}</Stamp>} />
          {balances.length === 0 ? (
            <Board.Empty title={ti('noBalances')} />
          ) : (
            <ul className="divide-y divide-[var(--maher-border)]">
              {balances.map((b, i) => {
                const qty = Number(b.onHandQty ?? b.availableQty ?? 0);
                return (
                  <li key={b.id ?? `${item.id}-${i}`} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{b.warehouse ? localizedName(locale, { nameEn: b.warehouse.nameEn ?? b.warehouse.code, nameAr: b.warehouse.nameAr, nameHe: b.warehouse.nameHe }, b.warehouse.code) : '—'}</span>
                        <Ltr className="block text-[12px] text-[var(--maher-text-tertiary)]">{[b.warehouse?.code, b.location?.code].filter(Boolean).join(' · ')}</Ltr>
                      </span>
                      <Ltr className="text-[14px] font-semibold text-[var(--maher-text-primary)]">{`${qty} ${item.unit ?? ''}`}</Ltr>
                    </div>
                    <Meter className="mt-1.5" value={qty} max={maxBalance} size="sm" showValue={false} tone={qty <= 0 ? 'neutral' : 'brand'} />
                    {Number(b.reservedQty ?? 0) > 0 ? <span className="mt-1 block text-[12px] text-[var(--maher-text-tertiary)]">{`${ti('reserved')} ${b.reservedQty} · ${ti('available')} ${b.availableQty}`}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Board>

        <div className="space-y-5 xl:col-span-4">
          <Board tone="neutral">
            <Board.Header title={ti('item')} />
            <Board.Body>
              <KeyFacts
                columns={2}
                facts={[
                  { label: ti('sku'), value: item.sku, ltr: true },
                  { label: ti('barcode'), value: item.barcode ?? '—', ltr: true },
                  { label: tc('category'), value: item.category ? status(item.category) : '—' },
                  { label: ti('unit'), value: item.unit ?? '—', ltr: true },
                  { label: ti('reorderQty'), value: item.reorderQty != null ? String(item.reorderQty) : '—', ltr: true },
                  { label: tc('materialCost'), value: money(item.standardCost), ltr: true },
                ]}
              />
            </Board.Body>
          </Board>
          <Board tone="neutral">
            <Board.Header title={tCommon('photo')} />
            <div className="px-5 pb-5">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="mb-3 aspect-[5/4] w-full rounded-[12px] object-cover" />
              ) : null}
              <CameraCapture label={tCommon('takePhoto')} onUploadFile={(file: File) => photo.mutateAsync(file).then(() => undefined)} />
            </div>
          </Board>
        </div>

        <Board tone="brand" className="xl:col-span-3">
          <Board.Header title={ti('itemQr')} />
          <Board.Body className="flex flex-col items-center gap-3">
            <QrDisplay value={qrValue} size={160} label={ti('itemQr')} />
            <Button size="sm" variant="secondary" onClick={() => openPdf({ path: `/api/v1/inventory/items/${item.id}/qr-label`, documentName: `${ti('itemQr')} · ${item.sku}`, filename: `${item.sku}-qr.pdf` })}>
              {ti('printLabel')}
            </Button>
          </Board.Body>
        </Board>
      </div>

      <Board tone="neutral">
        <Board.Header title={ti('transactions')} meta={txQuery.data ? <Stamp tone="neutral" size="sm">{txQuery.data.meta.totalItems}</Stamp> : null} />
        {txQuery.isLoading ? (
          <BoardSkeleton header={false} rows={4} />
        ) : (txQuery.data?.data ?? []).length === 0 ? (
          <Board.Empty title={ti('noTransactions')} />
        ) : (
          <Timeline
            dense
            className="px-5 py-4"
            items={(txQuery.data?.data ?? []).map((tx) => ({
              id: tx.id,
              time: date(tx.createdAt),
              title: (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Stamp tone={txTone(tx.type)} size="sm">
                    {status(tx.type)}
                  </Stamp>
                  <Ltr className="font-semibold">{`${Number(tx.quantity) > 0 ? '+' : ''}${tx.quantity} ${item.unit ?? ''}`}</Ltr>
                </span>
              ),
              description: [tx.warehouse ? localizedName(locale, tx.warehouse, tx.warehouse.code) : null, tx.referenceType ? `${status(tx.referenceType)} ${tx.referenceId?.slice(0, 8) ?? ''}` : null, tx.unitCost != null ? money(tx.unitCost) : null, tx.notes].filter(Boolean).join(' · '),
              tone: txTone(tx.type),
            }))}
          />
        )}
        {(txQuery.data?.meta.totalItems ?? 0) > 30 ? (
          <Board.Footer>
            <span className="text-[12px] text-[var(--maher-text-tertiary)]">{ti('showingLatest', { count: 30 })}</span>
          </Board.Footer>
        ) : null}
      </Board>
      {pdfDialog}
      <Figure className="hidden" value={0} />
    </div>
  );
}
