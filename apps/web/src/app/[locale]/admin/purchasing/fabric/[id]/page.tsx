'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { fabricEventTone, fabricTone, SUPPLIER_STATES, type FabricJob, type SupplierState } from '@/components/purchasing/fabric-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { usePdfDownload } from '@/hooks/use-pdf-download';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import { localizedName } from '@maher/i18n';
import { ActionDock, Alert, Board, BoardSkeleton, Button, Combobox, DateField, DetailHero, ErrorBoard, Figure, KeyFacts, Ltr, Menu, Meter, MoneyField, NumberField, QrDisplay, SegmentedControl, Sheet, Stamp, TextArea, Timeline, useToast, type BoardTone } from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, MoreHorizontal, PackageCheck, Repeat, ShieldAlert, Truck, Warehouse } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

type Supplier = { id: string; code: string; name: string; nameAr?: string | null; nameEn?: string | null };
type WarehouseRow = { id: string; code: string; nameEn: string; nameAr: string; nameHe?: string | null; type?: string; locations?: Array<{ id: string; code: string; name?: string | null; isDefault?: boolean; isActive?: boolean }> };
type StockItem = { id: string; sku: string; nameEn: string; nameAr?: string | null; availableQty?: number | string };

type Action = 'wait' | 'state' | 'redirect' | 'override' | 'receive' | 'allocate';

