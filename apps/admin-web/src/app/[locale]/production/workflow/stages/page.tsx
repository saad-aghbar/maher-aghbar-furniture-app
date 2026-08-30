'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import {
  CreateStageForm,
  emptyCreateStageValues,
  type CreateStageValues,
} from '@/components/workflow/create-stage-form';
import { StageGalleryTile } from '@/components/workflow/stage-gallery-tile';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { stageLabel } from '@/lib/workflow-labels';
import { isLockedAnchorStageCode, OPENING_STAGE_CODE, TERMINAL_STAGE_CODES } from '@maher/types';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHero,
  Skeleton,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
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
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
  resourceSlots?: number | null;
};

type Filter = 'all' | 'inspection' | 'photos';

function valuesFromRow(row: StageRow): CreateStageValues {
  return {
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    nameHe: row.nameHe ?? '',
    departmentId: '',
    departmentCode: row.responsibleDepartment ?? '',
    hours: row.estimatedHours != null ? String(row.estimatedHours) : '',
    requiresInspection: row.requiresInspection,
    requiresPhotos: row.requiresPhotos,
    schedulingResourceMode: row.schedulingResourceMode ?? 'WORKER_CONSTRAINED',
    resourceSlots: String(row.resourceSlots ?? 1),
  };
}

export default function WorkflowStageLibraryPage() {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [create, setCreate] = useState<CreateStageValues>(emptyCreateStageValues());
  const [editing, setEditing] = useState<StageRow | null>(null);
  const [edit, setEdit] = useState<CreateStageValues>(emptyCreateStageValues());
  const [deleting, setDeleting] = useState<StageRow | null>(null);

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
          schedulingResourceMode: create.schedulingResourceMode,
          resourceSlots:
            create.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
              ? Number(create.resourceSlots) || 1
              : undefined,
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
      await qc.invalidateQueries({ queryKey: ['production-stage-library'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/production-stage-library/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setDeleting(null);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ['production-stage-library'] });
      await qc.invalidateQueries({ queryKey: ['production-workflows'] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const rows = (listQuery.data ?? []).filter((row) => row.isActive);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'inspection' && !row.requiresInspection) return false;
      if (filter === 'photos' && !row.requiresPhotos) return false;
      if (!q) return true;
      return (
        localizedName(locale, row).toLowerCase().includes(q) ||
        row.nameEn.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q)
      );
    });
  }, [filter, locale, query, rows]);

  const opening = filtered.find((row) => row.code === OPENING_STAGE_CODE) ?? null;
  const finishing = TERMINAL_STAGE_CODES.map(
    (code) => filtered.find((row) => row.code === code) ?? null,
  );
  const production = filtered.filter((row) => !isLockedAnchorStageCode(row.code));
  const filters: Filter[] = ['all', 'inspection', 'photos'];
  const lockedEditing = editing ? isLockedAnchorStageCode(editing.code) : false;

  function openRow(row: StageRow) {
    setEditing(row);
    setEdit(valuesFromRow(row));
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={t('workflow.manageStages')}
        description={t('workflow.manageStagesSubtitle')}
        tone="soft"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-56">
            <Button
              className="w-full"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setCreate(emptyCreateStageValues());
                setCreateOpen(true);
              }}
            >
              {t('workflow.createStage')}
            </Button>
            <Link href="/production/workflow" className="w-full">
              <Button className="w-full" variant="secondary" leadingIcon={<Layers className="h-4 w-4" />}>
                {t('workflow.title')}
              </Button>
            </Link>
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
        <div className="flex flex-wrap gap-1 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] p-1">
          {filters.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'subtle' : 'ghost'}
              onClick={() => setFilter(f)}
            >
              {f === 'all'
                ? t('workflow.filterAll')
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
            <Skeleton key={i} className="h-28 rounded-2xl" />
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
        <div className="space-y-8">
          {opening ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t('workflow.openingSection')}</h2>
                <p className="text-xs text-text-secondary">{t('workflow.openingHint')}</p>
              </div>
              <div className="max-w-xl">
                <StageGalleryTile
                  row={opening}
                  locked
                  featured
                  caption={t('workflow.alwaysFirst')}
                  onClick={() => openRow(opening)}
                />
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{t('workflow.productionSection')}</h2>
              <p className="text-xs text-text-secondary">{t('workflow.stagesHint')}</p>
            </div>
            {production.length === 0 ? (
              <p className="text-sm text-text-tertiary">{t('workflow.noStagesMatch')}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {production.map((row, index) => (
                  <StageGalleryTile key={row.id} row={row} index={index} onClick={() => openRow(row)} />
                ))}
              </div>
            )}
          </section>

          {finishing.some(Boolean) ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{t('workflow.finishingSection')}</h2>
                <p className="text-xs text-text-secondary">{t('workflow.terminalHint')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {finishing.map((row, index) =>
                  row ? (
                    <StageGalleryTile
                      key={row.id}
                      row={row}
                      locked
                      index={index}
                      caption={t(`workflow.terminalStage.${row.code}` as 'workflow.terminalStage.INSPECTION')}
                      onClick={() => openRow(row)}
                    />
                  ) : null,
                )}
              </div>
            </section>
          ) : null}
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
        title={editing ? stageLabel(locale, editing) : t('workflow.editStage')}
        onClose={() => setEditing(null)}
        footer={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('close')}
              </Button>
              {lockedEditing ? (
                <Button
                  loading={updateMutation.isPending}
                  onClick={() => {
                    const hours = edit.hours.trim() ? Number(edit.hours) : undefined;
                    updateMutation.mutate({
                      id: editing.id,
                      body: {
                        responsibleDepartment: edit.departmentCode || null,
                        estimatedHours: Number.isFinite(hours) ? hours : null,
                        requiresInspection: edit.requiresInspection,
                        requiresPhotos: edit.requiresPhotos,
                        schedulingResourceMode: edit.schedulingResourceMode,
                        resourceSlots:
                          edit.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
                            ? Number(edit.resourceSlots) || 1
                            : 1,
                      },
                    });
                  }}
                >
                  {t('workflow.saveStage')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="text-[var(--maher-error)] hover:bg-[var(--maher-error)]/10 hover:text-[var(--maher-error)]"
                    onClick={() => setDeleting(editing)}
                  >
                    {t('workflow.deleteStage')}
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
                          schedulingResourceMode: edit.schedulingResourceMode,
                          resourceSlots:
                            edit.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
                              ? Number(edit.resourceSlots) || 1
                              : 1,
                        },
                      });
                    }}
                  >
                    {t('workflow.saveStage')}
                  </Button>
                </>
              )}
            </>
          ) : null
        }
      >
        <CreateStageForm value={edit} onChange={setEdit} lockNames={lockedEditing} />
      </WorkflowDrawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('workflow.deleteStage')}
        description={t('workflow.deleteStageConfirm', {
          name: deleting ? stageLabel(locale, deleting) : '',
        })}
        confirmLabel={t('workflow.deleteStage')}
        danger
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id);
        }}
      />
    </div>
  );
}
