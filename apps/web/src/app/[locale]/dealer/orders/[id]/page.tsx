'use client';

import { OrderLifecycleStepper } from '@/components/order-lifecycle-stepper';
import { BackButton } from '@/components/back-button';
import { DealerOrderDetails } from '@/components/dealer-order-details';
import { ProductionScheduleCard } from '@/components/production-schedule-card';
import { DealerOrderWorkflowGraph } from '@/components/dealer-order-workflow-graph';
import { apiFetch, API_URL } from '@/lib/api-client';
import {
  isConfirmReceiptVisible,
  mapConfirmReceiptErrorCode,
} from '@/lib/dealer-order-ui';
import { Board, BoardSkeleton, Button, ConfirmDialog, Ltr, Meter, MotionSection, Stamp, type BoardTone } from '@maher/ui';
import { useRouter } from '@/i18n/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, Truck, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface CustomerRequestItem {
  id: string;
  productName: string;
  description?: string | null;
  quantity: string | number;
  fabricType?: string | null;
  fabricColor?: string | null;
  material?: string | null;
  notes?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  woodType?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  customMeasurements?: Array<{ label: string; value: string }> | null;
}

interface CustomerRequest {
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  endCustomerFax?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  requiredDeliveryDate?: string | null;
  externalOrderNumber?: string | null;
  notes?: string | null;
  translatedText?: string | null;
  originalText?: string | null;
  items?: CustomerRequestItem[];
  documents?: Array<{
    id: string;
    fileName: string;
    mimeType?: string | null;
    category?: string | null;
  }>;
}

interface ProductionPhoto {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
  createdAt?: string;
}

interface ProductionOrder {
  id: string;
  number: string;
  status: string;
  currentStageCode?: string | null;
  progressPercent: number;
  stages: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    sortOrder: number;
    status: string;
    progressPercent: number;
  }>;
  photos?: ProductionPhoto[];
}

interface Delivery {
  id: string;
  number: string;
  status: string;
  deliveryDate?: string | null;
  deliveryWindow?: string | null;
  recipientName?: string | null;
  deliveryAddress?: string | null;
}

interface OrderDetail {
  number: string;
  status: string;
  requiredDeliveryDate?: string | null;
  deliveryAddress?: string | null;
  externalOrderNumber?: string | null;
  customerRequest?: CustomerRequest | null;
  orderedItems?: CustomerRequestItem[];
  productionOrders?: ProductionOrder[];
  deliveries?: Delivery[];
  progressPercent?: number | null;
  progressLabel?: string | null;
  title?: string | null;
  imageUrl?: string | null;
}

