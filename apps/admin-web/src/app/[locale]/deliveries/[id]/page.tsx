'use client';

import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { InventoryItemThumb } from '@/components/admin/inventory-item-thumb';
import { DeliveryLocationMapLazy } from '@/components/delivery-location-map-lazy';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { DELIVERY_STATUSES } from '@/lib/status-options';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  MotionSection,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@maher/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
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
  latitude?: string | number | null;
  longitude?: string | number | null;
  notes?: string | null;
  recipientName?: string | null;
  failureReason?: string | null;
  signatureData?: string | null;
  customerConfirmedAt?: string | null;
  customer?: {
    name: string;
    phone?: string | null;
    addresses?: Array<{ latitude?: string | number | null; longitude?: string | number | null }>;
  };
  driver?: { firstName?: string; lastName?: string } | null;
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
    quotation?: {
      request?: {
        deliveryLat?: string | number | null;
        deliveryLng?: string | number | null;
      } | null;
    } | null;
  } | null;
  items?: DeliveryItem[];
}

type LoadSheetPiece = {
  id: string;
  pieceIndex: number;
  label: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  loadedAt: string | null;
  loadedById?: string | null;
};

type LoadSheetProduct = {
  inventoryLotId: string;
  productNameEn: string;
  productNameAr: string;
  productNameHe?: string | null;
  sku: string;
  imageUrl?: string | null;
  lotQuantity: number;
  warehouse?: {
    id: string;
    code: string;
    nameEn: string;
    nameAr?: string;
    nameHe?: string | null;
  } | null;
  productionOrder?: { id: string; number: string } | null;
  pieces: LoadSheetPiece[];
};

type LoadSheet = {
  id: string;
  number: string;
  status: string;
  loadProgress: { loaded: number; total: number };
  allLoaded: boolean;
  canDepart: boolean;
  products: LoadSheetProduct[];
};

const STATUS_FLOW = ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

function nextStatus(current: string): string | null {
  // Commercial DELIVERED is dealer confirm-receipt only — staff may only advance to truck departed.
  if (current === 'OUT_FOR_DELIVERY' || current === 'DELIVERED') return null;
  const i = STATUS_FLOW.indexOf(current as (typeof STATUS_FLOW)[number]);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  const next = STATUS_FLOW[i + 1]!;
  if (next === 'DELIVERED') return null;
  return next;
}

function advanceActionLabel(
  next: string,
  tStatus: (key: string) => string,
  tc: (key: string, values?: Record<string, string>) => string,
  tl: (key: string) => string,
): string {
  if (next === 'OUT_FOR_DELIVERY') return tl('markTruckDeparted');
  return tc('advanceTo', { status: tStatus(next) });
}

function pieceLabel(piece: LoadSheetPiece, locale: string): string {
  if (locale === 'ar') return piece.nameAr || piece.label;
  if (locale === 'he') return piece.nameHe || piece.label;
  return piece.nameEn || piece.label;
}

function productName(product: LoadSheetProduct, locale: string): string {
  if (locale === 'ar') return product.productNameAr || product.productNameEn;
  if (locale === 'he') return product.productNameHe || product.productNameEn;
  return product.productNameEn || product.productNameAr;
}

