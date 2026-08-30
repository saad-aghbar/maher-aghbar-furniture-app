'use client';

import { ProductionFlowMap } from '@/components/workflow/production-flow-map';
import {
  CreateStageForm,
  emptyCreateStageValues,
  type CreateStageValues,
} from '@/components/workflow/create-stage-form';
import { WorkflowConnectionPicker } from '@/components/workflow/workflow-connection-picker';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import type { StageDefinition, WorkflowEdge, WorkflowNode } from '@/components/workflow/workflow-types';
import { nodeLabel, previewFlowStagesFromPlacement, stageLabel } from '@/lib/workflow-labels';
import {
  clampParallelReferenceIds,
  clampPredecessorIds,
  materialPrepSuccessorIds,
  toDomainGraph,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
  type PlacementIntent,
} from '@/lib/workflow-domain-adapter';
import {
  isLockedAnchorStageCode,
  middleProductionNodes,
} from '@/lib/workflow-terminal';
import { Button, Input } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type Placement = 'start' | 'after' | 'parallel';

type Props = {
  open: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  library: StageDefinition[];
  saving?: boolean;
  onClose: () => void;
  onAdd: (args: {
    stageId?: string;
    create?: CreateStageValues;
    required: boolean;
    runsAfterNodeIds: string[];
    leadsIntoNodeIds: string[];
    placement?: PlacementIntent;
  }) => void;
};

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function AddWorkflowStageDrawer({
  open,
  nodes,
  edges,
  library,
  saving,
  onClose,
  onAdd,
}: Props) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [query, setQuery] = useState('');
  const [pickStageId, setPickStageId] = useState('');
  const [create, setCreate] = useState<CreateStageValues>(emptyCreateStageValues);
  const [placement, setPlacement] = useState<Placement>('after');
  const [afterIds, setAfterIds] = useState<string[]>([]);
  const [afterScope, setAfterScope] = useState<'one' | 'band'>('one');
  const [parallelIds, setParallelIds] = useState<string[]>([]);
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);

  const editable = useMemo(() => middleProductionNodes(nodes), [nodes]);
  const afterPickNodes = useMemo(() => {
    const opening = nodes.filter((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    return [...opening, ...editable];
  }, [nodes, editable]);

  const domain = useMemo(() => toDomainGraph({ nodes, edges }), [nodes, edges]);

  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setQuery('');
    setPickStageId('');
    setCreate(emptyCreateStageValues());
    setPlacement(editable.length > 0 ? 'after' : 'start');
    setAfterIds([]);
    setAfterScope('one');
    setParallelIds([]);
    setLeadsIntoIds([]);
  }, [open, editable]);

  const usedStageIds = useMemo(
    () => new Set(nodes.map((n) => n.stageDefinition.id)),
    [nodes],
  );

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((s) => {
      if (!s.isActive || usedStageIds.has(s.id) || isLockedAnchorStageCode(s.code)) return false;
      if (!q) return true;
      const name = localizedName(locale, s).toLowerCase();
      return name.includes(q) || s.nameEn.toLowerCase().includes(q);
    });
  }, [library, locale, query, usedStageIds]);

  const bandForAfter = useMemo(() => {
    if (afterIds.length !== 1) return null;
    return domain.parallelBands.find((b) => b.nodeIds.includes(afterIds[0]!)) ?? null;
  }, [afterIds, domain.parallelBands]);

  const placementIntent: PlacementIntent = useMemo(() => {
    let base: PlacementIntent;
    if (placement === 'start') {
      base = { kind: 'START' };
    } else if (placement === 'parallel') {
      base = { kind: 'PARALLEL', referenceNodeIds: parallelIds };
    } else {
      let predecessorIds = [...afterIds];
      if (afterScope === 'band' && bandForAfter) {
        predecessorIds = [...bandForAfter.nodeIds];
      }
      if (predecessorIds.length === 0 && domain.frontierNodeIds.length > 0) {
        predecessorIds = [domain.frontierNodeIds[domain.frontierNodeIds.length - 1]!];
      }
      base = { kind: 'AFTER', predecessorIds };
    }
    return withSuccessorIds(base, leadsIntoIds);
  }, [placement, afterIds, afterScope, bandForAfter, parallelIds, domain.frontierNodeIds, leadsIntoIds]);

  const leadPredIds = useMemo(() => {
    if (placement === 'start') return [];
    if (placement === 'parallel') {
      const ref = parallelIds[0];
      return ref ? (domain.predecessorsByNode[ref] ?? []) : [];
    }
    if (placementIntent.kind === 'AFTER') return placementIntent.predecessorIds;
    return [];
  }, [placement, parallelIds, domain.predecessorsByNode, placementIntent]);

  const leadCandidateIds = useMemo(() => {
    if (placement === 'start') {
      return validSuccessorCandidateIds(domain, '__preview__', [], {
        restrictToIds: materialPrepSuccessorIds(domain),
      });
    }
    if (placement === 'parallel') {
      return validSuccessorCandidateIds(domain, '__preview__', leadPredIds, {
        excludeIds: parallelIds,
      });
    }
    return validSuccessorCandidateIds(domain, '__preview__', leadPredIds);
  }, [domain, leadPredIds, placement, parallelIds]);

  const previewName =
    mode === 'create'
      ? create.nameEn.trim() || create.nameAr.trim() || t('workflow.createStage')
      : stageLabel(
          locale,
          library.find((s) => s.id === pickStageId) ?? {
            nameEn: t('workflow.addStage'),
            nameAr: t('workflow.addStage'),
          },
        );

  const preview = useMemo(
    () =>
      previewFlowStagesFromPlacement({
        nodes,
        edges,
        locale,
        previewName,
        placement: placementIntent,
      }),
    [nodes, edges, locale, previewName, placementIntent],
  );

  const canSave =
    mode === 'create' ? Boolean(create.nameEn.trim() && create.nameAr.trim()) : Boolean(pickStageId);

  const leadOptions = editable
    .filter((n) => leadCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  const afterCandidateIds = useMemo(
    () => validPredecessorCandidateIds(domain, '__preview__', afterIds, { leadsIntoIds }),
    [domain, afterIds, leadsIntoIds],
  );
  const afterOptions = afterPickNodes
    .filter((n) => afterCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  const parallelCandidateIds = useMemo(
    () => validParallelReferenceCandidateIds(domain, '__preview__', parallelIds),
    [domain, parallelIds],
  );
  const parallelOptions = editable
    .filter((n) => parallelCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  useEffect(() => {
    if (!open) return;
    setLeadsIntoIds((ids) => {
      const next = ids.filter((id) => leadCandidateIds.includes(id));
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, leadCandidateIds]);

  useEffect(() => {
    if (!open) return;
    setAfterIds((ids) => {
      const next = clampPredecessorIds(domain, '__preview__', ids, { leadsIntoIds });
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, domain, leadsIntoIds, afterCandidateIds]);

  useEffect(() => {
    if (!open) return;
    setParallelIds((ids) => {
      const next = clampParallelReferenceIds(domain, '__preview__', ids);
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [open, domain, parallelCandidateIds]);

  return (
    <WorkflowDrawer
      open={open}
      title={t('workflow.addStage')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button
            loading={saving}
            disabled={!canSave || (placement === 'parallel' && parallelIds.length === 0)}
            onClick={() =>
              onAdd({
                stageId: mode === 'existing' ? pickStageId : undefined,
                create: mode === 'create' ? create : undefined,
                required: true,
                runsAfterNodeIds:
                  placementIntent.kind === 'AFTER'
                    ? placementIntent.predecessorIds
                    : placementIntent.kind === 'PARALLEL'
                      ? []
                      : [],
                leadsIntoNodeIds: leadsIntoIds,
                placement: placementIntent,
              })
            }
          >
            {t('workflow.addStage')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--maher-surface-muted)] p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'existing' ? 'bg-[var(--maher-surface)] shadow-sm' : 'text-text-secondary'}`}
            onClick={() => setMode('existing')}
          >
            {t('workflow.chooseExistingStage')}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'create' ? 'bg-[var(--maher-surface)] shadow-sm' : 'text-text-secondary'}`}
            onClick={() => setMode('create')}
          >
            {t('workflow.createStage')}
          </button>
        </div>

        {mode === 'existing' ? (
          <div className="grid gap-2">
            <Input
              label={t('workflow.searchStages')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--maher-border)] p-1">
              {available.length === 0 ? (
                <p className="px-2 py-3 text-xs text-text-tertiary">{t('workflow.noStagesMatch')}</p>
              ) : (
                available.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--maher-surface-muted)]"
                  >
                    <input
                      type="radio"
                      name="pick-stage"
                      checked={pickStageId === s.id}
                      onChange={() => setPickStageId(s.id)}
                    />
                    {localizedName(locale, s)}
                  </label>
                ))
              )}
            </div>
          </div>
        ) : (
          <CreateStageForm value={create} onChange={setCreate} />
        )}

        <div className="grid gap-2">
          <p className="text-xs font-medium text-text-secondary">{t('workflow.placementWhere')}</p>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--maher-surface-muted)] p-1">
            {(['start', 'after', 'parallel'] as Placement[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`rounded-lg px-2 py-2 text-xs font-medium ${placement === p ? 'bg-[var(--maher-surface)] shadow-sm' : 'text-text-secondary'}`}
                onClick={() => {
                  setPlacement(p);
                  setLeadsIntoIds([]);
                }}
              >
                {p === 'start'
                  ? t('workflow.placementStart')
                  : p === 'after'
                    ? t('workflow.placementAfter')
                    : t('workflow.placementParallel')}
              </button>
            ))}
          </div>
        </div>

        {placement === 'after' && afterOptions.length > 0 ? (
          <>
            <WorkflowConnectionPicker
              label={t('workflow.placementAfterPick')}
              options={afterOptions}
              selectedIds={afterIds}
              enabledIds={afterCandidateIds}
              onToggle={(id) => {
                setAfterIds((prev) =>
                  clampPredecessorIds(domain, '__preview__', toggleId(prev, id), {
                    leadsIntoIds,
                  }),
                );
                setAfterScope('one');
              }}
            />
            {bandForAfter && bandForAfter.nodeIds.length > 1 ? (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--maher-surface-muted)] p-1">
                <button
                  type="button"
                  className={`rounded-lg px-2 py-2 text-xs font-medium ${afterScope === 'one' ? 'bg-[var(--maher-surface)] shadow-sm' : 'text-text-secondary'}`}
                  onClick={() => setAfterScope('one')}
                >
                  {t('workflow.afterThisStageOnly')}
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2 py-2 text-xs font-medium ${afterScope === 'band' ? 'bg-[var(--maher-surface)] shadow-sm' : 'text-text-secondary'}`}
                  onClick={() => setAfterScope('band')}
                >
                  {t('workflow.afterWholeParallelGroup')}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {placement === 'parallel' && parallelOptions.length > 0 ? (
          <WorkflowConnectionPicker
            label={t('workflow.placementParallelPick')}
            options={parallelOptions}
            selectedIds={parallelIds}
            enabledIds={parallelCandidateIds}
            onToggle={(id) =>
              setParallelIds((prev) =>
                clampParallelReferenceIds(domain, '__preview__', toggleId(prev, id)),
              )
            }
          />
        ) : null}

        {leadOptions.length > 0 ? (
          <WorkflowConnectionPicker
            label={t('workflow.leadsIntoThoseStages')}
            hint={t('workflow.leadsIntoPickHint')}
            options={leadOptions}
            selectedIds={leadsIntoIds}
            enabledIds={leadCandidateIds}
            onToggle={(id) => setLeadsIntoIds((prev) => toggleId(prev, id))}
          />
        ) : null}

        {preview.length ? (
          <div>
            <p className="mb-2 text-xs font-medium text-text-secondary">{t('workflow.placementPreview')}</p>
            <ProductionFlowMap variant="editor" stages={preview} rtl={rtl} selectedId="__preview__" />
          </div>
        ) : null}
      </div>
    </WorkflowDrawer>
  );
}
