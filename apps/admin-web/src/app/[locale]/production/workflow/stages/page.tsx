'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import {
  CreateStageForm,
  emptyCreateStageValues,
  type CreateStageValues,
} from '@/components/workflow/create-stage-form';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { stageLabel } from '@/lib/workflow-labels';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHero,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type StageRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  isActive: boolean;
};

type Filter = 'all' | 'active' | 'inactive' | 'inspection' | 'photos';

export default function WorkflowStageLibraryPage() {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState<CreateStageValues>(emptyCreateStageValues);
  const [editing, setEditing] = useState<StageRow | null>(null);
  const [edit, setEdit] = useState<CreateStageValues>(emptyCreateStageValues());
  const [deactivate, setDeactivate] = useState<StageRow | null>(null);

  const listQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () => apiFetch<StageRow[]>('/api/v1/production-stage-library'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const hours = create.hours.trim() ? Number(create.hours) : undefined;
      return apiFetch('/api/v1/production-stage-library', {
        method: 'POST',
        body: JSON.stringify({
          nameEn: create.nameEn.trim(),
          nameAr: create.nameAr.trim(),
          nameHe: create.nameHe.trim() || undefined,
          responsibleDepartment: create.departmentCode || undefined,
          estimatedHours: Number.isFinite(hours) ? hours : undefined,
          requiresInspection: create.requiresInspection,
          requiresPhotos: create.requiresPhotos,
        }),
      });
    },
    onSuccess: async () => {
      setCreateOpen(false);
      setCreate(emptyCreateStageValues());
      setError(null);
      await qc.invalidateQueries({ queryKey: ['production-stage-library'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/v1/production-stage-library/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify(args.body),
      }),
    onSuccess: async () => {
      setEditing(null);
      setDeactivate(null);
      await qc.invalidateQueries({ queryKey: ['production-stage-library'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = listQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'active' && !row.isActive) return false;
      if (filter === 'inactive' && row.isActive) return false;
      if (filter === 'inspection' && !row.requiresInspection) return false;
      if (filter === 'photos' && !row.requiresPhotos) return false;
      if (!q) return true;
      return localizedName(locale, row).toLowerCase().includes(q) || row.nameEn.toLowerCase().includes(q);
    });
  }, [filter, locale, query, rows]);

  const filters: Filter[] = ['all', 'active', 'inactive', 'inspection', 'photos'];

  return (
    <div className="space-y-6">
      <PageHero
        title={t('workflow.stageLibrary')}
        description={t('workflow.subtitle')}
        tone="soft"
        actions={
          <div className="flex gap-2">
            <Link href="/production/workflow">
              <Button variant="ghost">{t('workflow.title')}</Button>
            </Link>
            <Button
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setCreate(emptyCreateStageValues());
                setCreateOpen(true);
              }}
            >
              {t('workflow.createStage')}
            </Button>
          </div>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <Input
            withSearchIcon
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('workflow.searchStages')}
            aria-label={t('workflow.searchStages')}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'secondary' : 'ghost'}
              onClick={() => setFilter(f)}
            >
              {f === 'all'
                ? t('workflow.filterAll')
                : f === 'active'
                  ? t('workflow.filterActive')
                  : f === 'inactive'
                    ? t('workflow.filterInactive')
                    : f === 'inspection'
                      ? t('workflow.filterInspection')
                      : t('workflow.filterPhotos')}
            </Button>
          ))}
        </div>
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <ErrorState
          title={t('workflow.loadError')}
          retryLabel={t('workflow.retry')}
          onRetry={() => void listQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('workflow.noStagesMatch')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setEditing(row);
                setEdit({
                  nameEn: row.nameEn,
                  nameAr: row.nameAr,
                  nameHe: row.nameHe ?? '',
                  departmentId: '',
                  departmentCode: row.responsibleDepartment ?? '',
                  hours: row.estimatedHours != null ? String(row.estimatedHours) : '',
                  requiresInspection: row.requiresInspection,
                  requiresPhotos: row.requiresPhotos,
                });
              }}
              className="rounded-2xl border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4 text-start transition hover:border-brand/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-text-primary">{stageLabel(locale, row)}</p>
                <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {row.responsibleDepartment ? <Badge>{row.responsibleDepartment}</Badge> : null}
                {row.estimatedHours ? (
                  <Badge>
                    {row.estimatedHours} {t('workflow.durationHours')}
                  </Badge>
                ) : null}
                {row.requiresInspection ? <Badge>{t('workflow.requiresInspection')}</Badge> : null}
                {row.requiresPhotos ? <Badge>{t('workflow.requiresPhotos')}</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <WorkflowDrawer
        open={createOpen}
        title={t('workflow.createStage')}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!create.nameEn.trim() || !create.nameAr.trim()}
              onClick={() => createMutation.mutate()}
            >
              {t('workflow.createStage')}
            </Button>
          </>
        }
      >
        <CreateStageForm value={create} onChange={setCreate} />
      </WorkflowDrawer>

      <WorkflowDrawer
        open={Boolean(editing)}
        title={t('workflow.editStage')}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setDeactivate(editing)}
              >
                {editing.isActive ? t('workflow.deactivate') : t('workflow.activate')}
              </Button>
              <Button
                loading={updateMutation.isPending}
                disabled={!edit.nameEn.trim() || !edit.nameAr.trim()}
                onClick={() => {
                  const hours = edit.hours.trim() ? Number(edit.hours) : undefined;
                  updateMutation.mutate({
                    id: editing.id,
                    body: {
                      nameEn: edit.nameEn.trim(),
                      nameAr: edit.nameAr.trim(),
                      nameHe: edit.nameHe.trim() || null,
                      responsibleDepartment: edit.departmentCode || null,
                      estimatedHours: Number.isFinite(hours) ? hours : null,
                      requiresInspection: edit.requiresInspection,
                      requiresPhotos: edit.requiresPhotos,
                    },
                  });
                }}
              >
                {t('workflow.saveStage')}
              </Button>
            </>
          ) : null
        }
      >
        <CreateStageForm value={edit} onChange={setEdit} />
      </WorkflowDrawer>

      <ConfirmDialog
        open={Boolean(deactivate)}
        title={deactivate?.isActive ? t('workflow.deactivate') : t('workflow.activate')}
        description={t('workflow.deactivateConfirm')}
        confirmLabel={deactivate?.isActive ? t('workflow.deactivate') : t('workflow.activate')}
        loading={updateMutation.isPending}
        onClose={() => setDeactivate(null)}
        onConfirm={() => {
          if (!deactivate) return;
          updateMutation.mutate({
            id: deactivate.id,
            body: { isActive: !deactivate.isActive },
          });
        }}
      />
    </div>
  );
}
