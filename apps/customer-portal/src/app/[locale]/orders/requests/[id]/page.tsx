'use client';

import { BackButton } from '@/components/back-button';
import { DealerOrderDetails } from '@/components/dealer-order-details';
import { apiFetch, API_URL } from '@/lib/api-client';
import { Alert, Card, ErrorState, Ltr, MotionSection, Skeleton, StatusBadge } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { Armchair } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

interface RequestItem {
  id: string;
  productName: string;
  description?: string | null;
  quantity: string | number;
  fabricType?: string | null;
  fabricColor?: string | null;
  width?: string | number | null;
  height?: string | number | null;
  depth?: string | number | null;
  notes?: string | null;
  customMeasurements?: Array<{ label: string; value: string }> | null;
}

interface RequestDoc {
  id: string;
  fileName: string;
  mimeType?: string | null;
  category?: string | null;
}

interface RequestDetail {
  id: string;
  number: string;
  status: string;
  externalOrderNumber?: string | null;
  endCustomerName?: string | null;
  endCustomerPhone?: string | null;
  endCustomerFax?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  notes?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  informationRequestReason?: string | null;
  items?: RequestItem[];
  documents?: RequestDoc[];
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function isImageDoc(doc: RequestDoc) {
  if ((doc.mimeType ?? '').startsWith('image/')) return true;
  if (['MODEL_IMAGE', 'ORDER_IMAGE', 'HANDWRITTEN_ORDER', 'PRODUCT_IMAGE'].includes(doc.category ?? '')) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif|heic)$/i.test(doc.fileName);
}

export default function CustomerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const tc = useTranslations('catalog');
  const t = useTranslations('sales');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');

  const query = useQuery({
    queryKey: ['customer-request', id],
    queryFn: () => apiFetch<RequestDetail>(`/api/v1/requests/${id}`),
    enabled: Boolean(id),
  });

  const docs = query.data?.documents ?? [];
  const imageDocs = docs.filter(isImageDoc);

  const docLinksQuery = useQuery({
    queryKey: ['request-doc-links', id, imageDocs.map((d) => d.id).join(',')],
    enabled: imageDocs.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        imageDocs.map(async (doc) => {
          try {
            const res = await apiFetch<{ downloadPath: string }>(
              `/api/v1/uploads/documents/${doc.id}/link`,
            );
            return [doc.id, `${API_URL}${res.downloadPath}`] as const;
          } catch {
            return [doc.id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries) as Record<string, string | null>;
    },
  });

  const galleryUrls = useMemo(() => {
    const urls: string[] = [];
    const catalog = mediaSrc(query.data?.imageUrl);
    if (catalog) urls.push(catalog);
    for (const doc of imageDocs) {
      const linked = docLinksQuery.data?.[doc.id];
      if (linked && !urls.includes(linked)) urls.push(linked);
    }
    return urls;
  }, [query.data?.imageUrl, imageDocs, docLinksQuery.data]);

  const heroImage = galleryUrls[0] ?? null;

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={tNav('myOrders')}
        description={tCommon('loadFailed')}
        onRetry={() => void query.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const req = query.data;
  const item = req.items?.[0];

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
                alt={req.title ?? item?.productName ?? req.number}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-tertiary">
                <Armchair className="h-12 w-12 opacity-40" />
                <Ltr className="text-xs font-medium uppercase tracking-wide">{req.number}</Ltr>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
            <div className="absolute start-3 top-3">
              <StatusBadge status={req.status} />
            </div>
          </div>
        </div>
        <div className="space-y-1 border-t border-border p-4 sm:p-5">
          <h1 className="text-2xl font-bold tracking-tight">
            {req.title ?? item?.productName ?? req.number}
          </h1>
          <p className="text-sm text-text-secondary">
            <span className="text-text-tertiary">{t('systemOrderNumber')}: </span>
            <Ltr>{req.number}</Ltr>
            {req.externalOrderNumber ? (
              <>
                {' · '}
                <span className="text-text-tertiary">{t('dealerOrderNumber')}: </span>
                <Ltr>{req.externalOrderNumber}</Ltr>
              </>
            ) : null}
          </p>
        </div>
      </MotionSection>

      {req.informationRequestReason ? (
        <MotionSection delayMs={40}>
          <Alert variant="warning">
            <p className="font-medium">{tc('informationRequestReason')}</p>
            <p className="mt-1 text-sm">{req.informationRequestReason}</p>
          </Alert>
        </MotionSection>
      ) : null}

      <MotionSection delayMs={60}>
        <DealerOrderDetails
          externalOrderNumber={req.externalOrderNumber}
          notes={req.notes}
          endCustomerName={req.endCustomerName}
          endCustomerPhone={req.endCustomerPhone}
          endCustomerFax={req.endCustomerFax}
          deliveryAddress={req.deliveryAddress}
          deliveryLat={req.deliveryLat}
          deliveryLng={req.deliveryLng}
          items={req.items}
        />
      </MotionSection>

      {docs.length > 0 ? (
        <MotionSection delayMs={100}>
          <Card title={tc('attachmentsSection')} className="maher-form-section">
            <div className="maher-stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => {
                const preview = docLinksQuery.data?.[doc.id];
                const isImage = isImageDoc(doc);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    className="maher-list-card overflow-hidden rounded-xl border border-border text-start"
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
            <div className="maher-stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
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
    </div>
  );
}
