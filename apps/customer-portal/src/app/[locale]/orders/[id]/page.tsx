'use client';

import { BackButton } from '@/components/back-button';
import { DealerOrderDetails } from '@/components/dealer-order-details';
import { ProductionScheduleCard } from '@/components/production-schedule-card';
import { apiFetch, API_URL } from '@/lib/api-client';
import { Card, MotionSection, Skeleton, StatusBadge, cn, Ltr } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Armchair, Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

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

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function stageTone(status: string) {
  if (status === 'COMPLETED') return 'done';
  if (status === 'IN_PROGRESS' || status === 'READY') return 'active';
  if (status === 'BLOCKED') return 'blocked';
  return 'pending';
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tc = useTranslations('catalog');

  const { data, isLoading } = useQuery({
    queryKey: ['order', params.id],
    queryFn: () => apiFetch<OrderDetail>(`/api/v1/sales-orders/${params.id}`),
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
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const req = data.customerRequest;
  const items = req?.items?.length ? req.items : data.orderedItems ?? [];
  const pos = data.productionOrders ?? [];
  const progress = data.progressPercent ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackButton fallbackHref="/orders" />

      <MotionSection className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
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
            {progress != null ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-3 pt-12">
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-white">
                  <span>{t('progress')}</span>
                  <Ltr>{data.progressLabel ?? `${progress}%`}</Ltr>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-[var(--maher-brand)] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{data.title || data.number}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                <span className="text-text-tertiary">{t('systemOrderNumber')}: </span>
                <Ltr>{data.number}</Ltr>
                {(data.externalOrderNumber || req?.externalOrderNumber) && (
                  <>
                    {' · '}
                    <span className="text-text-tertiary">{t('dealerOrderNumber')}: </span>
                    <Ltr>
                      {data.externalOrderNumber?.trim() || req?.externalOrderNumber}
                    </Ltr>
                  </>
                )}
              </p>
            </div>
            <StatusBadge status={data.status} />
          </div>
          {(data.requiredDeliveryDate || req?.requiredDeliveryDate) && (
            <p className="text-sm text-text-secondary">
              {t('deliveryDate')}:{' '}
              <Ltr>{(data.requiredDeliveryDate ?? req?.requiredDeliveryDate)?.slice(0, 10)}</Ltr>
            </p>
          )}
        </div>
      </MotionSection>

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
        <Card title={tc('attachmentsSection')} className="maher-form-section">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </Card>
        </MotionSection>
      ) : galleryUrls.length > 1 ? (
        <MotionSection delayMs={100}>
        <Card title={tc('attachmentsSection')} className="maher-form-section">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          </div>
        </Card>
        </MotionSection>
      ) : null}

      <MotionSection delayMs={140}>
      <Card title={t('tracking')} className="maher-form-section">
        {pos.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('noProductionYet')}</p>
        ) : (
          <div className="space-y-6">
            {pos.map((po) => (
              <div key={po.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    <Ltr>{po.number}</Ltr>
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={po.status} />
                    <Ltr className="text-xs text-text-secondary">{po.progressPercent}%</Ltr>
                  </div>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--maher-surface-muted)]">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, po.progressPercent))}%` }}
                  />
                </div>
                <ol className="space-y-0">
                  {(po.stages ?? []).map((stage, idx) => {
                    const tone = stageTone(stage.status);
                    const label =
                      locale.startsWith('ar')
                        ? stage.nameAr || stage.nameEn || stage.code
                        : stage.nameEn || stage.nameAr || stage.code;
                    return (
                      <li key={stage.code} className="relative flex gap-4 pb-5 last:pb-0">
                        {idx < (po.stages?.length ?? 0) - 1 ? (
                          <span
                            aria-hidden
                            className={cn(
                              'absolute start-[15px] top-8 bottom-0 w-0.5',
                              tone === 'done' ? 'bg-brand' : 'bg-border',
                            )}
                          />
                        ) : null}
                        <span
                          className={cn(
                            'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                            tone === 'done' && 'border-brand bg-brand text-white',
                            tone === 'active' && 'border-brand bg-brand-soft text-brand',
                            tone === 'pending' && 'border-border bg-surface text-text-tertiary',
                            tone === 'blocked' &&
                              'border-[var(--maher-error)] bg-[var(--maher-error-soft)] text-[var(--maher-error)]',
                          )}
                        >
                          {tone === 'done' ? <Check className="h-4 w-4" /> : idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 pt-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{label}</p>
                            <Ltr className="text-xs text-text-tertiary">{stage.progressPercent}%</Ltr>
                          </div>
                          <StatusBadge status={stage.status} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
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
          </div>
        )}
      </Card>
      </MotionSection>

      {pos.map((po, index) => (
        <MotionSection key={`schedule-${po.id}`} delayMs={160 + index * 20}>
          <ProductionScheduleCard productionOrderId={po.id} />
        </MotionSection>
      ))}

      <MotionSection delayMs={180}>
      <Card title={t('deliveryStatus')} className="maher-form-section">
        {(data.deliveries ?? []).length === 0 ? (
          <p className="text-sm text-text-secondary">{tCommon('none')}</p>
        ) : (
          <ul className="maher-stagger space-y-3">
            {data.deliveries!.map((d) => (
              <li key={d.id} className="maher-list-card rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <Ltr>{d.number}</Ltr>
                  </p>
                  <StatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </MotionSection>
    </div>
  );
}
