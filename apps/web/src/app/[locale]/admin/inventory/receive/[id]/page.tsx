'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import { ActionDock, Alert, Board, BoardSkeleton, Button, Combobox, DetailHero, DocumentActions, ErrorBoard, Input, Ltr, Meter, NumberField, Stamp, TextArea, Timeline, useCodeScanner, useToast, type BoardTone } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ScanLine } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type Line = { id: string; description?: string | null; quantity: string | number; receivedQty?: string | number | null; unitCost?: string | number | null; inventoryItemId?: string | null; inventoryItem?: { id: string; sku: string; barcode?: string | null; nameEn: string; nameAr?: string | null; nameHe?: string | null; unit?: string | null; imageUrl?: string | null } | null; warehouseId?: string | null; locationId?: string | null };
type Receipt = { id: string; number: string; createdAt: string; notes?: string | null; deliveryDocRef?: string | null; lines: Array<{ id: string; receivedQty: string | number; rejectedQty?: string | number | null; inventoryItem?: { sku: string; nameEn: string; nameAr?: string | null } | null }> };
type PO = {
  id: string;
  number: string;
  status: string;
  expectedDate?: string | null;
  notes?: string | null;
  supplier?: { name?: string | null; nameAr?: string | null; nameEn?: string | null; code?: string } | null;
  lines?: Line[];
  goodsReceipts?: Receipt[];
};
type Warehouse = { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null; type?: string; locations?: Array<{ id: string; code: string; name?: string | null; isDefault?: boolean; isActive?: boolean }> };

const tone = (s: string): BoardTone => (s === 'RECEIVED' || s === 'CLOSED' ? 'success' : s === 'PARTIAL' || s === 'PARTIALLY_RECEIVED' ? 'warning' : s === 'CANCELLED' ? 'neutral' : 'info');