function statusTone(status: string | null | undefined): BoardTone {
  const key = (status ?? '').toUpperCase();
  if (/(DELIVERED|COMPLETED|ACCEPTED|APPROVED|PASSED)/.test(key)) return 'success';
  if (/(REJECTED|CANCEL|OVERDUE|FAILED)/.test(key)) return 'error';
  if (/(NEED|PENDING|WAITING|DRAFT|SUBMITTED|OUT_FOR_DELIVERY)/.test(key)) return 'warning';
  if (/(PRODUCTION|PROGRESS|CONFIRMED|SHIPPED|READY|IN_TRANSIT|PLANNED)/.test(key)) return 'brand';
  return 'neutral';
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');
  const tl = useTranslations('lifecycle');
  const tNav = useTranslations('navigation');
  const tStatus = useTranslations('statuses');
  const router = useRouter();
  const statusLabel = (code: string | null | undefined) => {
    if (!code) return '—';
    try {
      return tStatus(code as 'PENDING');
    } catch {
      return code.replaceAll('_', ' ').toLowerCase();
    }
  };
  const [confirmDeliveryId, setConfirmDeliveryId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => apiFetch<OrderDetail>(`/api/v1/sales-orders/${params.id}`),
  });

  const queryClient = useQueryClient();
  const confirmReceiptMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      apiFetch(`/api/v1/deliveries/${deliveryId}/confirm-receipt`, { method: 'POST' }),
    onSuccess: async () => {
      setConfirmDeliveryId(null);
      setConfirmError(null);
      await queryClient.invalidateQueries({ queryKey: ['order', params.id] });
      await queryClient.invalidateQueries({ queryKey: ['customer-own-deliveries'] });
      await queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    },
    onError: (err: unknown) => {
      const code =
        err && typeof err === 'object' && 'body' in err
          ? (err as { body?: { code?: string } }).body?.code
          : undefined;
      setConfirmError(tl(mapConfirmReceiptErrorCode(code)));
    },
  });

  const docs = data?.customerRequest?.documents ?? [];
  const productionPhotos = useMemo(
    () => (data?.productionOrders ?? []).flatMap((po) => po.photos ?? []),
    [data?.productionOrders],
  );
  const imageDocs = useMemo(() => {
    const fromRequest = docs.filter((d) => {
      if ((d.mimeType ?? '').startsWith('image/')) return true;
      if (
        ['MODEL_IMAGE', 'ORDER_IMAGE', 'HANDWRITTEN_ORDER', 'PRODUCT_IMAGE'].includes(d.category ?? '')
      ) {
        return true;
      }
      return /\.(png|jpe?g|webp|gif|heic)$/i.test(d.fileName);
    });
    const seen = new Set(fromRequest.map((d) => d.id));
    const fromProduction = productionPhotos.filter((d) => {
      if (seen.has(d.id)) return false;
      if ((d.mimeType ?? '').startsWith('image/')) return true;
      return /\.(png|jpe?g|webp|gif|heic)$/i.test(d.fileName);
    });
    return [...fromRequest, ...fromProduction];
  }, [docs, productionPhotos]);

  const linkableDocIds = useMemo(
    () => [...docs.map((d) => d.id), ...productionPhotos.map((d) => d.id)],
    [docs, productionPhotos],
  );

  const docLinksQuery = useQuery({
    queryKey: ['order-doc-links', params.id, linkableDocIds.join(',')],
    enabled: linkableDocIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        linkableDocIds.map(async (id) => {
          try {
            const res = await apiFetch<{ downloadPath: string }>(
              `/api/v1/uploads/documents/${id}/link`,
            );
            return [id, `${API_URL}${res.downloadPath}`] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const galleryUrls = useMemo(() => {
    const urls: string[] = [];
    const productImg = mediaSrc(data?.imageUrl);
    if (productImg) urls.push(productImg);
    for (const doc of imageDocs) {
      const linked = docLinksQuery.data?.[doc.id];
      if (linked && !urls.includes(linked)) urls.push(linked);
    }
    return urls;
  }, [data?.imageUrl, imageDocs, docLinksQuery.data]);

  const heroImage = galleryUrls[0] ?? null;

  if (isLoading || !data) {
    return (
      <div className="space-y-5">
        <BoardSkeleton rows={2} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }

  const req = data.customerRequest;
  const items = req?.items?.length ? req.items : data.orderedItems ?? [];
  const pos = data.productionOrders ?? [];
  const progress = data.progressPercent ?? null;
  const deliveries = data.deliveries ?? [];
  const outForDelivery = deliveries.filter((d) => isConfirmReceiptVisible(d.status));
  const confirmDelivery = outForDelivery.find((d) => d.id === confirmDeliveryId);
  const primaryDeliveryStatus =
    deliveries.find((d) => d.status === 'OUT_FOR_DELIVERY')?.status ??
    deliveries.find((d) => d.status === 'DELIVERED')?.status ??
    deliveries[0]?.status ??
    null;

  return (
    <div className="maher-stagger space-y-5">
      <BackButton fallbackHref="/dealer/orders" />

      <OrderLifecycleStepper
        salesOrderStatus={data.status}
        deliveryStatus={primaryDeliveryStatus}
        productionOrders={pos.map((po) => ({
          status: po.status,
          currentStageCode: po.currentStageCode,
          progressPercent: po.progressPercent,
        }))}
      />

      <Board tone={statusTone(data.status)} wash="top" className="overflow-hidden">
        <div className="relative bg-[var(--maher-surface-muted)]">
          <div className="relative mx-auto aspect-[4/3] w-full max-h-[22rem] sm:aspect-[16/10] sm:max-h-[26rem]">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={data.title ?? data.number}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-tertiary">
                <Armchair className="h-12 w-12 opacity-40" />
                <Ltr className="text-xs font-medium uppercase tracking-wide">{data.number}</Ltr>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--maher-border)] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Ltr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{data.number}</Ltr>
              <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{data.title || data.number}</h1>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--maher-text-secondary)]">
                {data.externalOrderNumber || req?.externalOrderNumber ? (
                  <span>
                    {t('dealerOrderNumber')}: <Ltr className="font-medium">{data.externalOrderNumber?.trim() || req?.externalOrderNumber}</Ltr>
                  </span>
                ) : null}
                {data.requiredDeliveryDate || req?.requiredDeliveryDate ? (
                  <span>
                    {tl('timelineReady')}: <Ltr className="font-medium">{(data.requiredDeliveryDate ?? req?.requiredDeliveryDate)?.slice(0, 10)}</Ltr>
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Stamp tone={statusTone(data.status)}>{statusLabel(data.status)}</Stamp>
              {data.status === 'DELIVERED' || deliveries.some((d) => d.status === 'DELIVERED') ? (
                <Button size="sm" variant="secondary" leadingIcon={<Undo2 className="h-4 w-4" />} onClick={() => router.push(`/dealer/returns?orderId=${params.id}`)}>
                  {tNav('returns')}
                </Button>
              ) : null}
            </div>
          </div>
          {progress != null ? <Meter value={progress} max={100} tone={statusTone(data.status)} label={t('progress')} valueLabel={data.progressLabel ?? `${progress}%`} /> : null}
        </div>
      </Board>

      {outForDelivery.length > 0 ? (
        <MotionSection delayMs={50}>
          <Board tone="warning" wash="full">
            <div className="flex flex-wrap items-start gap-4 px-5 py-4 sm:px-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--maher-warning-soft)] text-[var(--maher-warning)]">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <h2 className="text-[16px] font-semibold text-[var(--maher-text-primary)]">{tl('shipped')}</h2>
                  <p className="mt-1 text-[13px] text-[var(--maher-text-secondary)]">{tl('shippedHero')}</p>
                  <p className="text-[12px] text-[var(--maher-text-tertiary)]">{tl('shippedAwaitingConfirm')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {outForDelivery.map((d) => (
                    <Button
                      key={d.id}
                      size="sm"
                      onClick={() => {
                        setConfirmError(null);
                        setConfirmDeliveryId(d.id);
                      }}
                      disabled={confirmReceiptMutation.isPending}
                    >
                      {tl('confirmReceived')}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Board>
        </MotionSection>
      ) : null}

      <MotionSection delayMs={60}>
        <DealerOrderDetails
          externalOrderNumber={data.externalOrderNumber?.trim() || req?.externalOrderNumber}
          notes={req?.translatedText || req?.notes}
          endCustomerName={req?.endCustomerName}
          endCustomerPhone={req?.endCustomerPhone}
          endCustomerFax={req?.endCustomerFax}
          deliveryAddress={req?.deliveryAddress ?? data.deliveryAddress}
          deliveryLat={req?.deliveryLat}
          deliveryLng={req?.deliveryLng}
          items={items}
        />
      </MotionSection>

      {docs.length > 0 ? (
        <MotionSection delayMs={100}>
        <Board tone="neutral">
          <Board.Header title={tc('attachmentsSection')} meta={<Stamp tone="neutral" size="sm">{docs.length}</Stamp>} />
          <Board.Body className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => {
              const preview = docLinksQuery.data?.[doc.id];
              const isImage =
                (doc.mimeType ?? '').startsWith('image/') ||
                ['MODEL_IMAGE', 'ORDER_IMAGE', 'HANDWRITTEN_ORDER', 'PRODUCT_IMAGE'].includes(
                  doc.category ?? '',
                ) ||
                /\.(png|jpe?g|webp|gif|heic)$/i.test(doc.fileName);
              return (
                <button
                  key={doc.id}
                  type="button"
                  className="overflow-hidden rounded-xl border border-border text-start transition hover:border-brand/40"
                  onClick={async () => {
                    try {
                      const res = await apiFetch<{ downloadPath: string }>(
                        `/api/v1/uploads/documents/${doc.id}/link`,
                      );
                      window.open(`${API_URL}${res.downloadPath}`, '_blank');
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {isImage && preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt={doc.fileName}
                      className="aspect-[4/3] w-full object-cover object-center transition duration-300 hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-[var(--maher-surface-muted)] text-xs text-text-tertiary">
                      {doc.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                    </div>
                  )}
                  <p className="truncate px-2 py-1.5 text-xs text-text-secondary">{doc.fileName}</p>
                </button>
              );
            })}
          </Board.Body>
        </Board>
        </MotionSection>
      ) : galleryUrls.length > 1 ? (
        <MotionSection delayMs={100}>
        <Board tone="neutral">
          <Board.Header title={tc('attachmentsSection')} />
          <Board.Body className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galleryUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                className="group overflow-hidden rounded-xl border border-border bg-[var(--maher-surface-muted)]"
                onClick={() => window.open(url, '_blank')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="aspect-[4/3] w-full object-cover object-center transition duration-300 group-hover:scale-[1.05]"
                />
              </button>
            ))}
          </Board.Body>
        </Board>
        </MotionSection>
      ) : null}

      <MotionSection delayMs={140}>
      <Board tone="brand">
        <Board.Header title={t('tracking')} meta={pos.length ? <Stamp tone="brand" size="sm">{pos.length}</Stamp> : undefined} />
        {pos.length === 0 ? (
          <Board.Empty title={t('noProductionYet')} />
        ) : (
          <Board.Body className="space-y-6">
            {pos.map((po) => (
              <div key={po.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    <Ltr>{po.number}</Ltr>
                  </p>
                  <Stamp tone={statusTone(po.status)} size="sm">{statusLabel(po.status)}</Stamp>
                </div>
                <div className="mb-4">
                  <Meter value={po.progressPercent} max={100} tone={statusTone(po.status)} valueLabel={`${Math.round(po.progressPercent)}%`} />
                </div>
                <DealerOrderWorkflowGraph
                  productionOrderId={po.id}
                  fallbackStages={po.stages}
                  photos={po.photos}
                />
                {(po.photos ?? []).length > 0 ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium">{t('productionPhotos')}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(po.photos ?? []).map((photo) => {
                        const preview = docLinksQuery.data?.[photo.id];
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            className="overflow-hidden rounded-xl border border-border bg-[var(--maher-surface-muted)]"
                            onClick={async () => {
                              try {
                                const res = await apiFetch<{ downloadPath: string }>(
                                  `/api/v1/uploads/documents/${photo.id}/link`,
                                );
                                window.open(`${API_URL}${res.downloadPath}`, '_blank');
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            {preview ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={preview}
                                alt={photo.fileName}
                                className="aspect-[4/3] w-full object-cover object-center"
                              />
                            ) : (
                              <div className="flex aspect-[4/3] items-center justify-center text-xs text-text-tertiary">
                                {photo.fileName}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </Board.Body>
        )}
      </Board>
      </MotionSection>

      {pos.map((po, index) => (
        <MotionSection key={`schedule-${po.id}`} delayMs={160 + index * 20}>
          <ProductionScheduleCard productionOrderId={po.id} />
        </MotionSection>
      ))}

      <MotionSection delayMs={180}>
      <Board tone={primaryDeliveryStatus ? statusTone(primaryDeliveryStatus) : 'neutral'}>
        <Board.Header title={t('deliveryStatus')} />
        {deliveries.length === 0 ? (
          <Board.Empty title={tCommon('none')} />
        ) : (
          <ul className="divide-y divide-[var(--maher-border)]">
            {deliveries.map((d) => (
              <li key={d.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <Ltr>{d.number}</Ltr>
                  </p>
                  <Stamp tone={statusTone(d.status)} size="sm">{statusLabel(d.status)}</Stamp>
                </div>
                {d.deliveryDate ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {d.status === 'DELIVERED' ? tl('deliveredOn', { date: d.deliveryDate.slice(0, 10) }) : tl('shippedOn', { date: d.deliveryDate.slice(0, 10) })}
                  </p>
                ) : null}
                {d.status === 'DELIVERED' ? (
                  <p className="mt-1 text-xs text-success">{tl('receiptConfirmed')}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Board>
      </MotionSection>

      <ConfirmDialog
        open={Boolean(confirmDeliveryId)}
        onClose={() => {
          if (confirmReceiptMutation.isPending) return;
          setConfirmDeliveryId(null);
          setConfirmError(null);
        }}
        title={tl('confirmReceiptTitle')}
        description={tl('confirmReceiptBody')}
        confirmLabel={tl('confirmReceived')}
        cancelLabel={tCommon('cancel')}
        loading={confirmReceiptMutation.isPending}
        error={confirmError}
        onConfirm={() => {
          if (confirmDeliveryId) confirmReceiptMutation.mutate(confirmDeliveryId);
        }}
      >
        <div className="flex gap-3 rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--maher-surface)]">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <Armchair className="h-6 w-6 text-[var(--maher-text-tertiary)]" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Ltr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{data.number}</Ltr>
            <p className="font-semibold text-[var(--maher-text-primary)]">{data.title || data.number}</p>
            {items[0]?.quantity != null ? <p className="mt-1 text-[12px] text-[var(--maher-text-secondary)]">×{String(items[0].quantity)}</p> : null}
            {confirmDelivery ? <Ltr className="mt-1 block text-[12px] text-[var(--maher-text-secondary)]">{confirmDelivery.number}</Ltr> : null}
          </div>
        </div>
        {confirmReceiptMutation.isSuccess ? <p className="mt-3 text-[13px] text-[var(--maher-success)]">{tl('confirmReceiptSuccess')}</p> : null}
      </ConfirmDialog>
    </div>
  );
}
