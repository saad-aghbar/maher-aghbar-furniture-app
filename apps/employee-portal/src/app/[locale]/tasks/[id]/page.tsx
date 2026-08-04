'use client';

import { BackButton } from '@/components/back-button';
import { apiFetch, apiUpload, apiUploadFromUrl, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Ltr,
  MotionSection,
  PageHero,
  PhotoAttachField,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName, translateApiError } from '@maher/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Armchair, ImageIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

interface TaskDetail {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  factoryOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  productImageUrl?: string | null;
  productionOrder?: {
    id: string;
    number: string;
    productDescription?: string;
    quantity?: string | number;
    specifications?: string | null;
    product?: {
      id: string;
      imageUrl?: string | null;
      nameEn?: string | null;
      nameAr?: string | null;
    } | null;
    salesOrder?: { id: string; number: string } | null;
  };
  stageDefinition?: {
    code: string;
    nameEn: string;
    nameAr?: string;
    dependsOnCodes?: string[];
    requiresPhotos?: boolean;
  };
  blockers?: Array<{ id: string; reason: string; resolvedAt?: string | null }>;
  photos?: Array<{
    id: string;
    fileName: string;
    downloadPath?: string;
  }>;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['task', params.id],
    queryFn: () => apiFetch<TaskDetail>(`/api/v1/tasks/${params.id}`),
  });

  async function finish() {
    setLoading(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
      await qc.invalidateQueries({ queryKey: ['my-tasks'] });
      await qc.invalidateQueries({ queryKey: ['my-tasks-completed'] });
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('actionFailed')));
    } finally {
      setLoading(false);
    }
  }

  function uploadQuery() {
    if (!data?.productionOrder?.id) return null;
    return new URLSearchParams({
      taskId: data.id,
      productionOrderId: data.productionOrder.id,
      category: `TASK_PHOTO:${data.id}`,
    });
  }

  async function onPickPhoto(file: File) {
    const qs = uploadQuery();
    if (!qs) return;
    setUploading(true);
    setError(null);
    setBanner(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiUpload(`/api/v1/uploads?${qs}`, form);
      setBanner(t('photoUploaded'));
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('uploadFailed')));
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function onAttachUrl(url: string) {
    const qs = uploadQuery();
    if (!qs) return;
    setUploading(true);
    setError(null);
    setBanner(null);
    try {
      await apiUploadFromUrl(`/api/v1/uploads/from-url?${qs}`, { url });
      setBanner(t('photoUploaded'));
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('uploadFailed')));
      throw err;
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-[var(--maher-radius-xl)]" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorState title={t('taskDetail')} onRetry={() => refetch()} />;
  }

  const canFinish = !['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(data.status);
  const canAttach = canFinish;
  const waiting =
    data.status === 'NOT_STARTED' && (data.stageDefinition?.dependsOnCodes?.length ?? 0) > 0
      ? data.stageDefinition!.dependsOnCodes!.join(', ')
      : null;
  const openBlockers = (data.blockers ?? []).filter((b) => !b.resolvedAt);
  const needsPhotos = Boolean(data.stageDefinition?.requiresPhotos) && !(data.photos?.length);
  const factoryNo =
    data.factoryOrderNumber ?? data.productionOrder?.number ?? '—';
  const salesNo =
    data.salesOrderNumber ?? data.productionOrder?.salesOrder?.number ?? null;
  const productImage = mediaSrc(
    data.productImageUrl ?? data.productionOrder?.product?.imageUrl ?? null,
  );
  const productTitle =
    data.productionOrder?.productDescription ??
    (data.productionOrder?.product
      ? localizedName(locale, data.productionOrder.product)
      : null);
  const qty =
    data.productionOrder?.quantity != null ? Number(data.productionOrder.quantity) : null;

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/tasks" />
      <PageHero
        tone="soft"
        title={
          data.stageDefinition
            ? localizedName(locale, data.stageDefinition, data.name)
            : data.name
        }
        description={`${factoryNo} · ${data.number}`}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="text-xs text-text-secondary">
              {t('priority')}: {data.priority}
            </span>
          </div>
        }
      />

      {productTitle ? (
        <MotionSection delayMs={40}>
          <p className="text-sm font-medium text-text-primary">
            {productTitle}
            {qty != null ? (
              <Ltr className="ms-1 text-text-secondary">× {qty}</Ltr>
            ) : null}
          </p>
        </MotionSection>
      ) : null}

      {waiting ? (
        <Alert variant="warning">
          {t('notReady')} ({t('waitingFor')}: {waiting})
        </Alert>
      ) : null}
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {needsPhotos ? <Alert variant="warning">{tc('photosRequired')}</Alert> : null}
      {openBlockers.length > 0 ? (
        <Alert variant="warning">{t('blockedReason')}: {openBlockers[0]?.reason}</Alert>
      ) : null}

      <MotionSection delayMs={80}>
        <Card title={t('taskDetail')} className="maher-form-section">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-tertiary">{t('factoryOrderNumber')}</p>
                <p className="mt-0.5 font-semibold tracking-tight" dir="ltr">
                  {factoryNo}
                </p>
                {salesNo ? (
                  <p className="mt-1 text-[11px] text-text-tertiary" dir="ltr">
                    {t('salesOrderNumber')}: {salesNo}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs text-text-tertiary">{t('taskNumber')}</p>
                <p className="mt-0.5 font-medium" dir="ltr">
                  {data.number}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-text-tertiary">{t('orderProduct')}</p>
              <div className="overflow-hidden rounded-xl border border-border bg-[var(--maher-surface-muted)]">
                {productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImage}
                    alt={productTitle ?? factoryNo}
                    className="aspect-[5/4] w-full object-cover transition duration-300 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[5/4] flex-col items-center justify-center gap-2 text-text-tertiary">
                    <Armchair className="h-10 w-10 opacity-40" />
                    <span className="text-xs">{t('noProductImage')}</span>
                  </div>
                )}
              </div>
            </div>

            {data.description ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-tertiary">
                  {t('stageInstructions')}
                </p>
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-text-primary">
                  {data.description}
                </div>
              </div>
            ) : null}

            {data.productionOrder?.specifications ? (
              <div>
                <p className="mb-1 text-xs text-text-tertiary">{t('specifications')}</p>
                <p className="text-sm text-text-secondary">{data.productionOrder.specifications}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-xs font-medium text-text-tertiary">{t('attachedPhotos')}</p>
              {canAttach ? (
                <PhotoAttachField
                  className="mb-3"
                  hint={tCommon('photoUrlHint')}
                  disabled={uploading || loading}
                  uploadLabel={t('addPhoto')}
                  uploadingLabel={t('uploadingPhoto')}
                  attachUrlLabel={tCommon('attachFromUrl')}
                  onUploadFile={onPickPhoto}
                  onAttachUrl={onAttachUrl}
                />
              ) : null}
              {(data.photos?.length ?? 0) > 0 ? (
                <div className="maher-stagger grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {data.photos!.map((photo) => {
                    const src = mediaSrc(photo.downloadPath);
                    return (
                      <a
                        key={photo.id}
                        href={src ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="maher-list-card group overflow-hidden rounded-lg border border-border bg-[var(--maher-surface-muted)]"
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={photo.fileName}
                            className="aspect-square w-full object-cover transition group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-text-tertiary">
                            <ImageIcon className="h-5 w-5 opacity-50" />
                          </div>
                        )}
                        <p className="truncate px-1.5 py-1 text-[10px] text-text-tertiary">
                          {photo.fileName}
                        </p>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">{t('noAttachedPhotos')}</p>
              )}
            </div>

            <div className="maher-detail-sticky-actions">
              <Button
                size="lg"
                className="w-full"
                onClick={() => void finish()}
                loading={loading}
                disabled={!canFinish || openBlockers.length > 0 || needsPhotos || uploading}
              >
                {t('complete')}
              </Button>
            </div>
          </div>
        </Card>
      </MotionSection>
    </div>
  );
}
