'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError, API_URL } from '@/lib/api-client';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  TextArea,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

interface TaskDetail {
  id: string;
  number: string;
  name: string;
  description?: string;
  notes?: string | null;
  status: string;
  priority: string;
  progressPercent: number;
  actualMinutes?: number | null;
  productionOrder?: {
    id: string;
    number: string;
    productDescription?: string;
    currentStageCode?: string | null;
    progressPercent?: number;
  };
  stageDefinition?: {
    code: string;
    nameEn: string;
    nameAr?: string;
    dependsOnCodes?: string[];
    requiresPhotos?: boolean;
    responsibleDepartment?: string | null;
  };
  stageInstance?: { status: string } | null;
  blockers?: Array<{ id: string; reason: string; resolvedAt?: string | null }>;
  timeEntries?: Array<{ id: string; startedAt: string; endedAt?: string | null; minutes?: number | null }>;
  photos?: Array<{ id: string; fileName: string }>;
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale();
  const t = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['task', params.id],
    queryFn: async () => {
      const task = await apiFetch<TaskDetail>(`/api/v1/tasks/${params.id}`);
      setNotes(task.notes ?? '');
      return task;
    },
  });

  async function act(action: string, body?: object) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
      await qc.invalidateQueries({ queryKey: ['my-tasks'] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/tasks/${params.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  async function uploadPhoto() {
    const file = fileRef.current?.files?.[0];
    if (!file || !data?.productionOrder?.id) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const qs = new URLSearchParams({
        taskId: params.id,
        productionOrderId: data.productionOrder.id,
      });
      const res = await fetch(`${API_URL}/api/v1/uploads?${qs}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new ApiClientError('Upload failed', res.status);
      await qc.invalidateQueries({ queryKey: ['task', params.id] });
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !data) {
    return <ErrorState title={t('taskDetail')} onRetry={() => refetch()} />;
  }

  const canStart = data.status === 'READY' || data.status === 'PAUSED';
  const canPause = data.status === 'IN_PROGRESS';
  const canProgress = ['IN_PROGRESS', 'READY', 'PAUSED', 'READY_FOR_INSPECTION'].includes(
    data.status,
  );
  const canComplete = !['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(data.status);
  const canBlock = !['COMPLETED', 'CANCELLED', 'BLOCKED'].includes(data.status);
  const canUnblock = data.status === 'BLOCKED';
  const waiting =
    data.status === 'NOT_STARTED' && (data.stageDefinition?.dependsOnCodes?.length ?? 0) > 0
      ? data.stageDefinition!.dependsOnCodes!.join(', ')
      : null;
  const openBlockers = (data.blockers ?? []).filter((b) => !b.resolvedAt);
  const photoCount = data.photos?.length ?? 0;
  const needsPhotos = Boolean(data.stageDefinition?.requiresPhotos) && photoCount === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          data.stageDefinition
            ? localizedName(locale, data.stageDefinition, data.name)
            : data.name
        }
        description={`${data.productionOrder?.number ?? '—'} · ${data.number}`}
        actions={
          <Link href="/tasks">
            <Button variant="secondary" size="sm" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              {tCommon('back')}
            </Button>
          </Link>
        }
      />

      {data.productionOrder?.productDescription ? (
        <p className="text-sm text-text-secondary">{data.productionOrder.productDescription}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={data.status} />
        <span className="text-xs text-text-secondary">
          {t('priority')}: {data.priority}
        </span>
        {data.stageDefinition ? (
          <span className="text-xs text-text-secondary">
            {t('stage')}: {localizedName(locale, data.stageDefinition)}
            {data.stageDefinition.responsibleDepartment
              ? ` · ${data.stageDefinition.responsibleDepartment}`
              : ''}
          </span>
        ) : null}
        {data.actualMinutes != null ? (
          <span className="text-xs text-text-secondary">
            {tc('timeMinutes')}: {data.actualMinutes} {tc('minutes')}
          </span>
        ) : null}
      </div>

      {waiting ? (
        <Alert variant="warning">
          {t('notReady')} ({t('waitingFor')}: {waiting})
        </Alert>
      ) : null}
      {data.description ? <p className="text-sm text-text-secondary">{data.description}</p> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {needsPhotos ? (
        <Alert variant="warning">{tc('photosRequired')}</Alert>
      ) : null}

      <Card title={t('taskDetail')}>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${data.progressPercent}%` }}
          />
        </div>
        <p className="mb-4 text-sm tabular-nums text-text-secondary">{data.progressPercent}%</p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={() => act(data.status === 'PAUSED' ? 'resume' : 'start')}
            loading={loading}
            disabled={!canStart}
          >
            {data.status === 'PAUSED' ? t('resume') : t('start')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => act('pause')}
            loading={loading}
            disabled={!canPause}
          >
            {t('pause')}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => act('progress', { percent: Math.min(100, data.progressPercent + 25) })}
            loading={loading}
            disabled={!canProgress}
          >
            +25%
          </Button>
          <Button
            size="lg"
            onClick={() =>
              act('complete', {
                notes: notes.trim() || undefined,
                photoDocumentIds: data.photos?.map((p) => p.id),
              })
            }
            loading={loading}
            disabled={!canComplete || openBlockers.length > 0 || needsPhotos}
          >
            {t('complete')}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <TextArea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <Button size="sm" variant="secondary" onClick={() => void saveNotes()} loading={loading}>
            Save notes
          </Button>

          <div>
            <p className="mb-1 text-sm font-medium">Photos {photoCount ? `(${photoCount})` : ''}</p>
            <input ref={fileRef} type="file" accept="image/*" className="mb-2 block w-full text-sm" />
            <Button size="sm" variant="secondary" onClick={() => void uploadPhoto()} loading={loading}>
              Upload photo
            </Button>
            {(data.photos?.length ?? 0) > 0 ? (
              <ul className="mt-2 list-disc ps-5 text-sm text-text-secondary">
                {data.photos!.map((p) => (
                  <li key={p.id}>{p.fileName}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <TextArea
            label={t('blockedReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          {canBlock ? (
            <Button
              size="lg"
              variant="danger"
              className="w-full"
              disabled={!reason.trim()}
              onClick={() => act('block', { category: 'OTHER', reason })}
              loading={loading}
            >
              {t('block')}
            </Button>
          ) : null}
          {canUnblock ? (
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={() => act('unblock')}
              loading={loading}
            >
              Unblock
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
