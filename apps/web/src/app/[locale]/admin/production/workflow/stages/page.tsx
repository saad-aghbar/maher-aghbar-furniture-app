'use client';

import {
  CreateStageForm,
  emptyCreateStageValues,
  type CreateStageValues,
} from '@/components/workflow/create-stage-form';
import { StageLibraryRows } from '@/components/workflow/stage-library-rows';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { stageLabel } from '@/lib/workflow-labels';
import { isQualityGateStageCode } from '@/lib/workflow-terminal';
import {
  isLockedAnchorStageCode,
  isProtectedStageCode,
  isRecoveryStageCode,
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
} from '@maher/types';
import { useKitCopy } from '@/lib/kit-copy';
import { Alert, Board, BoardSkeleton, Button, ConfirmDialog, ErrorBoard, Figure, ListToolbar, Ribbon, StatusChips } from '@maher/ui';
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
  const kit = useKitCopy();
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
  const recovery = filtered.find((row) => isRecoveryStageCode(row.code)) ?? null;
  const production = filtered.filter(
    (row) => !isLockedAnchorStageCode(row.code) && !isRecoveryStageCode(row.code),
  );
  const filters: Filter[] = ['all', 'inspection', 'photos'];
  const lockedEditing = editing ? isProtectedStageCode(editing.code) : false;

  function openRow(row: StageRow) {
    setEditing(row);
    setEdit(valuesFromRow(row));
  }

  const inspectionCount = rows.filter((r) => r.requiresInspection).length;
  const photosCount = rows.filter((r) => r.requiresPhotos).length;
  const resourceCount = rows.filter((r) => r.schedulingResourceMode === 'RESOURCE_CONSTRAINED').length;
  const totalHours = rows.reduce((sum, r) => sum + Number(r.estimatedHours ?? 0), 0);

  return (
    <div className="maher-stagger space-y-5">
      <Board tone="info" wash="top" as="section">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">{t('workflow.manageStages')}</h1>
              <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{t('workflow.manageStagesSubtitle')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/admin/production/workflow">
                <Button variant="secondary" leadingIcon={<Layers className="h-4 w-4" />}>
                  {t('workflow.title')}
                </Button>
              </Link>
              <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => (setCreate(emptyCreateStageValues()), setCreateOpen(true))}>
                {t('workflow.createStage')}
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <Ribbon
              size="sm"
              segments={[
                { key: 'production', label: t('workflow.productionSection'), value: production.length, tone: 'brand' },
                { key: 'anchors', label: t('workflow.finishingSection'), value: finishing.filter(Boolean).length + (opening ? 1 : 0), tone: 'neutral' },
                { key: 'recovery', label: t('workflow.recoverySection'), value: recovery ? 1 : 0, tone: 'warning' },
              ]}
            />
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Figure size="sm" value={rows.length} label={t('workflow.stages')} />
              <Figure size="sm" value={inspectionCount} label={t('workflow.filterInspection')} tone="info" />
              <Figure size="sm" value={photosCount} label={t('workflow.filterPhotos')} tone="neutral" />
              <Figure size="sm" value={`${Math.round(totalHours)}h`} label={t('workflow.estimatedHours')} tone="brand" locale={locale} delta={resourceCount ? t('workflow.resourceConstrainedCount', { count: resourceCount }) : undefined} />
            </div>
          </div>
        </div>
      </Board>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <ListToolbar copy={kit.toolbar} search={{ value: query, onChange: setQuery, placeholder: t('workflow.searchStages') }}>
        <StatusChips
          aria-label={t('workflow.filterAll')}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
          items={[
            { id: 'all', label: t('workflow.filterAll'), count: rows.length },
            { id: 'inspection', label: t('workflow.filterInspection'), count: inspectionCount, tone: 'info' },
            { id: 'photos', label: t('workflow.filterPhotos'), count: photosCount, tone: 'neutral' },
          ]}
        />
      </ListToolbar>

      {listQuery.isLoading ? (
        <BoardSkeleton rows={6} />
      ) : listQuery.isError ? (
        <ErrorBoard title={t('workflow.loadError')} description={mutationErrorMessage(listQuery.error)} onRetry={() => void listQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <Board tone="neutral">
          <Board.Empty title={t('workflow.noStagesMatch')} action={<Button size="sm" variant="secondary" onClick={() => (setQuery(''), setFilter('all'))}>{tCommon('clearFilters')}</Button>} />
        </Board>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-8">
            <StageLibraryRows title={t('workflow.productionSection')} description={t('workflow.stagesHint')} rows={production} numbered onOpen={openRow} tone="brand" />
          </div>
          <div className="space-y-5 xl:col-span-4">
            {opening ? <StageLibraryRows title={t('workflow.openingSection')} description={t('workflow.openingHint')} rows={[opening]} locked caption={t('workflow.alwaysFirst')} onOpen={openRow} tone="neutral" /> : null}
            {finishing.some(Boolean) ? <StageLibraryRows title={t('workflow.finishingSection')} description={t('workflow.terminalHint')} rows={finishing.filter((r): r is StageRow => Boolean(r))} locked captionFor={(row) => t(`workflow.terminalStage.${row.code}` as 'workflow.terminalStage.INSPECTION')} onOpen={openRow} tone="success" /> : null}
            {recovery ? <StageLibraryRows title={t('workflow.recoverySection')} description={t('workflow.recoveryHint')} rows={[recovery]} locked caption={t('workflow.alwaysAvailable')} onOpen={openRow} tone="warning" /> : null}
          </div>
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
                    const hours = isQualityGateStageCode(editing.code)
                      ? 0
                      : edit.hours.trim()
                        ? Number(edit.hours)
                        : undefined;
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
                      const hours = isQualityGateStageCode(editing.code)
                        ? 0
                        : edit.hours.trim()
                          ? Number(edit.hours)
                          : undefined;
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
        <CreateStageForm
          value={edit}
          onChange={setEdit}
          lockNames={lockedEditing}
          stageCode={editing?.code}
        />
      </WorkflowDrawer>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('workflow.deleteStage')}
        description={t('workflow.deleteStageConfirm', {
          name: deleting ? stageLabel(locale, deleting) : '',
        })}
        confirmLabel={t('workflow.deleteStage')}
        cancelLabel={tCommon('cancel')}
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