export default function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const tc = useTranslations('catalog');
  const tSales = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');
  const tl = useTranslations('lifecycle');
  const ti = useTranslations('inventory');
  const queryClient = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [failOpen, setFailOpen] = useState(false);
  const [departOpen, setDepartOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [driverId, setDriverId] = useState('');
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [busyPieceId, setBusyPieceId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['delivery', params.id],
    queryFn: () => apiFetch<DeliveryDetail>(`/api/v1/deliveries/${params.id}`),
  });

  const loadSheetQuery = useQuery({
    queryKey: ['delivery-load-sheet', params.id],
    queryFn: () => apiFetch<LoadSheet>(`/api/v1/deliveries/${params.id}/load-sheet`),
    enabled: Boolean(params.id),
  });

  const resolveCoords = useCallback((d: DeliveryDetail) => {
    const fromDelivery = [d.latitude, d.longitude];
    const fromRfq = [
      d.salesOrder?.quotation?.request?.deliveryLat,
      d.salesOrder?.quotation?.request?.deliveryLng,
    ];
    const addr = d.customer?.addresses?.[0];
    const fromAddr = [addr?.latitude, addr?.longitude];
    for (const pair of [fromDelivery, fromRfq, fromAddr]) {
      const lat = Number(pair[0]);
      const lng = Number(pair[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return { lat: null as number | null, lng: null as number | null };
  }, []);

  useEffect(() => {
    if (!detailQuery.data) return;
    const c = resolveCoords(detailQuery.data);
    setPinLat(c.lat);
    setPinLng(c.lng);
  }, [detailQuery.data, resolveCoords]);

  const saveLocationMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/deliveries/${params.id}/location`, {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: pinLat,
          longitude: pinLng,
        }),
      }),
    onSuccess: async () => {
      setBanner(tCommon('saved'));
      await queryClient.invalidateQueries({ queryKey: ['delivery', params.id] });
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const driversQuery = useQuery({
    queryKey: ['drivers-pick'],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
          firstName: string;
          lastName: string;
          roles?: Array<{ role: { code: string } }>;
        }>;
      }>('/api/v1/users?pageSize=100').then((r) =>
        (r.data ?? []).filter((u) =>
          u.roles?.some((role) =>
            ['PRODUCTION_WORKER'].includes(
              role.role.code,
            ),
          ),
        ),
      ),
  });

  const invalidateDelivery = async () => {
    await queryClient.invalidateQueries({ queryKey: ['delivery', params.id] });
    await queryClient.invalidateQueries({ queryKey: ['delivery-load-sheet', params.id] });
    await queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    await queryClient.invalidateQueries({ queryKey: ['inventory-finished-lots'] });
    await queryClient.invalidateQueries({ queryKey: ['production-orders'] });
    await queryClient.invalidateQueries({ queryKey: ['production-order'] });
  };

  const statusMutation = useMutation({
    mutationFn: (args: {
      status: string;
      driverId?: string;
      failureReason?: string;
      notes?: string;
    }) =>
      apiFetch(`/api/v1/deliveries/${params.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(args),
      }),
    onSuccess: async () => {
      setFormError(null);
      setFailOpen(false);
      setBanner(tc('deliveryStatusUpdated'));
      await invalidateDelivery();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  const pieceMutation = useMutation({
    mutationFn: (args: { pieceId: string; loaded: boolean }) =>
      apiFetch<LoadSheet>(
        `/api/v1/deliveries/${params.id}/load-pieces/${args.pieceId}/${args.loaded ? 'check' : 'uncheck'}`,
        { method: 'POST' },
      ),
    onMutate: (args) => setBusyPieceId(args.pieceId),
    onSuccess: (sheet) => {
      queryClient.setQueryData(['delivery-load-sheet', params.id], sheet);
      setFormError(null);
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
    onSettled: () => setBusyPieceId(null),
  });

  const departMutation = useMutation({
    mutationFn: () =>
      apiFetch<LoadSheet>(`/api/v1/deliveries/${params.id}/depart`, { method: 'POST' }),
    onSuccess: async () => {
      setDepartOpen(false);
      setFormError(null);
      setBanner(ti('loadSheetDeparted'));
      await invalidateDelivery();
    },
    onError: (err) => setFormError(mutationErrorMessage(err)),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title={tc('deliveryDetail')}
        onRetry={() => detailQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const delivery = detailQuery.data;
  const items = delivery.items ?? [];
  const next = nextStatus(delivery.status);
  const terminal = ['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status);
  const departed = delivery.status === 'OUT_FOR_DELIVERY' || delivery.status === 'DELIVERED';
  const driverName = delivery.driver
    ? [delivery.driver.firstName, delivery.driver.lastName].filter(Boolean).join(' ')
    : '—';
  const sheet = loadSheetQuery.data;
  const missing =
    sheet && sheet.loadProgress.total > 0
      ? sheet.loadProgress.total - sheet.loadProgress.loaded
      : 0;
  const canShowDepartCta =
    !departed &&
    (delivery.status === 'PLANNED' || delivery.status === 'READY') &&
    Boolean(sheet);

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/deliveries"
        title={delivery.number}
        description={delivery.customer?.name}
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      <MotionSection className="maher-form-section space-y-6" as="div">
      {formError && !failOpen && !departOpen ? <Alert variant="error">{formError}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={delivery.status} />
        <span className="text-sm text-text-secondary">{delivery.deliveryAddress}</span>
        {delivery.salesOrder?.number ? (
          <span className="text-sm text-text-secondary" dir="ltr">
            {tSales('systemOrderNumber')}:{' '}
            <Link
              href={`/sales-orders/${delivery.salesOrder.id}`}
              className="text-brand hover:underline"
            >
              {delivery.salesOrder.number}
            </Link>
          </span>
        ) : null}
        {delivery.salesOrder?.externalOrderNumber ? (
          <span className="text-sm text-text-secondary" dir="ltr">
            {tSales('dealerOrderNumber')}: {delivery.salesOrder.externalOrderNumber}
          </span>
        ) : null}
      </div>

      {delivery.status === 'OUT_FOR_DELIVERY' ? (
        <div className="space-y-1 rounded-lg border border-brand/30 bg-brand/5 px-4 py-3">
          <p className="font-semibold text-text-primary">{tl('shipped')}</p>
          <p className="text-sm text-text-secondary">{tl('shippedHero')}</p>
          <p className="text-sm font-medium text-brand">{tl('shippedAwaitingConfirm')}</p>
        </div>
      ) : null}

      {delivery.status === 'DELIVERED' ? (
        <div className="space-y-1 rounded-lg border border-emerald-300/40 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
          <p className="font-semibold text-text-primary">{tl('tabs.delivered')}</p>
          <p className="text-sm text-text-secondary">{tl('deliveryConfirmedByDealer')}</p>
          {delivery.customerConfirmedAt ? (
            <p className="text-sm text-text-secondary" dir="ltr">
              {tl('deliveredOn', {
                date: new Date(delivery.customerConfirmedAt).toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }),
              })}
            </p>
          ) : null}
          {delivery.recipientName ? (
            <p className="text-xs text-text-tertiary">
              {tc('recipient')}: {delivery.recipientName}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{ti('loadSheetTitle')}</h2>
            <p className="text-sm text-text-secondary">{ti('loadSheetHint')}</p>
          </div>
          {sheet ? (
            <div className="text-end">
              <p className="text-sm font-medium text-text-primary" dir="ltr">
                {ti('loadSheetProgress', {
                  loaded: sheet.loadProgress.loaded,
                  total: sheet.loadProgress.total,
                })}
              </p>
              {sheet.allLoaded && !departed ? (
                <p className="text-xs font-medium text-brand">{ti('loadSheetReadyToDepart')}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {loadSheetQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : loadSheetQuery.isError ? (
          <ErrorState
            title={ti('loadSheetTitle')}
            onRetry={() => loadSheetQuery.refetch()}
            retryLabel={tCommon('retry')}
          />
        ) : !sheet || sheet.products.length === 0 ? (
          <EmptyState title={ti('loadSheetNoPackages')} />
        ) : (
          <div className="space-y-4">
            {sheet.products.map((product) => (
              <div key={product.inventoryLotId} className="space-y-2">
                <div className="flex items-center gap-3">
                  <InventoryItemThumb
                    src={product.imageUrl}
                    alt={productName(product, locale)}
                    size={40}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {productName(product, locale)}
                    </p>
                    <p className="text-xs text-text-tertiary" dir="ltr">
                      {product.sku}
                      {product.productionOrder?.number
                        ? ` · ${product.productionOrder.number}`
                        : ''}
                      {product.warehouse
                        ? ` · ${product.warehouse.code}`
                        : ''}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {product.pieces.map((piece) => {
                    const checked = Boolean(piece.loadedAt);
                    return (
                      <li key={piece.id}>
                        <button
                          type="button"
                          disabled={departed || busyPieceId === piece.id}
                          onClick={() =>
                            pieceMutation.mutate({
                              pieceId: piece.id,
                              loaded: !checked,
                            })
                          }
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition ${
                            checked
                              ? 'border-brand/40 bg-brand/5'
                              : 'border-[var(--maher-border)] hover:border-brand/50'
                          } ${departed ? 'cursor-default opacity-80' : ''}`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
                              checked
                                ? 'border-brand bg-brand text-white'
                                : 'border-[var(--maher-border)] text-transparent'
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                          <span className="min-w-0 flex-1 text-text-primary">
                            {pieceLabel(piece, locale)}
                          </span>
                          <span className="text-[11px] text-text-tertiary">
                            {checked ? ti('loadSheetOnTruck') : ti('loadSheetTapToCheck')}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {canShowDepartCta ? (
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 space-y-2 border-t border-[var(--maher-border)] bg-[var(--maher-surface)]/95 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-0 sm:rounded-b-xl">
            {missing > 0 ? (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {ti('loadSheetMissing', { count: missing })}
              </p>
            ) : null}
            <Button
              disabled={!sheet?.canDepart || missing > 0}
              loading={departMutation.isPending}
              onClick={() => setDepartOpen(true)}
              className="w-full sm:w-auto"
            >
              {ti('loadSheetConfirmDepart')}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{tc('deliveryLocation')}</h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={pinLat == null || pinLng == null}
            loading={saveLocationMutation.isPending}
            onClick={() => saveLocationMutation.mutate()}
          >
            {tc('saveLocation')}
          </Button>
        </div>
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
              void apiFetch(`/api/v1/deliveries/${params.id}/location`, {
                method: 'PATCH',
                body: JSON.stringify({ deliveryAddress: address, latitude: pinLat, longitude: pinLng }),
              }).then(() => queryClient.invalidateQueries({ queryKey: ['delivery', params.id] }));
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">{tCommon('status')}</h2>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_STATUSES.map((status) => {
            const reached =
              STATUS_FLOW.indexOf(delivery.status as (typeof STATUS_FLOW)[number]) >=
                STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]) ||
              delivery.status === status;
            return (
              <span
                key={status}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  delivery.status === status
                    ? 'border-brand bg-brand/10 font-semibold text-brand'
                    : reached && STATUS_FLOW.includes(status as (typeof STATUS_FLOW)[number])
                      ? 'border-border text-text-secondary'
                      : 'border-border text-text-tertiary'
                }`}
              >
                {tStatus(status as never)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
        <p>
          {tc('recipientName')}: {delivery.recipientName ?? '—'}
        </p>
        <p>
          {tc('driver')}: {driverName}
        </p>
        {delivery.failureReason ? (
          <p>
            {tc('failureReason')}: {delivery.failureReason}
          </p>
        ) : null}
        {delivery.notes ? (
          <p>
            {tc('notes')}: {delivery.notes}
          </p>
        ) : null}
      </div>

      {delivery.signatureData ? (
        <div>
          <p className="mb-1 text-sm font-medium">{tc('signature')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={delivery.signatureData}
            alt={tc('signature')}
            className="max-h-32 rounded border border-border bg-white"
          />
        </div>
      ) : null}

      {!terminal ? (
        <div className="flex flex-wrap gap-2">
          {next && next !== 'OUT_FOR_DELIVERY' && next !== 'DELIVERED' ? (
            <Button
              loading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  status: next,
                  driverId: undefined,
                })
              }
            >
              {advanceActionLabel(next, tStatus, tc, tl)}
            </Button>
          ) : null}
          {delivery.status !== 'FAILED' ? (
            <Button variant="danger" onClick={() => setFailOpen(true)}>
              {tc('markFailed')}
            </Button>
          ) : null}
          {delivery.status === 'READY' || delivery.status === 'PLANNED' ? (
            <Select
              label={tc('defaultDriver')}
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{tc('currentUser')}</option>
              {(driversQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">{tCommon('items')}</h2>
        {items.length === 0 ? (
          <EmptyState title={tc('noLines')} />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{tc('description')}</TableHeaderCell>
                <TableHeaderCell>{tc('qty')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>
                    <span dir="ltr">{String(item.quantity)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ConfirmDialog
        open={departOpen}
        onClose={() => setDepartOpen(false)}
        title={ti('loadSheetConfirmDepartTitle')}
        description={ti('loadSheetConfirmDepartBody')}
        confirmLabel={ti('loadSheetConfirmDepart')}
        loading={departMutation.isPending}
        error={formError}
        onConfirm={() => departMutation.mutate()}
      />

      <Modal
        open={failOpen}
        onClose={() => setFailOpen(false)}
        title={tc('markFailed')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFailOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={statusMutation.isPending}
              onClick={() =>
                statusMutation.mutate({
                  status: 'FAILED',
                  failureReason: failureReason.trim() || undefined,
                })
              }
            >
              {tc('markFailed')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <Input
            label={tc('failureReason')}
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
          />
        </div>
      </Modal>
      </MotionSection>
    </div>
  );
}
