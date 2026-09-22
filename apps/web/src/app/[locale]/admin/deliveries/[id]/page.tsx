'use client';

import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { DeliveryLocationMapLazy } from '@/components/delivery-location-map-lazy';
import { deliveryTone, useOrdersCopy } from '@/components/orders/orders-shared';
import { Link } from '@/i18n/navigation';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch } from '@/lib/api-client';
import { useKitCopy } from '@/lib/kit-copy';
import {
  ActionDock,
  Board,
  BoardSkeleton,
  type BoardTone,
  Button,
  Checkbox,
  Combobox,
  ConfirmDialog,
  DetailHero,
  ErrorBoard,
  Figure,
  InkPill,
  Input,
  KeyFacts,
  Ltr,
  Menu,
  Meter,
  Sheet,
  StageStrip,
  type StageStripStage,
  Stamp,
  TextArea,
  Ticket,
  useCodeScanner,
  useToast,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ScanLine, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

interface DeliveryItem {
  id: string;
  description: string;
  quantity: string | number;
}

interface DeliveryDetail {
  id: string;
  number: string;
  status: string;
  deliveryAddress: string;
  deliveryDate?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  notes?: string | null;
  recipientName?: string | null;
  failureReason?: string | null;
  signatureData?: string | null;
  customerConfirmedAt?: string | null;
  actualDeliveredAt?: string | null;
  customer?: { id?: string; name: string; phone?: string | null; addresses?: Array<{ latitude?: string | number | null; longitude?: string | number | null }> };
  driver?: { firstName?: string; lastName?: string } | null;
  salesOrder?: { id: string; number: string; externalOrderNumber?: string | null; quotation?: { request?: { deliveryLat?: string | number | null; deliveryLng?: string | number | null } | null } | null } | null;
  items?: DeliveryItem[];
}

type LoadSheetPiece = { id: string; pieceIndex: number; label: string; nameEn?: string | null; nameAr?: string | null; nameHe?: string | null; loadedAt: string | null; loadedById?: string | null };
type LoadSheetProduct = {
  inventoryLotId: string;
  lotQrCode?: string | null;
  productNameEn: string;
  productNameAr: string;
  productNameHe?: string | null;
  sku: string;
  imageUrl?: string | null;
  lotQuantity: number;
  warehouse?: { id: string; code: string; nameEn: string; nameAr?: string; nameHe?: string | null } | null;
  productionOrder?: { id: string; number: string } | null;
  pieces: LoadSheetPiece[];
};
type LoadSheet = { id: string; number: string; status: string; loadProgress: { loaded: number; total: number }; allLoaded: boolean; canDepart: boolean; products: LoadSheetProduct[] };

const FLOW = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

function pieceLabel(piece: LoadSheetPiece, locale: string) {
  if (locale === 'ar') return piece.nameAr || piece.label;
  if (locale === 'he') return piece.nameHe || piece.label;
  return piece.nameEn || piece.label;
}
function productName(product: LoadSheetProduct, locale: string) {
  if (locale === 'ar') return product.productNameAr || product.productNameEn;
  if (locale === 'he') return product.productNameHe || product.productNameEn;
  return product.productNameEn || product.productNameAr;
}

export default function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const copy = useOrdersCopy();
  const kit = useKitCopy();
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const tl = useTranslations('lifecycle');
  const ti = useTranslations('inventory');
  const tNav = useTranslations('navigation');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { openScanner } = useCodeScanner();

  const [failOpen, setFailOpen] = useState(false);
  const [departOpen, setDepartOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [driverId, setDriverId] = useState<string | null>(null);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [busyPieceId, setBusyPieceId] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['delivery', params.id], queryFn: () => apiFetch<DeliveryDetail>(`/api/v1/deliveries/${params.id}`) });
  const loadSheet = useQuery({ queryKey: ['delivery-load-sheet', params.id], queryFn: () => apiFetch<LoadSheet>(`/api/v1/deliveries/${params.id}/load-sheet`), enabled: Boolean(params.id) });
  const drivers = useQuery({
    queryKey: ['drivers-pick'],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; firstName: string; lastName: string; roles?: Array<{ role: { code: string } }> }> }>('/api/v1/users?pageSize=100').then((r) =>
        (r.data ?? []).filter((u) => u.roles?.some((role) => role.role.code === 'PRODUCTION_WORKER')),
      ),
  });

  const resolveCoords = useCallback((d: DeliveryDetail) => {
    const addr = d.customer?.addresses?.[0];
    for (const pair of [[d.latitude, d.longitude], [d.salesOrder?.quotation?.request?.deliveryLat, d.salesOrder?.quotation?.request?.deliveryLng], [addr?.latitude, addr?.longitude]]) {
      const lat = Number(pair[0]);
      const lng = Number(pair[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return { lat: null as number | null, lng: null as number | null };
  }, []);

  useEffect(() => {
    if (!detail.data) return;
    const c = resolveCoords(detail.data);
    setPinLat(c.lat);
    setPinLng(c.lng);
  }, [detail.data, resolveCoords]);

  const invalidate = async () => {
    await Promise.all(['delivery', 'delivery-load-sheet', 'deliveries', 'deliveries-pulse', 'inventory', 'inventory-finished-lots', 'production-orders', 'production-order', 'section-counts'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
  };

  const saveLocation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/deliveries/${params.id}/location`, { method: 'PATCH', body: JSON.stringify({ latitude: pinLat, longitude: pinLng }) }),
    onSuccess: async () => {
      toast.success(tCommon('saved'));
      await queryClient.invalidateQueries({ queryKey: ['delivery', params.id] });
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });
  const statusMutation = useMutation({
    mutationFn: (args: { status: string; driverId?: string; failureReason?: string; notes?: string }) => apiFetch(`/api/v1/deliveries/${params.id}/status`, { method: 'PATCH', body: JSON.stringify(args) }),
    onSuccess: async () => {
      setFormError(null);
      setFailOpen(false);
      toast.success(tc('deliveryStatusUpdated'));
      await invalidate();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });
  const pieceMutation = useMutation({
    mutationFn: (args: { pieceId: string; loaded: boolean }) => apiFetch<LoadSheet>(`/api/v1/deliveries/${params.id}/load-pieces/${args.pieceId}/${args.loaded ? 'check' : 'uncheck'}`, { method: 'POST' }),
    onMutate: (args) => setBusyPieceId(args.pieceId),
    onSuccess: (sheet) => queryClient.setQueryData(['delivery-load-sheet', params.id], sheet),
    onError: (err) => toast.error(mutationErrorMessage(err)),
    onSettled: () => setBusyPieceId(null),
  });
  const departMutation = useMutation({
    mutationFn: () => apiFetch<LoadSheet>(`/api/v1/deliveries/${params.id}/depart`, { method: 'POST' }),
    onSuccess: async () => {
      setDepartOpen(false);
      setFormError(null);
      toast.success(ti('loadSheetDeparted'));
      await invalidate();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  async function scanPackage() {
    const code = await openScanner({ title: ti('scanFinLot') });
    const sheet = loadSheet.data;
    if (!code || !sheet) return;
    const needle = code.trim().toUpperCase();
    const product = sheet.products.find((p) => (p.lotQrCode ?? '').trim().toUpperCase() === needle);
    const next = product ? [...product.pieces].sort((a, b) => a.pieceIndex - b.pieceIndex).find((p) => !p.loadedAt) : null;
    if (!product || !next) {
      toast.error(ti('scanUnknown'), code);
      return;
    }
    pieceMutation.mutate({ pieceId: next.id, loaded: true });
    toast.success(ti('loadSheetOnTruck'), `${productName(product, copy.locale)} · ${pieceLabel(next, copy.locale)}`);
  }

  if (detail.isLoading) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} header={false} className="h-52" />
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <BoardSkeleton rows={6} />
          </div>
          <div className="xl:col-span-5">
            <BoardSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }
  if (detail.isError || !detail.data) return <ErrorBoard title={tc('deliveryDetail')} onRetry={() => detail.refetch()} />;

  const delivery = detail.data;
  const sheet = loadSheet.data;
  const items = delivery.items ?? [];
  const terminal = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status);
  const departed = delivery.status === 'OUT_FOR_DELIVERY' || delivery.status === 'DELIVERED';
  const missing = sheet && sheet.loadProgress.total > 0 ? sheet.loadProgress.total - sheet.loadProgress.loaded : 0;
  const canDepart = !departed && (delivery.status === 'PLANNED' || delivery.status === 'READY') && Boolean(sheet);
  const driverName = delivery.driver ? [delivery.driver.firstName, delivery.driver.lastName].filter(Boolean).join(' ') : null;
  const tone: BoardTone = deliveryTone(delivery.status);
  const flowIdx = FLOW.indexOf(delivery.status as (typeof FLOW)[number]);
  const stages: StageStripStage[] = FLOW.map((s, i) => ({
    key: s,
    label: s === 'OUT_FOR_DELIVERY' ? tl('leftFactory') : copy.status(s),
    state: delivery.status === 'FAILED' || delivery.status === 'CANCELLED' ? (i <= Math.max(flowIdx, 0) ? 'skipped' : 'todo') : i < flowIdx ? 'done' : i === flowIdx ? (s === 'DELIVERED' ? 'done' : 'current') : 'todo',
  }));
  if (delivery.status === 'FAILED') stages.push({ key: 'FAILED', label: copy.status('FAILED'), state: 'blocked' });

  const attention: Array<{ id: string; tone: BoardTone; title: string; why: string }> = [];
  if (delivery.status === 'OUT_FOR_DELIVERY') attention.push({ id: 'awaiting', tone: 'info', title: tl('shippedHero'), why: tl('shippedAwaitingConfirm') });
  if (delivery.failureReason) attention.push({ id: 'failed', tone: 'error', title: copy.status('FAILED'), why: delivery.failureReason });
  if (canDepart && missing > 0) attention.push({ id: 'missing', tone: 'warning', title: ti('loadSheetMissing', { count: missing }), why: ti('loadSheetHint') });

  const primary = canDepart ? (
    <InkPill onClick={() => setDepartOpen(true)} disabled={!sheet?.canDepart || missing > 0 || departMutation.isPending}>
      <Truck className="h-4 w-4" />
      {ti('loadSheetConfirmDepart')}
    </InkPill>
  ) : delivery.status === 'PLANNED' ? (
    <InkPill onClick={() => statusMutation.mutate({ status: 'READY', driverId: driverId ?? undefined })} disabled={statusMutation.isPending}>
      {tc('advanceTo', { status: tStatus('READY') })}
    </InkPill>
  ) : null;

  const menu = (
    <Menu
      LinkComponent={Link}
      aria-label={tSales('moreActions')}
      trigger={
        <Button variant="secondary" size="icon" aria-label={tSales('moreActions')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
      items={[
        ...(!departed && sheet?.products.length ? [{ id: 'scan', label: ti('scanFinLot'), onSelect: () => void scanPackage() }] : []),
        ...(delivery.salesOrder ? [{ id: 'so', label: `${tSales('title')} ${delivery.salesOrder.number}`, href: `/admin/sales-orders/${delivery.salesOrder.id}` }] : []),
        ...(delivery.customer?.id ? [{ id: 'dealer', label: delivery.customer.name, href: `/admin/customers/${delivery.customer.id}` }] : []),
        ...(!terminal && delivery.status !== 'FAILED' ? [{ id: 'fail', label: tc('markFailed'), tone: 'error' as const, separator: true, onSelect: () => setFailOpen(true) }] : []),
      ]}
    />
  );

  return (
    <div className="maher-stagger space-y-5 pb-24 md:pb-0">
      <DetailHero
        LinkComponent={Link}
        back={{ label: tNav('deliveries'), href: '/admin/deliveries' }}
        code={delivery.number}
        title={delivery.customer?.name ?? delivery.number}
        subtitle={delivery.deliveryAddress}
        status={{ label: copy.status(delivery.status), tone }}
        facts={[
          { label: tSales('systemOrderNumber'), value: delivery.salesOrder ? <Link href={`/admin/sales-orders/${delivery.salesOrder.id}`} className="hover:underline">{delivery.salesOrder.number}</Link> : '—', ltr: true },
          ...(delivery.salesOrder?.externalOrderNumber ? [{ label: tSales('dealerOrderNumber'), value: delivery.salesOrder.externalOrderNumber, ltr: true }] : []),
          { label: tSales('deliveryDate'), value: delivery.deliveryDate ? copy.date(delivery.deliveryDate, { day: 'numeric', month: 'short', year: 'numeric' }) : '—', ltr: true },
          { label: tc('driver'), value: driverName ?? '—' },
          ...(sheet ? [{ label: tSales('desk.load'), value: `${sheet.loadProgress.loaded}/${sheet.loadProgress.total}`, ltr: true, tone: (sheet.allLoaded ? 'success' : missing > 0 ? 'warning' : 'neutral') as BoardTone }] : []),
          ...(delivery.customerConfirmedAt ? [{ label: tl('tabs.delivered'), value: copy.date(delivery.customerConfirmedAt, { day: 'numeric', month: 'short', year: 'numeric' }), ltr: true, tone: 'success' as BoardTone }] : []),
        ]}
        primary={primary}
        actions={menu}
      >
        <StageStrip stages={stages} />
      </DetailHero>

      {attention.length ? (
        <Board tone={attention.some((a) => a.tone === 'error') ? 'error' : attention.some((a) => a.tone === 'warning') ? 'warning' : 'info'} wash="top">
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {attention.map((a) => (
              <li key={a.id}>
                <Ticket tone={a.tone} title={a.title} why={a.why} wash={a.tone === 'error'} />
              </li>
            ))}
          </ul>
        </Board>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
          {/* Load sheet */}
          <Board tone={sheet?.allLoaded ? 'success' : missing > 0 ? 'warning' : 'brand'}>
            <Board.Header
              title={ti('loadSheetTitle')}
              description={ti('loadSheetHint')}
              actions={
                !departed && sheet?.products.length ? (
                  <Button size="sm" variant="secondary" leadingIcon={<ScanLine className="h-4 w-4" />} onClick={() => void scanPackage()}>
                    {ti('scanFinLot')}
                  </Button>
                ) : null
              }
            />
            {sheet && sheet.loadProgress.total > 0 ? (
              <div className="border-b border-[var(--maher-border)] px-5 py-3">
                <Meter value={sheet.loadProgress.loaded} max={sheet.loadProgress.total} tone={sheet.allLoaded ? 'success' : 'brand'} label={ti('loadSheetProgress', { loaded: sheet.loadProgress.loaded, total: sheet.loadProgress.total })} valueLabel={sheet.allLoaded && !departed ? ti('loadSheetReadyToDepart') : `${Math.round((sheet.loadProgress.loaded / sheet.loadProgress.total) * 100)}%`} />
              </div>
            ) : null}
            {loadSheet.isLoading ? (
              <div className="p-5">
                <BoardSkeleton rows={4} header={false} className="border-0 shadow-none" />
              </div>
            ) : loadSheet.isError ? (
              <Board.Body>
                <ErrorBoard title={ti('loadSheetTitle')} onRetry={() => loadSheet.refetch()} />
              </Board.Body>
            ) : !sheet || sheet.products.length === 0 ? (
              <Board.Empty title={ti('loadSheetNoPackages')} description={tSales('desk.loadSheetEmptyBody')} />
            ) : (
              <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                {sheet.products.map((product) => {
                  const loaded = product.pieces.filter((p) => p.loadedAt).length;
                  return (
                    <li key={product.inventoryLotId} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <InventoryItemThumb src={product.imageUrl} alt={productName(product, copy.locale)} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold leading-5 text-[var(--maher-text-primary)]">{productName(product, copy.locale)}</p>
                          <Ltr block className="text-[12px] text-[var(--maher-text-tertiary)]">
                            {product.sku}
                            {product.productionOrder?.number ? ` · ${product.productionOrder.number}` : ''}
                            {product.warehouse ? ` · ${product.warehouse.code}` : ''}
                            {product.lotQrCode ? ` · ${product.lotQrCode}` : ''}
                          </Ltr>
                        </div>
                        <Stamp tone={loaded === product.pieces.length ? 'success' : loaded > 0 ? 'warning' : 'neutral'} size="sm">
                          <Ltr>
                            {loaded}/{product.pieces.length}
                          </Ltr>
                        </Stamp>
                      </div>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {product.pieces.map((piece) => {
                          const checked = Boolean(piece.loadedAt);
                          return (
                            <li key={piece.id} className={`rounded-[12px] border px-3 py-2 ${checked ? 'border-[color:color-mix(in_oklab,var(--maher-success)_35%,transparent)] bg-[var(--maher-success-soft)]' : 'border-[var(--maher-border)]'}`}>
                              <Checkbox
                                checked={checked}
                                disabled={departed || busyPieceId === piece.id}
                                onChange={(next) => pieceMutation.mutate({ pieceId: piece.id, loaded: next })}
                                label={pieceLabel(piece, copy.locale)}
                                description={checked ? ti('loadSheetOnTruck') : departed ? undefined : ti('loadSheetTapToCheck')}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </Board>

          {/* Items */}
          <Board tone="neutral" className="xl:flex-1">
            <Board.Header title={tCommon('items')} meta={<span className="tabular-nums">{items.length}</span>} />
            <Board.Body padding="none" grow>
              {items.length === 0 ? (
                <Board.Empty title={tc('noLines')} />
              ) : (
                <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]">
                      <span className="min-w-0 truncate text-[var(--maher-text-primary)]">{item.description}</span>
                      <Ltr className="font-semibold text-[var(--maher-text-primary)]">× {String(item.quantity)}</Ltr>
                    </li>
                  ))}
                </ul>
              )}
            </Board.Body>
          </Board>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-5">
          {/* Map */}
          <Board tone="neutral">
            <Board.Header
              title={tc('deliveryLocation')}
              description={delivery.deliveryAddress}
              actions={
                !terminal ? (
                  <Button size="sm" variant="secondary" disabled={pinLat == null || pinLng == null} loading={saveLocation.isPending} onClick={() => saveLocation.mutate()}>
                    {tc('saveLocation')}
                  </Button>
                ) : null
              }
            />
            <div className="overflow-hidden">
              <DeliveryLocationMapLazy
                lat={pinLat}
                lng={pinLng}
                disabled={terminal}
                onChange={(lat, lng) => {
                  setPinLat(lat);
                  setPinLng(lng);
                }}
                onAddressSuggest={(address) => {
                  if (!delivery.deliveryAddress?.trim()) {
                    void apiFetch(`/api/v1/deliveries/${params.id}/location`, { method: 'PATCH', body: JSON.stringify({ deliveryAddress: address, latitude: pinLat, longitude: pinLng }) }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ['delivery', params.id] }),
                    );
                  }
                }}
              />
            </div>
          </Board>

          {/* Truck */}
          <Board tone={tone}>
            <Board.Header title={tSales('desk.truckTitle')} />
            <Board.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Figure size="sm" value={sheet?.loadProgress.loaded ?? 0} label={ti('loadSheetOnTruck')} tone={sheet?.allLoaded ? 'success' : undefined} />
                <Figure size="sm" value={missing} label={tSales('desk.stillToLoad')} tone={missing > 0 ? 'warning' : 'neutral'} />
              </div>
              {!terminal && (delivery.status === 'READY' || delivery.status === 'PLANNED') ? (
                <Combobox
                  label={tc('defaultDriver')}
                  value={driverId}
                  onChange={(id) => setDriverId(id)}
                  options={(drivers.data ?? []).map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName}` }))}
                  placeholder={tc('currentUser')}
                  emptyText={kit.combobox.empty}
                  clearLabel={kit.combobox.clear}
                />
              ) : null}
              <KeyFacts
                columns={2}
                facts={[
                  { label: tc('driver'), value: driverName ?? '—' },
                  { label: tc('recipientName'), value: delivery.recipientName ?? '—' },
                  ...(delivery.customer?.phone ? [{ label: tSales('phone'), value: delivery.customer.phone, ltr: true }] : []),
                  ...(delivery.notes ? [{ label: tc('notes'), value: delivery.notes, wide: true, muted: true }] : []),
                ]}
              />
              {delivery.signatureData ? (
                <div>
                  <p className="mb-1 text-[12px] text-[var(--maher-text-tertiary)]">{tc('signature')}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={delivery.signatureData} alt={tc('signature')} className="max-h-32 rounded-[10px] border border-[var(--maher-border)] bg-white" />
                </div>
              ) : null}
            </Board.Body>
          </Board>
        </div>
      </div>

      <ActionDock className="md:hidden" note={sheet ? <Ltr>{`${sheet.loadProgress.loaded}/${sheet.loadProgress.total}`}</Ltr> : null}>
        {menu}
        {primary}
      </ActionDock>

      <ConfirmDialog
        open={departOpen}
        onClose={() => setDepartOpen(false)}
        title={ti('loadSheetConfirmDepartTitle')}
        description={ti('loadSheetConfirmDepartBody')}
        confirmLabel={ti('loadSheetConfirmDepart')}
        cancelLabel={tCommon('cancel')}
        loading={departMutation.isPending}
        error={formError}
        onConfirm={() => departMutation.mutate()}
      />
      <Sheet
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title={tc('markFailed')}
        tone="error"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFailOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" loading={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'FAILED', failureReason: failureReason.trim() || undefined })}>
              {tc('markFailed')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <p className="text-[13px] text-[var(--maher-error)]">{formError}</p> : null}
          <TextArea autoGrow rows={2} label={tc('failureReason')} value={failureReason} onChange={(e) => setFailureReason(e.target.value)} />
        </div>
      </Sheet>
    </div>
  );
}
