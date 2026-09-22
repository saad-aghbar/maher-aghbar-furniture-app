'use client';

import { VoiceNote } from '@/components/voice-note';
import { FabricDispositionSheet, TaskFabricBoard, useTaskFabric } from '@/components/worker/task-fabric-board';
import { QualityGatePanel, useQualityFloor } from '@/components/worker/quality-gate-panel';
import { RecoveryFloorPanel, useRecoveryPiece } from '@/components/worker/recovery-floor-panel';
import { classifyTaskQualityKind, countPriorFails } from '@/lib/task-quality-kind';
import { useRouter } from '@/i18n/navigation';
import { apiFetch, apiUpload, apiUploadFromUrl, API_URL } from '@/lib/api-client';
import { isScheduledForToday, toDateOnly } from '@/lib/worker-scheduling';
import {
  ActionDock,
  Alert,
  Board,
  BoardSkeleton,
  Button,
  CameraCapture,
  DetailHero,
  ErrorBoard,
  Figure,
  HoldButton,
  KeyFacts,
  Ltr,
  Menu,
  Meter,
  PhotoAttachField,
  Sheet,
  Stamp,
  TextArea,
  Ticket,
  useCodeScanner,
  type BoardTone,
} from '@maher/ui';
import { localizedName, translateApiError } from '@maher/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Armchair, ImageIcon, MoreHorizontal, PackageOpen, Pause, Play, ScanLine } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