export default function InventoryReceivePoPage({ params }: { params: { id: string } }) {
  const ti = useTranslations('inventory');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { openScanner } = useCodeScanner();
  const { openPdf, pdfDialog } = usePdfDownload();

  const query = useQuery({ queryKey: ['purchase-order', params.id], queryFn: () => apiFetch<PO>(`/api/v1/purchase-orders/${params.id}`) });
  const warehouses = useQuery({ queryKey: ['warehouses', 'receive'], queryFn: () => apiFetch<{ data: Warehouse[] }>('/api/v1/warehouses?pageSize=100').then((r) => r.data) });

  const [qty, setQty] = useState<Record<string, number>>({});
  const [rejected, setRejected] = useState<Record<string, number>>({});
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [deliveryDocRef, setDeliveryDocRef] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const po = query.data;
  const lines = useMemo(() => po?.lines ?? [], [po?.lines]);
  const remaining = (l: Line) => Math.max(0, Number(l.quantity) - Number(l.receivedQty ?? 0));
  useEffect(() => {
    if (!po) return;
    setQty(Object.fromEntries(lines.map((l) => [l.id, remaining(l)])));
  }, [po, lines]);
  useEffect(() => {
    const ws = warehouses.data ?? [];
    if (!warehouseId && ws.length) {
      const preferred = ws.find((w) => w.type === 'RAW_MATERIALS') ?? ws[0];
      setWarehouseId(preferred?.id ?? null);
      setLocationId(preferred?.locations?.find((l) => l.isDefault)?.id ?? preferred?.locations?.[0]?.id ?? null);
    }
  }, [warehouses.data, warehouseId]);

  const receive = useMutation({
    mutationFn: () => {
      const body = {
        warehouseId: warehouseId ?? undefined,
        locationId: locationId ?? undefined,
        deliveryDocRef: deliveryDocRef.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: `grn-${params.id}-${Date.now()}`,
        lines: lines
          .filter((l) => l.inventoryItemId ?? l.inventoryItem?.id)
          .map((l) => ({ inventoryItemId: (l.inventoryItemId ?? l.inventoryItem?.id) as string, orderedQty: Number(l.quantity), receivedQty: Number(qty[l.id] ?? 0), rejectedQty: Number(rejected[l.id] ?? 0) || undefined, unitCost: l.unitCost != null ? Number(l.unitCost) : undefined, warehouseId: l.warehouseId ?? undefined, locationId: l.locationId ?? undefined }))
          .filter((l) => l.receivedQty > 0 || (l.rejectedQty ?? 0) > 0),
      };
      if (!body.lines.length) throw new Error(ti('receiveNothingSelected'));
      return apiFetch<{ id?: string; goodsReceipt?: { id: string } }>(`/api/v1/purchase-orders/${params.id}/goods-receipts`, { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: async (res) => {
      setError(null);
      toast.success(ti('receivedSuccess'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['purchase-order', params.id] }), qc.invalidateQueries({ queryKey: ['purchase-orders-receive'] }), qc.invalidateQueries({ queryKey: ['inventory-items'] }), qc.invalidateQueries({ queryKey: ['inventory-overview'] })]);
      const grnId = res?.goodsReceipt?.id ?? res?.id;
      if (grnId) openPdf({ path: `/api/v1/purchasing/goods-receipts/${grnId}/pdf`, documentName: ti('grn'), filename: `GRN-${po?.number ?? params.id}.pdf` });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  async function scan() {
    const code = await openScanner({ title: ti('scanBarcode'), hint: ti('scanBarcodeHint') });
    if (!code) return;
    const norm = code.trim().toLowerCase();
    const hit = lines.find((l) => [l.inventoryItem?.sku, l.inventoryItem?.barcode].some((v) => v && v.trim().toLowerCase() === norm));
    if (!hit) {
      setLastScan(code);
      toast.error(ti('scanUnknown'));
      return;
    }
    setLastScan(hit.inventoryItem?.sku ?? code);
    setQty((prev) => ({ ...prev, [hit.id]: Math.min(remaining(hit), (prev[hit.id] ?? 0) + 1) }));
    document.getElementById(`grn-line-${hit.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError || !po) return <ErrorBoard title={ti('receive')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />;

  const label = (s: string) => (tStatus.has(s as never) ? tStatus(s as never) : s.replace(/_/g, ' '));
  const ordered = lines.reduce((s, l) => s + Number(l.quantity), 0);
  const receivedSoFar = lines.reduce((s, l) => s + Number(l.receivedQty ?? 0), 0);
  const receivingNow = lines.reduce((s, l) => s + Number(qty[l.id] ?? 0), 0);
  const done = po.status === 'RECEIVED' || po.status === 'CLOSED' || po.status === 'CANCELLED';
  const ws = warehouses.data ?? [];
  const selectedWh = ws.find((w) => w.id === warehouseId);
  const supplier = po.supplier?.nameEn || po.supplier?.nameAr || po.supplier?.name || '—';

  return (
    <div className="maher-stagger space-y-5 pb-28 md:pb-0">
      <DetailHero
        back={{ label: ti('receive'), href: '/admin/inventory/receive' }}
        LinkComponent={Link}
        code={po.number}
        title={supplier}
        subtitle={po.expectedDate ? `${ti('expectedDate')} · ${new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(po.expectedDate))}` : undefined}
        status={{ label: label(po.status), tone: tone(po.status) }}
        facts={[
          { label: tc('lineItems'), value: String(lines.length), ltr: true },
          { label: ti('ordered'), value: String(ordered), ltr: true },
          { label: ti('received'), value: String(receivedSoFar), ltr: true, tone: receivedSoFar > 0 ? 'success' : undefined },
          { label: ti('receivingNow'), value: String(receivingNow), ltr: true, tone: receivingNow > 0 ? 'brand' : undefined },
        ]}
        primary={!done ? <Button leadingIcon={<ScanLine className="h-4 w-4" />} variant="secondary" onClick={() => void scan()}>{ti('scanBarcode')}</Button> : undefined}
        actions={<DocumentActions size="sm" actions={(po.goodsReceipts ?? []).slice(0, 1).map((g) => ({ id: g.id, kind: 'pdf' as const, label: `${ti('grn')} ${g.number}`, onClick: () => openPdf({ path: `/api/v1/purchasing/goods-receipts/${g.id}/pdf`, documentName: g.number, filename: `${g.number}.pdf` }) }))} />}
      >
        <Meter value={receivedSoFar} max={Math.max(1, ordered)} label={ti('received')} valueLabel={`${receivedSoFar}/${ordered}`} tone={receivedSoFar >= ordered && ordered > 0 ? 'success' : 'brand'} />
      </DetailHero>

      {lastScan ? <Alert variant="info">{`${ti('lastScan')}: ${lastScan}`}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone={done ? 'neutral' : 'brand'} className="xl:col-span-8">
          <Board.Header title={tc('lineItems')} description={done ? undefined : ti('receiveLinesHint')} meta={<Stamp tone="neutral" size="sm">{lines.length}</Stamp>} />
          <ul className="divide-y divide-[var(--maher-border)]">
            {lines.map((l) => {
              const rem = remaining(l);
              const item = l.inventoryItem;
              const now = qty[l.id] ?? 0;
              const name = item ? localizedName(locale, item, item.nameEn) : l.description ?? '—';
              return (
                <li key={l.id} id={`grn-line-${l.id}`} className="grid gap-3 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_200px_auto] lg:items-center">
                  <span className="flex min-w-0 items-center gap-3">
                    <InventoryItemThumb src={item?.imageUrl} alt="" size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{name}</span>
                      <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                        <Ltr>{item?.sku ?? ''}</Ltr>
                        {item?.barcode ? ` · ${item.barcode}` : ''}
                        {l.unitCost != null ? ` · ${new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(Number(l.unitCost))}` : ''}
                      </span>
                    </span>
                  </span>
                  <span>
                    <Meter value={Number(l.receivedQty ?? 0) + now} max={Math.max(1, Number(l.quantity))} size="sm" valueLabel={`${Number(l.receivedQty ?? 0)}${now ? ` +${now}` : ''} / ${l.quantity} ${item?.unit ?? ''}`} tone={rem === 0 ? 'success' : now > 0 ? 'brand' : 'neutral'} />
                  </span>
                  {!done && rem > 0 ? (
                    <span className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" aria-label="-" onClick={() => setQty((p) => ({ ...p, [l.id]: Math.max(0, (p[l.id] ?? 0) - 1) }))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <NumberField aria-label={ti('receivedQty')} value={now} onChange={(v) => setQty((p) => ({ ...p, [l.id]: Math.max(0, Math.min(rem, v ?? 0)) }))} min={0} max={rem} decimals={3} className="w-28" />
                      <Button size="sm" variant="secondary" aria-label="+" onClick={() => setQty((p) => ({ ...p, [l.id]: Math.min(rem, (p[l.id] ?? 0) + 1) }))}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <NumberField aria-label={ti('rejectedQty')} placeholder={ti('rejectedQty')} value={rejected[l.id] ?? null} onChange={(v) => setRejected((p) => ({ ...p, [l.id]: Math.max(0, v ?? 0) }))} min={0} decimals={3} className="w-28" />
                    </span>
                  ) : (
                    <Stamp tone={rem === 0 ? 'success' : 'neutral'} size="sm">
                      {rem === 0 ? label('RECEIVED') : `${rem} ${ti('remaining')}`}
                    </Stamp>
                  )}
                </li>
              );
            })}
          </ul>
        </Board>

        <div className="space-y-5 xl:col-span-4">
          {!done ? (
            <Board tone="info">
              <Board.Header title={ti('receiveInto')} />
              <Board.Body className="space-y-4">
                <Combobox label={ti('warehouse')} value={warehouseId} onChange={(v) => (setWarehouseId(v), setLocationId(ws.find((w) => w.id === v)?.locations?.find((l) => l.isDefault)?.id ?? null))} options={ws.map((w) => ({ value: w.id, label: localizedName(locale, w, w.code), description: w.code }))} clearable={false} emptyText={kit.combobox.empty} />
                <Combobox label={ti('bin')} value={locationId} onChange={setLocationId} options={(selectedWh?.locations ?? []).filter((l) => l.isActive !== false).map((l) => ({ value: l.id, label: l.name && l.name !== l.code ? `${l.code} · ${l.name}` : l.code }))} emptyText={ti('noBins')} clearLabel={kit.combobox.clear} />
                <Input label={ti('deliveryDocRef')} value={deliveryDocRef} onChange={(e) => setDeliveryDocRef(e.target.value)} dir="ltr" />
                <TextArea label={tCommon('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </Board.Body>
            </Board>
          ) : null}
          <Board tone="neutral">
            <Board.Header title={ti('grnHistory')} meta={po.goodsReceipts?.length ? <Stamp tone="neutral" size="sm">{po.goodsReceipts.length}</Stamp> : null} />
            {(po.goodsReceipts ?? []).length === 0 ? (
              <Board.Empty title={ti('noReceiptsYet')} />
            ) : (
              <Timeline
                dense
                className="px-5 py-4"
                items={(po.goodsReceipts ?? []).map((g) => ({
                  id: g.id,
                  time: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(g.createdAt)),
                  title: (
                    <button type="button" className="font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]" onClick={() => openPdf({ path: `/api/v1/purchasing/goods-receipts/${g.id}/pdf`, documentName: g.number, filename: `${g.number}.pdf` })}>
                      <Ltr>{g.number}</Ltr>
                    </button>
                  ),
                  description: `${g.lines.reduce((s, x) => s + Number(x.receivedQty), 0)} ${ti('received')}${g.deliveryDocRef ? ` · ${g.deliveryDocRef}` : ''}${g.notes ? ` · ${g.notes}` : ''}`,
                  tone: 'success' as BoardTone,
                }))}
              />
            )}
          </Board>
        </div>
      </div>

      {!done ? (
        <ActionDock note={`${receivingNow} / ${Math.max(0, ordered - receivedSoFar)} ${ti('receivingNow')}`}>
          <Button loading={receive.isPending} disabled={receivingNow <= 0 && !Object.values(rejected).some((v) => v > 0)} onClick={() => receive.mutate()}>
            {ti('receive')}
          </Button>
        </ActionDock>
      ) : null}
      {pdfDialog}
    </div>
  );
}