export default function FabricJobDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations('navigation');
  const tf = useTranslations('mobile.fabricStatus');
  const te = useTranslations('mobile.fabricEvent');
  const tp = useTranslations('purchasing');
  const tCommon = useTranslations('common');
  const ti = useTranslations('inventory');
  const locale = useLocale();
  const kit = useKitCopy();
  const toast = useToast();
  const qc = useQueryClient();
  const { openPdf, pdfDialog } = usePdfDownload();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [expected, setExpected] = useState('');
  const [supplierState, setSupplierState] = useState<SupplierState>('SUPPLIER_CONFIRMED');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [qty, setQty] = useState<number | null>(null);
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [stockItemId, setStockItemId] = useState<string | null>(null);
  const [replaceFabric, setReplaceFabric] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['fabric-procurement', params.id], queryFn: () => apiFetch<FabricJob>(`/api/v1/fabric-procurements/${params.id}`) });
  const suppliers = useQuery({ queryKey: ['suppliers-pick'], queryFn: () => apiFetch<{ data: Supplier[] }>('/api/v1/suppliers?pageSize=100&status=ACTIVE').then((r) => r.data), enabled: action === 'redirect' });
  const warehouses = useQuery({ queryKey: ['warehouses', 'fabric'], queryFn: () => apiFetch<{ data: WarehouseRow[] }>('/api/v1/warehouses?pageSize=100').then((r) => r.data), enabled: action === 'receive' || action === 'allocate' });
  const stock = useQuery({ queryKey: ['inventory-items', 'fabric-pick'], queryFn: () => apiFetch<{ data: StockItem[] }>('/api/v1/inventory/items?categoryGroup=fabric&pageSize=100').then((r) => r.data), enabled: action === 'allocate' });

  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ['fabric-procurement', params.id] }), qc.invalidateQueries({ queryKey: ['fabric-procurements'] }), qc.invalidateQueries({ queryKey: ['inventory-fabric-holding'] })]);
  const act = useMutation({
    mutationFn: async (a: Action) => {
      const base = `/api/v1/fabric-procurements/${params.id}`;
      switch (a) {
        case 'wait':
          return apiFetch(`${base}/wait`, { method: 'POST', body: JSON.stringify({ note: note.trim() || undefined, expectedAvailableAt: expected || undefined }) });
        case 'state':
          return apiFetch(`${base}/supplier-state`, { method: 'POST', body: JSON.stringify({ state: supplierState, note: note.trim() || undefined, expectedAvailableAt: expected || undefined }) });
        case 'redirect':
          if (!supplierId) throw new Error(tp('supplierRequired'));
          return apiFetch(`${base}/redirect`, { method: 'POST', body: JSON.stringify({ supplierId, note: note.trim() || undefined }) });
        case 'override':
          if (!reason.trim()) throw new Error(tp('reasonRequired'));
          return apiFetch(`${base}/override`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
        case 'receive':
          if (!qty || !locationId) throw new Error(tp('receiveFieldsRequired'));
          return apiFetch(`${base}/receive`, { method: 'POST', body: JSON.stringify({ qty, locationId, unitCost: unitCost ?? undefined, note: note.trim() || undefined, idempotencyKey: `fabric-${params.id}-${Date.now()}` }) });
        case 'allocate':
          if (!qty || !stockItemId) throw new Error(tp('receiveFieldsRequired'));
          return apiFetch(`${base}/allocate-from-stock`, { method: 'POST', body: JSON.stringify({ inventoryItemId: stockItemId, qty, warehouseId: warehouseId ?? undefined, locationId: locationId ?? undefined, replaceFabric, reason: reason.trim() || undefined }) });
      }
    },
    onSuccess: async () => {
      setAction(null);
      setError(null);
      toast.success(tCommon('saved'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  if (query.isLoading) return <BoardSkeleton rows={6} />;
  if (query.isError || !query.data) return <ErrorBoard title={t('fabricJobs')} description={mutationErrorMessage(query.error)} onRetry={() => query.refetch()} />;
  const job = query.data;
  const tone = fabricTone(job.state);
  const label = job.requestedLabel ?? job.productName ?? job.sku ?? job.qrCode ?? params.id;
  const lots = job.lots ?? [];
  const arrived = job.arrivedQty ?? lots.reduce((s, l) => s + Number(l.quantity ?? 0), 0);
  const required = job.requiredQty ?? null;
  const date = (v?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => (v ? new Intl.DateTimeFormat(locale, opts).format(new Date(v)) : '—');
  const money = (v?: number | null) => (v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(v));
  const stateLabel = (s?: string) => (s ? (te.has(s as never) ? te(s as never) : s.replace(/_/g, ' ')) : '—');
  const done = /RECEIVED|ALLOCATED|TAKEN|COMPLETE/.test((job.state ?? '').toUpperCase());
  const selectedWh = (warehouses.data ?? []).find((w) => w.id === warehouseId);
  const open = (a: Action) => {
    setError(null);
    setNote('');
    setExpected(job.expectedAvailableAt?.slice(0, 10) ?? '');
    setReason('');
    setQty(required ? Math.max(0, required - arrived) : null);
    setUnitCost(job.resolvedUnitCost ?? null);
    setSupplierId(job.supplier?.id ?? null);
    setStockItemId(job.inventoryItemId ?? null);
    setReplaceFabric(false);
    const ws = warehouses.data ?? [];
    const wh = ws.find((w) => w.type === 'RAW_MATERIALS') ?? ws[0];
    setWarehouseId(wh?.id ?? null);
    setLocationId(wh?.locations?.find((l) => l.isDefault)?.id ?? null);
    setAction(a);
  };

  return (
    <div className="maher-stagger space-y-5 pb-28 md:pb-0">
      <DetailHero
        back={{ label: t('fabricJobs'), href: '/admin/purchasing/fabric' }}
        LinkComponent={Link}
        code={job.qrCode ?? job.sku ?? undefined}
        title={label}
        subtitle={[job.dealerName, job.salesOrderNumber, job.itemLetter ? `${tp('item')} ${job.itemLetter}` : null].filter(Boolean).join(' · ')}
        status={{ label: stateLabel(job.state), tone }}
        tone={tone}
        media={<InventoryItemThumb src={job.imageUrl ?? job.productImageUrl} alt="" size={88} />}
        facts={[
          { label: tp('supplier'), value: job.supplier?.name ?? '—' },
          { label: tp('expectedDate'), value: date(job.expectedAvailableAt), ltr: true, tone: job.expectedAvailableAt && new Date(job.expectedAvailableAt).getTime() < Date.now() && !done ? 'error' : undefined },
          { label: tf('inHolding'), value: required ? `${arrived} / ${required} ${job.unit ?? ''}` : String(arrived), ltr: true, tone: required && arrived >= required ? 'success' : undefined },
          { label: tp('unitCost'), value: money(job.resolvedUnitCost), ltr: true, tone: job.costOnFile === false ? 'warning' : undefined },
          { label: tp('purchaseOrder'), value: job.purchaseOrderNumber ?? '—', ltr: true },
        ]}
        primary={!done ? <Button leadingIcon={<PackageCheck className="h-4 w-4" />} onClick={() => open('receive')}>{tp('receiveFabric')}</Button> : undefined}
        actions={
          <Menu
            aria-label={tCommon('more')}
            trigger={<Button variant="secondary" aria-label={tCommon('more')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              ...(job.salesOrderId ? [{ id: 'so', label: job.salesOrderNumber, href: `/admin/sales-orders/${job.salesOrderId}` }] : []),
              ...(job.productionOrderId ? [{ id: 'po', label: job.productionOrderNumber ?? t('production'), href: `/admin/production/${job.productionOrderId}?tab=materials` }] : []),
              ...(job.purchaseOrderId ? [{ id: 'pur', label: job.purchaseOrderNumber ?? t('purchasing'), href: `/admin/purchasing/${job.purchaseOrderId}` }] : []),
              ...(job.inventoryItemId ? [{ id: 'item', label: ti('item'), href: `/admin/inventory/items/${job.inventoryItemId}` }] : []),
            ]}
            LinkComponent={Link}
          />
        }
      >
        {required ? <Meter value={Math.min(arrived, required)} max={required} label={tf('inHolding')} valueLabel={`${arrived} / ${required} ${job.unit ?? ''}`} tone={arrived >= required ? 'success' : tone} /> : null}
      </DetailHero>

      <div className="grid gap-5 xl:grid-cols-12">
        <Board tone={tone} wash="top" className="xl:col-span-5">
          <Board.Header title={tp('holdMachine')} description={tp('holdMachineHint')} />
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Figure size="sm" value={lots.length} label={tp('lots')} tone={lots.length ? 'success' : 'neutral'} />
              <Figure size="sm" value={(job.events ?? []).length} label={tp('events')} tone="neutral" />
            </div>
            <KeyFacts
              columns={2}
              facts={[
                { label: tp('supplier'), value: job.supplier?.name ?? '—' },
                { label: tp('whatsappSentAt'), value: date(job.whatsappSentAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), ltr: true },
                { label: tp('expectedDate'), value: date(job.expectedAvailableAt), ltr: true },
                { label: ti('sku'), value: job.sku ?? '—', ltr: true },
              ]}
            />
            {!done ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" leadingIcon={<Clock className="h-3.5 w-3.5" />} onClick={() => open('wait')}>
                  {te('WAIT')}
                </Button>
                <Button variant="secondary" size="sm" leadingIcon={<Truck className="h-3.5 w-3.5" />} onClick={() => open('state')}>
                  {tp('supplierState')}
                </Button>
                <Button variant="secondary" size="sm" leadingIcon={<Repeat className="h-3.5 w-3.5" />} onClick={() => open('redirect')}>
                  {te('REDIRECTED')}
                </Button>
                <Button variant="secondary" size="sm" leadingIcon={<Warehouse className="h-3.5 w-3.5" />} onClick={() => open('allocate')}>
                  {tp('allocateFromStock')}
                </Button>
                <Button variant="ghost" size="sm" className="col-span-2 text-[var(--maher-error)]" leadingIcon={<ShieldAlert className="h-3.5 w-3.5" />} onClick={() => open('override')}>
                  {te('OVERRIDE')}
                </Button>
              </div>
            ) : null}
          </Board.Body>
        </Board>

        <Board tone="neutral" className="xl:col-span-4">
          <Board.Header title={tp('lots')} meta={lots.length ? <Stamp tone="success" size="sm">{lots.length}</Stamp> : null} />
          {lots.length === 0 ? (
            <Board.Empty title={tp('noLots')} />
          ) : (
            <ul className="divide-y divide-[var(--maher-border)]">
              {lots.map((lot) => (
                <li key={lot.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <Ltr className="block truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{lot.qrCode ?? lot.id.slice(0, 8)}</Ltr>
                    <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                      {lot.locationLabel ?? '—'}
                      {lot.unitCost != null ? ` · ${money(lot.unitCost)}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Ltr className="text-[13px] font-semibold">{`${lot.remainingQty ?? lot.quantity} / ${lot.quantity}`}</Ltr>
                    <Stamp tone={fabricTone(lot.status)} size="sm">
                      {lot.status.replace(/_/g, ' ')}
                    </Stamp>
                    {lot.qrCode ? (
                      <Button size="sm" variant="ghost" onClick={() => openPdf({ path: `/api/v1/inventory/lots/${lot.id}/qr-label`, documentName: lot.qrCode ?? lot.id, filename: `${lot.qrCode}.pdf` })}>
                        QR
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Board>

        <Board tone="brand" className="xl:col-span-3">
          <Board.Header title={ti('fabricBundle')} />
          <Board.Body className="flex flex-col items-center gap-3">
            {job.qrCode ? <QrDisplay value={job.qrCode} size={150} label={job.qrCode} /> : <p className="text-[13px] text-[var(--maher-text-tertiary)]">—</p>}
          </Board.Body>
        </Board>
      </div>

      <Board tone="neutral">
        <Board.Header title={tp('events')} meta={(job.events ?? []).length ? <Stamp tone="neutral" size="sm">{(job.events ?? []).length}</Stamp> : null} />
        {(job.events ?? []).length === 0 ? (
          <Board.Empty title={tp('noEvents')} />
        ) : (
          <Timeline dense className="px-5 py-4" items={[...(job.events ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((ev) => ({ id: ev.id, time: date(ev.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), title: stateLabel(ev.kind), description: ev.note ?? undefined, tone: fabricEventTone(ev.kind) as BoardTone }))} />
        )}
      </Board>

      {!done ? (
        <ActionDock note={`${stateLabel(job.state)} · ${job.supplier?.name ?? tp('noSupplier')}`}>
          <Button variant="secondary" onClick={() => open('state')}>
            {tp('supplierState')}
          </Button>
          <Button onClick={() => open('receive')}>{tp('receiveFabric')}</Button>
        </ActionDock>
      ) : null}

      <Sheet
        open={Boolean(action)}
        onClose={() => !act.isPending && setAction(null)}
        tone={action === 'override' ? 'error' : action === 'receive' || action === 'allocate' ? 'success' : 'warning'}
        title={action === 'wait' ? te('WAIT') : action === 'state' ? tp('supplierState') : action === 'redirect' ? te('REDIRECTED') : action === 'override' ? te('OVERRIDE') : action === 'allocate' ? tp('allocateFromStock') : tp('receiveFabric')}
        description={label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant={action === 'override' ? 'danger' : 'primary'} loading={act.isPending} onClick={() => action && act.mutate(action)}>
              {tCommon('confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {action === 'state' ? (
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--maher-text-primary)]">{tp('supplierState')}</span>
              <SegmentedControl aria-label={tp('supplierState')} value={supplierState} onChange={(v) => setSupplierState(v as SupplierState)} options={SUPPLIER_STATES.map((s) => ({ value: s, label: stateLabel(s) }))} />
            </div>
          ) : null}
          {action === 'wait' || action === 'state' ? <DateField label={tp('expectedDate')} value={expected} onChange={setExpected} copy={kit.date} locale={locale} presentation="popover" clearable /> : null}
          {action === 'redirect' ? <Combobox label={tp('supplier')} value={supplierId} onChange={setSupplierId} options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.nameAr || s.nameEn ? localizedName(locale, s, s.name) : s.name, description: s.code }))} emptyText={kit.combobox.empty} clearLabel={kit.combobox.clear} /> : null}
          {action === 'override' ? <TextArea autoGrow label={tp('reason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /> : null}
          {action === 'receive' || action === 'allocate' ? (
            <>
              {action === 'allocate' ? <Combobox label={ti('item')} value={stockItemId} onChange={setStockItemId} options={(stock.data ?? []).map((i) => ({ value: i.id, label: localizedName(locale, i, i.nameEn), description: `${i.sku}${i.availableQty != null ? ` · ${i.availableQty}` : ''}` }))} emptyText={kit.combobox.empty} loadingText={kit.combobox.loading} clearLabel={kit.combobox.clear} /> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label={ti('quantity')} unit={job.unit ?? 'm'} value={qty} onChange={setQty} min={0} decimals={2} />
                {action === 'receive' ? <MoneyField label={tp('unitCost')} currency="ILS" value={unitCost} onChange={setUnitCost} min={0} /> : null}
              </div>
              <Combobox label={ti('warehouse')} value={warehouseId} onChange={(v) => (setWarehouseId(v), setLocationId((warehouses.data ?? []).find((w) => w.id === v)?.locations?.find((l) => l.isDefault)?.id ?? null))} options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: localizedName(locale, w, w.code), description: w.code }))} clearable={false} emptyText={kit.combobox.empty} />
              <Combobox label={ti('bin')} value={locationId} onChange={setLocationId} options={(selectedWh?.locations ?? []).filter((l) => l.isActive !== false).map((l) => ({ value: l.id, label: l.name && l.name !== l.code ? `${l.code} · ${l.name}` : l.code }))} emptyText={ti('noBins')} clearLabel={kit.combobox.clear} />
              {action === 'allocate' ? (
                <SegmentedControl
                  aria-label={tp('replaceFabric')}
                  value={replaceFabric ? 'replace' : 'keep'}
                  onChange={(v) => setReplaceFabric(v === 'replace')}
                  options={[
                    { value: 'keep', label: tp('keepFabric') },
                    { value: 'replace', label: tp('replaceFabric') },
                  ]}
                />
              ) : null}
            </>
          ) : null}
          {action !== 'override' && action !== 'allocate' ? <TextArea autoGrow label={tCommon('notes')} value={note} onChange={(e) => setNote(e.target.value)} rows={3} /> : null}
          {action === 'allocate' ? <TextArea autoGrow label={tp('reason')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /> : null}
        </div>
      </Sheet>
      {pdfDialog}
    </div>
  );
}