interface TaskDetail {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  factoryOrderNumber?: string | null;
  salesOrderNumber?: string | null;
  plannedStart?: string | null;
  plannedCompletion?: string | null;
  productImageUrl?: string | null;
  timing?: {
    status: string;
    actualMinutes: number;
    openStartedAt: string | null;
    estimatedMinutes: number | null;
    plannedCompletion: string | null;
    elapsedMinutes: number;
  };
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
    returnRequestId?: string | null;
    returnPieceId?: string | null;
  };
  isRework?: boolean;
  stageDefinition?: {
    code: string;
    executionKind?: string | null;
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

function statusTone(status: string): BoardTone {
  const key = status.toUpperCase();
  if (key === 'IN_PROGRESS') return 'brand';
  if (key === 'COMPLETED') return 'success';
  if (key === 'PAUSED') return 'warning';
  if (key === 'BLOCKED' || key === 'CANCELLED') return 'error';
  if (key === 'READY') return 'info';
  return 'neutral';
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
  const tNav = useTranslations('navigation');
  const qc = useQueryClient();
  const { openScanner } = useCodeScanner();
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dispositionOpen, setDispositionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const tStatus = useTranslations('statuses');
  const tMobileProd = useTranslations('mobile.production');
  const tQuality = useTranslations('mobile.quality');
  const router = useRouter();

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: ['task', params.id],
    queryFn: () => apiFetch<TaskDetail>(`/api/v1/tasks/${params.id}`),
  });

  async function runAction(path: 'start' | 'pause' | 'resume' | 'complete') {
    setLoading(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(path === 'complete' && confirmedPackages.length ? { confirmedPackageLabels: confirmedPackages } : {}),
      });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
      await qc.invalidateQueries({ queryKey: ['my-tasks'] });
      await qc.invalidateQueries({ queryKey: ['my-tasks-completed'] });
      setBanner(path === 'start' ? t('startTask') : path === 'pause' ? t('stopTimer') : path === 'resume' ? t('resumeTask') : t('complete'));
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('actionFailed')));
    } finally {
      setLoading(false);
    }
  }

  const fabric = useTaskFabric(params.id, Boolean(data));
  const stageCodeForKind = (data?.stageDefinition?.code ?? '').toUpperCase();
  const floorCtx = useQualityFloor(data?.productionOrder?.id, Boolean(data) && (Boolean(data?.isRework) || /INSPECTION|QC|PACKAGING|PACK/.test(stageCodeForKind)));
  const recovery = useRecoveryPiece(data?.productionOrder?.returnRequestId, data?.productionOrder?.returnPieceId);
  const [packagesReady, setPackagesReady] = useState(false);
  const [confirmedPackages, setConfirmedPackages] = useState<string[]>([]);
  const onPackagesReady = useCallback((ready: boolean, labels: string[]) => {
    setPackagesReady(ready);
    setConfirmedPackages(labels);
  }, []);
  async function finish() {
    // Fabric stages record leftovers (return / scrap) before the stage closes.
    if (fabric.relevant && fabric.openLots.length > 0) {
      setDispositionOpen(true);
      return;
    }
    await runAction('complete');
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
      <div className="space-y-5">
        <BoardSkeleton rows={3} />
        <BoardSkeleton rows={6} />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorBoard title={t('taskDetail')} description={loadError ? translateApiError(locale, loadError, tCommon('loadFailed')) : tCommon('loadFailed')} onRetry={() => refetch()} retryLabel={tCommon('retry')} />;
  }

  const waiting = data.status === 'NOT_STARTED' && (data.stageDefinition?.dependsOnCodes?.length ?? 0) > 0 ? data.stageDefinition!.dependsOnCodes!.join(', ') : null;
  const canFinish = !['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(data.status);
  const canStart = ['NOT_STARTED', 'READY'].includes(data.status) && !waiting;
  const canStop = data.status === 'IN_PROGRESS';
  const canResume = data.status === 'PAUSED' && !waiting;
  const canAttach = canFinish;
  const openBlockers = (data.blockers ?? []).filter((b) => !b.resolvedAt);
  const needsPhotos = Boolean(data.stageDefinition?.requiresPhotos) && !(data.photos?.length) && !/INSPECTION|QC/.test((data.stageDefinition?.code ?? '').toUpperCase());
  const factoryNo = data.factoryOrderNumber ?? data.productionOrder?.number ?? '—';
  const salesNo = data.salesOrderNumber ?? data.productionOrder?.salesOrder?.number ?? null;
  const productImage = mediaSrc(data.productImageUrl ?? data.productionOrder?.product?.imageUrl ?? null);
  const productTitle = data.productionOrder?.productDescription ?? (data.productionOrder?.product ? localizedName(locale, data.productionOrder.product) : null);
  const qty = data.productionOrder?.quantity != null ? Number(data.productionOrder.quantity) : null;
  const scheduledToday = isScheduledForToday(data.plannedStart) || isScheduledForToday(data.plannedCompletion);
  const tone = openBlockers.length ? 'error' : statusTone(data.status);
  const statusLabel = (() => {
    try {
      return tStatus(data.status as 'PENDING');
    } catch {
      return data.status.replaceAll('_', ' ').toLowerCase();
    }
  })();
  const elapsed = data.timing?.elapsedMinutes ?? 0;
  const estimated = data.timing?.estimatedMinutes ?? null;
  const qualityKind = classifyTaskQualityKind({ stageCode: data.stageDefinition?.code, executionKind: data.stageDefinition?.executionKind, isRework: data.isRework, priorFailCount: Math.max(countPriorFails(floorCtx.data?.inspections), floorCtx.data?.lightAnalytics?.reworkCount ?? 0) });
  const isQcGate = qualityKind === 'inspection' || qualityKind === 'reinspection';
  const isPackaging = qualityKind === 'packaging';
  const isRecovery = qualityKind === 'recovery';
  const finishBlocked = !canFinish || openBlockers.length > 0 || needsPhotos || uploading || isQcGate || (isPackaging && !packagesReady) || (isRecovery && recovery.finishBlocked);
  const stageTitle = data.stageDefinition ? localizedName(locale, data.stageDefinition, data.name) : data.name;
  const fmtMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  async function quickAction(kind: 'identify') {
    setError(null);
    setBanner(null);
    try {
      if (kind === 'identify') {
        const code = await openScanner({ title: t('materialsIdentify') });
        if (!code) return;
        await apiFetch(`/api/v1/tasks/${params.id}/material-usage/identify`, { method: 'POST', body: JSON.stringify({ code }) });
        setBanner(t('materialsIdentify'));
        return;
      }
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('actionFailed')));
    }
  }

  async function reportProblem() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/block`, { method: 'POST', body: JSON.stringify({ reason: problemReason.trim() || t('reportProblem'), category: 'OTHER' }) });
      setBanner(t('reportProblem'));
      setProblemOpen(false);
      setProblemReason('');
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
    } catch (err) {
      setError(translateApiError(locale, err, tCommon('actionFailed')));
    } finally {
      setLoading(false);
    }
  }

  const primaryControl = canStart ? (
    <Button size="lg" leadingIcon={<Play className="h-4 w-4" />} onClick={() => void runAction('start')} loading={loading}>
      {t('startTask')}
    </Button>
  ) : canResume ? (
    <Button size="lg" leadingIcon={<Play className="h-4 w-4" />} onClick={() => void runAction('resume')} loading={loading}>
      {t('resumeTask')}
    </Button>
  ) : canStop ? (
    <Button size="lg" variant="secondary" leadingIcon={<Pause className="h-4 w-4" />} onClick={() => void runAction('pause')} loading={loading}>
      {t('stopTimer')}
    </Button>
  ) : undefined;

  return (
    <div className="maher-stagger space-y-5 pb-28 md:pb-0">
      <DetailHero
        tone={tone}
        back={{ label: tNav('tasks'), onClick: () => router.push('/worker/tasks') }}
        code={data.number}
        title={stageTitle}
        subtitle={productTitle ? <span>{productTitle}{qty != null ? <Ltr className="ms-1 text-[var(--maher-text-tertiary)]">× {qty}</Ltr> : null}</span> : undefined}
        status={{ label: statusLabel, tone }}
        media={
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[14px] bg-[var(--maher-surface-muted)] sm:h-20 sm:w-20">
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <Armchair className="h-7 w-7 text-[var(--maher-text-tertiary)] opacity-60" />
            )}
          </span>
        }
        facts={[
          { label: t('factoryOrderNumber'), value: factoryNo, ltr: true },
          ...(salesNo ? [{ label: t('salesOrderNumber'), value: salesNo, ltr: true }] : []),
          { label: t('priority'), value: (() => { try { return tMobileProd(`priority.${data.priority}` as never); } catch { return data.priority; } })(), tone: /URGENT|HIGH|CRITICAL/i.test(data.priority) ? ('error' as const) : undefined },
          ...(data.plannedCompletion ? [{ label: t('plannedCompletion'), value: toDateOnly(data.plannedCompletion) ?? '—', ltr: true, tone: scheduledToday ? ('brand' as const) : undefined }] : []),
        ]}
        primary={primaryControl}
        actions={
          <Menu
            aria-label={t('taskActions')}
            trigger={<Button variant="secondary" size="lg" aria-label={t('taskActions')}><MoreHorizontal className="h-4 w-4" /></Button>}
            items={[
              { id: 'take-in', label: tNav('takeIn'), icon: <PackageOpen className="h-4 w-4" />, onSelect: () => router.push(`/worker/tasks/${params.id}/take-in`) },
              { id: 'identify', label: t('materialsIdentify'), icon: <ScanLine className="h-4 w-4" />, onSelect: () => void quickAction('identify') },
              { id: 'problem', label: t('reportProblem'), icon: <AlertTriangle className="h-4 w-4" />, tone: 'error' as const, separator: true, onSelect: () => setProblemOpen(true) },
            ]}
          />
        }
      >
        {estimated ? <Meter value={Math.min(elapsed, estimated)} max={estimated} tone={elapsed > estimated ? 'warning' : tone} label={t('timerLabel')} valueLabel={`${fmtMinutes(elapsed)} / ${fmtMinutes(estimated)}`} /> : null}
      </DetailHero>

      {waiting ? <Ticket tone="warning" wash title={t('notReady')} why={`${t('waitingFor')}: ${waiting}`} /> : null}
      {openBlockers.length > 0 ? <Ticket tone="error" wash title={t('blockedReason')} why={openBlockers[0]?.reason} /> : null}
      {needsPhotos ? <Alert variant="warning">{tc('photosRequired')}</Alert> : null}
      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {qualityKind === 'rework' && floorCtx.data ? (
        <Alert variant="warning">
          <p className="font-medium">{tQuality('stampRework')} · {tQuality('reworkFixHint')}</p>
          {(floorCtx.data.openRework?.description || floorCtx.data.inspections.flatMap((i) => i.defects ?? []).slice(-1)[0]?.description) ? (
            <p className="mt-1 text-sm">{floorCtx.data.openRework?.description ?? floorCtx.data.inspections.flatMap((i) => i.defects ?? []).slice(-1)[0]?.description}</p>
          ) : null}
        </Alert>
      ) : null}
      {isQcGate || isPackaging ? (
        <QualityGatePanel
          kind={qualityKind as 'inspection' | 'reinspection' | 'packaging'}
          productionOrderId={data.productionOrder?.id ?? ''}
          stageCode={data.stageDefinition?.code}
          canPerform={!['COMPLETED', 'CANCELLED'].includes(data.status)}
          onPassed={async () => {
            await qc.invalidateQueries({ queryKey: ['task', params.id] });
            await qc.invalidateQueries({ queryKey: ['my-tasks'] });
            router.push('/worker/tasks/completed');
          }}
          onPackagesReady={onPackagesReady}
        />
      ) : null}
      {isRecovery && data.productionOrder?.returnRequestId && data.productionOrder.returnPieceId ? (
        <RecoveryFloorPanel taskId={params.id} returnRequestId={data.productionOrder.returnRequestId} returnPieceId={data.productionOrder.returnPieceId} readOnly={['COMPLETED', 'CANCELLED'].includes(data.status)} />
      ) : null}
      {!isRecovery && !isQcGate ? <TaskFabricBoard taskId={params.id} salesOrderId={data.productionOrder?.salesOrder?.id ?? null} canAct={!['COMPLETED', 'CANCELLED'].includes(data.status)} /> : null}
      <FabricDispositionSheet
        taskId={params.id}
        open={dispositionOpen}
        onClose={() => setDispositionOpen(false)}
        onDone={() => {
          setDispositionOpen(false);
          void runAction('complete');
        }}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <Board tone={data.timing?.status === 'running' ? 'brand' : 'neutral'} wash={data.timing?.status === 'running' ? 'top' : 'none'}>
            <Board.Header title={t('timerLabel')} meta={data.timing?.status === 'running' ? <Stamp tone="brand" size="sm">{t('timerLive')}</Stamp> : <Stamp tone={tone} size="sm">{statusLabel}</Stamp>} />
            <Board.Body className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Figure size="lg" value={<Ltr>{fmtMinutes(elapsed)}</Ltr>} label={t('elapsed')} tone={data.timing?.status === 'running' ? 'brand' : 'neutral'} />
                <Figure size="lg" value={<Ltr>{estimated ? fmtMinutes(estimated) : '—'}</Ltr>} label={t('estimated')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {canStart ? <Button leadingIcon={<Play className="h-4 w-4" />} onClick={() => void runAction('start')} loading={loading}>{t('startTask')}</Button> : null}
                {canStop ? <Button variant="secondary" leadingIcon={<Pause className="h-4 w-4" />} onClick={() => void runAction('pause')} loading={loading}>{t('stopTimer')}</Button> : null}
                {canResume ? <Button leadingIcon={<Play className="h-4 w-4" />} onClick={() => void runAction('resume')} loading={loading}>{t('resumeTask')}</Button> : null}
              </div>
              {canFinish ? (
                <div className="space-y-1.5">
                  <HoldButton onHold={() => void finish()} disabled={finishBlocked} loading={loading} holdingLabel={t('finishing')}>
                    {t('holdToFinish')}
                  </HoldButton>
                  <p className="text-center text-[12px] text-[var(--maher-text-tertiary)]">{needsPhotos ? tc('photosRequired') : openBlockers.length ? t('blockedReason') : t('holdToFinishHint')}</p>
                </div>
              ) : null}
            </Board.Body>
          </Board>

          {data.description || data.productionOrder?.specifications ? (
            <Board tone="neutral">
              <Board.Header title={t('stageInstructions')} />
              <Board.Body className="space-y-4">
                {data.description ? <p className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--maher-text-primary)]">{data.description}</p> : null}
                {data.productionOrder?.specifications ? (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--maher-text-tertiary)]">{t('specifications')}</p>
                    <p className="text-[14px] leading-6 text-[var(--maher-text-secondary)]">{data.productionOrder.specifications}</p>
                  </div>
                ) : null}
              </Board.Body>
            </Board>
          ) : null}

          <Board tone={needsPhotos ? 'warning' : 'neutral'}>
            <Board.Header title={t('attachedPhotos')} meta={<Stamp tone={data.photos?.length ? 'success' : needsPhotos ? 'warning' : 'neutral'} size="sm">{data.photos?.length ?? 0}</Stamp>} />
            <Board.Body className="space-y-3">
              {canAttach ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <CameraCapture label={t('addPhoto')} disabled={uploading || loading} onUploadFile={onPickPhoto} onAttachUrl={onAttachUrl} />
                  <PhotoAttachField hint={tCommon('photoUrlHint')} disabled={uploading || loading} uploadLabel={t('addPhoto')} uploadingLabel={t('uploadingPhoto')} attachUrlLabel={tCommon('attachFromUrl')} onUploadFile={onPickPhoto} onAttachUrl={onAttachUrl} />
                </div>
              ) : null}
              {(data.photos?.length ?? 0) > 0 ? (
                <div className="maher-stagger grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {data.photos!.map((photo) => {
                    const src = mediaSrc(photo.downloadPath);
                    return (
                      <a key={photo.id} href={src ?? '#'} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)]">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={photo.fileName} className="aspect-square w-full object-cover transition group-hover:scale-[1.04]" />
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-[var(--maher-text-tertiary)]">
                            <ImageIcon className="h-5 w-5 opacity-50" />
                          </div>
                        )}
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--maher-text-tertiary)]">{t('noAttachedPhotos')}</p>
              )}
            </Board.Body>
          </Board>
        </div>

        <div className="space-y-5 xl:col-span-5">
          <Board tone="neutral" className="overflow-hidden">
            <div className="aspect-[5/4] bg-[var(--maher-surface-muted)]">
              {productImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={productImage} alt={productTitle ?? factoryNo} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--maher-text-tertiary)]">
                  <Armchair className="h-10 w-10 opacity-40" />
                  <span className="text-[12px]">{t('noProductImage')}</span>
                </div>
              )}
            </div>
            <Board.Header title={productTitle ?? factoryNo} description={t('orderProduct')} />
            <KeyFacts
              className="px-5 pb-5"
              columns={2}
              facts={[
                { label: t('factoryOrderNumber'), value: factoryNo, ltr: true },
                { label: t('taskNumber'), value: data.number, ltr: true },
                ...(qty != null ? [{ label: tc('quantity'), value: String(qty), ltr: true }] : []),
                ...(data.plannedStart ? [{ label: t('plannedStart'), value: toDateOnly(data.plannedStart) ?? '—', ltr: true }] : []),
                ...(data.plannedCompletion ? [{ label: t('plannedCompletion'), value: toDateOnly(data.plannedCompletion) ?? '—', ltr: true }] : []),
              ]}
            />
          </Board>
          <Board tone="neutral">
            <Board.Header title={t('reportProblem')} description={t('problemHint')} />
            <Board.Body className="space-y-3">
              <VoiceNote />
              <Button variant="secondary" leadingIcon={<AlertTriangle className="h-4 w-4" />} onClick={() => setProblemOpen(true)}>
                {t('reportProblem')}
              </Button>
            </Board.Body>
          </Board>
        </div>
      </div>

      {canFinish ? (
        <ActionDock className="md:hidden" note={<Stamp tone={tone} size="sm">{statusLabel}</Stamp>}>
          {primaryControl ? <div className="shrink-0">{primaryControl}</div> : null}
          <div className="min-w-0 flex-1">
            <HoldButton onHold={() => void finish()} disabled={finishBlocked} loading={loading} holdingLabel={t('finishing')}>
              {t('holdToFinish')}
            </HoldButton>
          </div>
        </ActionDock>
      ) : null}

      <Sheet open={problemOpen} onClose={() => !loading && setProblemOpen(false)} title={t('reportProblem')} description={t('problemHint')} tone="error" closeLabel={tCommon('close')} footer={<><Button variant="ghost" onClick={() => setProblemOpen(false)} disabled={loading}>{tCommon('cancel')}</Button><Button variant="danger" loading={loading} onClick={() => void reportProblem()}>{t('reportProblem')}</Button></>}>
        <div className="space-y-3">
          <TextArea label={t('problemReason')} rows={4} value={problemReason} onChange={(e) => setProblemReason(e.target.value)} />
          <VoiceNote />
        </div>
      </Sheet>
    </div>
  );
}
