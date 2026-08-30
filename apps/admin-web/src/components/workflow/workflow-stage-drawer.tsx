'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { ProductionFlowMap } from '@/components/workflow/production-flow-map';
import { WorkflowConnectionPicker } from '@/components/workflow/workflow-connection-picker';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import type { WorkflowEdge, WorkflowNode } from '@/components/workflow/workflow-types';
import { nodeLabel, previewFlowStagesFromPlacement } from '@/lib/workflow-labels';
import {
  clampParallelReferenceIds,
  clampPredecessorIds,
  materialPrepSuccessorIds,
  productionSuccessorIds,
  toDomainGraph,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
  type PlacementIntent,
} from '@/lib/workflow-domain-adapter';
import {
  executionKindForNode,
  isLockedAnchorNode,
  isTerminalNode,
  middleProductionNodes,
  type TerminalStageCode,
} from '@/lib/workflow-terminal';
import { Badge, Button, Input, Select } from '@maher/ui';
import { Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type StageBehavior =
  | 'NONE'
  | 'USES_MATERIALS'
  | 'PRODUCES_SEMI_FINISHED'
  | 'USES_SEMI_FINISHED'
  | 'USES_AND_PRODUCES'
  | 'PRODUCES_FINISHED';

type Placement = 'start' | 'after' | 'parallel';

const TERMINAL_DESC_KEYS: Record<
  TerminalStageCode,
  'terminalInspectionDesc' | 'terminalPackagingDesc' | 'terminalDeliveryDesc'
> = {
  INSPECTION: 'terminalInspectionDesc',
  PACKAGING: 'terminalPackagingDesc',
  DELIVERY: 'terminalDeliveryDesc',
};

function behaviorFromNode(node: WorkflowNode): StageBehavior {
  const tracking = node.inventoryTracking ?? 'NONE';
  const raw = Boolean(node.consumesRawMaterials);
  const semi = Boolean(node.consumesSemiFinished);
  if (tracking === 'PRODUCES_FINISHED') return 'PRODUCES_FINISHED';
  if (tracking === 'PRODUCES_SEMI_FINISHED' && semi) return 'USES_AND_PRODUCES';
  if (tracking === 'PRODUCES_SEMI_FINISHED') return 'PRODUCES_SEMI_FINISHED';
  if (semi) return 'USES_SEMI_FINISHED';
  if (raw) return 'USES_MATERIALS';
  return 'NONE';
}

function flagsFromBehavior(behavior: StageBehavior, consumeRaw: boolean, consumeSemi: boolean) {
  switch (behavior) {
    case 'USES_MATERIALS':
      return { inventoryTracking: 'NONE' as const, consumesRawMaterials: true, consumesSemiFinished: false };
    case 'PRODUCES_SEMI_FINISHED':
      return {
        inventoryTracking: 'PRODUCES_SEMI_FINISHED' as const,
        consumesRawMaterials: consumeRaw,
        consumesSemiFinished: false,
      };
    case 'USES_SEMI_FINISHED':
      return { inventoryTracking: 'NONE' as const, consumesRawMaterials: false, consumesSemiFinished: true };
    case 'USES_AND_PRODUCES':
      return {
        inventoryTracking: 'PRODUCES_SEMI_FINISHED' as const,
        consumesRawMaterials: consumeRaw,
        consumesSemiFinished: true,
      };
    case 'PRODUCES_FINISHED':
      return {
        inventoryTracking: 'PRODUCES_FINISHED' as const,
        consumesRawMaterials: consumeRaw,
        consumesSemiFinished: consumeSemi,
      };
    default:
      return { inventoryTracking: 'NONE' as const, consumesRawMaterials: false, consumesSemiFinished: false };
  }
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function inferPlacement(
  preds: string[],
  nodeId: string,
  domain: ReturnType<typeof toDomainGraph>,
): { placement: Placement; afterIds: string[]; parallelIds: string[] } {
  if (preds.length === 0) {
    return { placement: 'start', afterIds: [], parallelIds: [] };
  }
  const myKey = preds.slice().sort().join(',');
  const band = domain.parallelBands.find((b) => b.nodeIds.includes(nodeId));
  if (band && band.nodeIds.length > 1) {
    return {
      placement: 'parallel',
      afterIds: [],
      parallelIds: band.nodeIds.filter((id) => id !== nodeId),
    };
  }
  const siblings = domain.productionNodeIds.filter((id) => {
    if (id === nodeId) return false;
    const sp = (domain.predecessorsByNode[id] ?? []).slice().sort().join(',');
    return sp === myKey && myKey.length > 0;
  });
  if (siblings.length > 0) {
    return { placement: 'parallel', afterIds: [], parallelIds: siblings };
  }
  return {
    placement: 'after',
    afterIds: preds,
    parallelIds: [],
  };
}

type Props = {
  open: boolean;
  node: WorkflowNode | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  readOnly?: boolean;
  saving?: boolean;
  removing?: boolean;
  onClose: () => void;
  onSave: (args: {
    nodeId: string;
    runsAfterNodeIds: string[];
    leadsIntoNodeIds: string[];
    isRequiredByDefault: boolean;
    defaultEstimatedMinutes?: number | null;
    inventoryTracking: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
    consumesRawMaterials: boolean;
    consumesSemiFinished: boolean;
    expectedPieceCount?: number | null;
    siblingLiftPatches?: Array<{ nodeId: string; runsAfterNodeIds: string[] }>;
    parallelIds?: string[];
    placement?: PlacementIntent;
  }) => void;
  onRemove: (nodeId: string) => void;
};

export function WorkflowStageDrawer({
  open,
  node,
  nodes,
  edges,
  readOnly,
  saving,
  removing,
  onClose,
  onSave,
  onRemove,
}: Props) {
  const t = useTranslations('production');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const [placement, setPlacement] = useState<Placement>('after');
  const [afterIds, setAfterIds] = useState<string[]>([]);
  const [afterScope, setAfterScope] = useState<'one' | 'band'>('one');
  const [parallelIds, setParallelIds] = useState<string[]>([]);
  const [leadsIntoIds, setLeadsIntoIds] = useState<string[]>([]);
  const [hours, setHours] = useState('');
  const [behavior, setBehavior] = useState<StageBehavior>('NONE');
  const [consumeRaw, setConsumeRaw] = useState(false);
  const [consumeSemi, setConsumeSemi] = useState(false);
  const [expectedPieces, setExpectedPieces] = useState('1');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const editableNodes = useMemo(
    () => middleProductionNodes(nodes).filter((n) => n.id !== node?.id),
    [nodes, node?.id],
  );
  const afterPickNodes = useMemo(() => {
    const opening = nodes.filter((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    return [...opening, ...editableNodes];
  }, [nodes, editableNodes]);

  const domain = useMemo(() => toDomainGraph({ nodes, edges }), [nodes, edges]);

  useEffect(() => {
    if (!node) return;
    const preds = domain.predecessorsByNode[node.id] ?? [];
    const inferred = inferPlacement(preds, node.id, domain);
    setPlacement(inferred.placement);
    setAfterIds(inferred.placement === 'after' ? preds : []);
    setAfterScope('one');
    setParallelIds(inferred.parallelIds);
    setLeadsIntoIds(productionSuccessorIds(domain, node.id));
    setHours(
      node.defaultEstimatedMinutes != null
        ? String(Math.round((node.defaultEstimatedMinutes / 60) * 100) / 100)
        : node.stageDefinition.estimatedHours != null
          ? String(node.stageDefinition.estimatedHours)
          : '',
    );
    setBehavior(behaviorFromNode(node));
    setConsumeRaw(Boolean(node.consumesRawMaterials));
    setConsumeSemi(Boolean(node.consumesSemiFinished));
    setExpectedPieces(
      node.expectedPieceCount != null && Number(node.expectedPieceCount) > 0
        ? String(Math.floor(Number(node.expectedPieceCount)))
        : '1',
    );
    setConfirmRemove(false);
  }, [node, domain]);

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
      base = { kind: 'AFTER', predecessorIds };
    }
    return withSuccessorIds(base, leadsIntoIds);
  }, [placement, afterIds, afterScope, bandForAfter, parallelIds, leadsIntoIds]);

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
    if (!node) return [];
    if (placement === 'start') {
      return validSuccessorCandidateIds(domain, node.id, [], {
        restrictToIds: materialPrepSuccessorIds(domain),
      });
    }
    if (placement === 'parallel') {
      return validSuccessorCandidateIds(domain, node.id, leadPredIds, {
        excludeIds: parallelIds,
      });
    }
    return validSuccessorCandidateIds(domain, node.id, leadPredIds);
  }, [domain, node, leadPredIds, placement, parallelIds]);

  const leadOptions = editableNodes
    .filter((n) => leadCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  const afterCandidateIds = useMemo(() => {
    if (!node) return [];
    return validPredecessorCandidateIds(domain, node.id, afterIds, { leadsIntoIds });
  }, [domain, node, afterIds, leadsIntoIds]);

  const afterOptions = afterPickNodes
    .filter((n) => afterCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  const parallelCandidateIds = useMemo(() => {
    if (!node) return [];
    return validParallelReferenceCandidateIds(domain, node.id, parallelIds);
  }, [domain, node, parallelIds]);

  const parallelOptions = editableNodes
    .filter((n) => parallelCandidateIds.includes(n.id))
    .map((n) => ({ id: n.id, label: nodeLabel(locale, n) }));

  useEffect(() => {
    if (!node) return;
    setLeadsIntoIds((ids) => {
      const next = ids.filter((id) => leadCandidateIds.includes(id));
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [node, leadCandidateIds]);

  useEffect(() => {
    if (!node) return;
    setAfterIds((ids) => {
      const next = clampPredecessorIds(domain, node.id, ids, { leadsIntoIds });
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [node, domain, leadsIntoIds, afterCandidateIds]);

  useEffect(() => {
    if (!node) return;
    setParallelIds((ids) => {
      const next = clampParallelReferenceIds(domain, node.id, ids);
      if (next.length === ids.length && next.every((id, i) => id === ids[i])) return ids;
      return next;
    });
  }, [node, domain, parallelCandidateIds]);

  const preview = useMemo(() => {
    if (!node) return [];
    return previewFlowStagesFromPlacement({
      nodes,
      edges,
      locale,
      previewName: nodeLabel(locale, node),
      placement: placementIntent,
      editNodeId: node.id,
    });
  }, [edges, locale, node, nodes, placementIntent]);

  if (!node) return null;

  const locked = isLockedAnchorNode(node);
  const terminal = isTerminalNode(node);
  const logistics = executionKindForNode(node) === 'LOGISTICS';
  const hoursNum = hours.trim() ? Number(hours) : NaN;
  const expectedPiecesNum = expectedPieces.trim() ? Number(expectedPieces) : NaN;
  const producesSemi =
    behavior === 'PRODUCES_SEMI_FINISHED' || behavior === 'USES_AND_PRODUCES';

  return (
    <>
      <WorkflowDrawer
        open={open}
        title={nodeLabel(locale, node)}
        onClose={onClose}
        footer={
          readOnly ? (
            <Button variant="ghost" onClick={onClose}>
              {tCommon('close')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                {tCommon('cancel')}
              </Button>
              {!locked ? (
                <Button
                  variant="danger"
                  onClick={() => setConfirmRemove(true)}
                  disabled={saving || removing}
                >
                  {t('workflow.removeStage')}
                </Button>
              ) : null}
              {!locked ? (
                <Button
                  loading={saving}
                    onClick={() => {
                    const flags = flagsFromBehavior(behavior, consumeRaw, consumeSemi);
                    onSave({
                      nodeId: node.id,
                      runsAfterNodeIds:
                        placementIntent.kind === 'AFTER' ? placementIntent.predecessorIds : [],
                      leadsIntoNodeIds: leadsIntoIds,
                      parallelIds: placement === 'parallel' ? parallelIds : undefined,
                      placement: placementIntent,
                      isRequiredByDefault: true,
                      defaultEstimatedMinutes: Number.isFinite(hoursNum)
                        ? Math.round(hoursNum * 60)
                        : undefined,
                      ...flags,
                      expectedPieceCount:
                        flags.inventoryTracking === 'PRODUCES_SEMI_FINISHED' &&
                        Number.isFinite(expectedPiecesNum) &&
                        expectedPiecesNum >= 1
                          ? Math.floor(expectedPiecesNum)
                          : flags.inventoryTracking === 'PRODUCES_SEMI_FINISHED'
                            ? 1
                            : null,
                    });
                  }}
                >
                  {t('workflow.saveStage')}
                </Button>
              ) : (
                <Button onClick={onClose}>{tCommon('close')}</Button>
              )}
            </>
          )
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">
              {locked ? t('workflow.openingLocked') : t('workflow.required')}
            </Badge>
            {locked ? (
              <Badge variant="default">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" aria-hidden />
                  {terminal ? t('workflow.terminalTitle') : t('workflow.openingTitle')}
                </span>
              </Badge>
            ) : null}
            {node.stageDefinition.responsibleDepartment ? (
              <Badge>{node.stageDefinition.responsibleDepartment}</Badge>
            ) : null}
          </div>

          {locked ? (
            <p className="rounded-xl border border-[var(--maher-border)] bg-[var(--maher-surface-muted)]/50 p-3 text-xs leading-relaxed text-text-secondary">
              {terminal
                ? t(
                    TERMINAL_DESC_KEYS[node.stageDefinition.code as TerminalStageCode] ??
                      'terminalInspectionDesc',
                  )
                : t('workflow.anchorLockedHint')}
            </p>
          ) : null}

          {!logistics && !locked ? (
            <Input
              label={t('workflow.estimatedDuration')}
              type="number"
              min={0}
              step="0.25"
              value={hours}
              disabled={readOnly}
              onChange={(e) => setHours(e.target.value)}
            />
          ) : null}

          {!locked ? (
            <>
              <Select
                label={t('setup.stageBehavior')}
                value={behavior}
                disabled={readOnly}
                onChange={(e) => setBehavior(e.target.value as StageBehavior)}
                options={[
                  { value: 'NONE', label: t('setup.behaviorNone') },
                  { value: 'USES_MATERIALS', label: t('setup.behaviorUsesMaterials') },
                  { value: 'PRODUCES_SEMI_FINISHED', label: t('setup.behaviorProducesSemi') },
                  { value: 'USES_SEMI_FINISHED', label: t('setup.behaviorUsesSemi') },
                  { value: 'USES_AND_PRODUCES', label: t('setup.behaviorUsesAndProduces') },
                  { value: 'PRODUCES_FINISHED', label: t('setup.behaviorProducesFinished') },
                ]}
              />
              {!readOnly &&
              (behavior === 'PRODUCES_SEMI_FINISHED' ||
                behavior === 'USES_AND_PRODUCES' ||
                behavior === 'PRODUCES_FINISHED') ? (
                <div className="grid gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={consumeRaw}
                      onChange={(e) => setConsumeRaw(e.target.checked)}
                    />
                    {t('setup.alsoUsesMaterials')}
                  </label>
                  {behavior === 'PRODUCES_FINISHED' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={consumeSemi}
                        onChange={(e) => setConsumeSemi(e.target.checked)}
                      />
                      {t('setup.alsoUsesSemi')}
                    </label>
                  ) : null}
                </div>
              ) : null}

              {producesSemi ? (
                <Input
                  label={t('setup.expectedPieces')}
                  type="number"
                  min={1}
                  step={1}
                  value={expectedPieces}
                  disabled={readOnly}
                  onChange={(e) => setExpectedPieces(e.target.value)}
                  hint={t('setup.expectedPiecesHint')}
                />
              ) : null}

              {!readOnly ? (
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-text-secondary">{t('workflow.placementWhere')}</p>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--maher-surface-muted)] p-1">
                    {(['start', 'after', 'parallel'] as Placement[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`rounded-lg px-2 py-2 text-xs font-medium ${
                          placement === p
                            ? 'bg-[var(--maher-surface)] shadow-sm'
                            : 'text-text-secondary'
                        }`}
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
              ) : null}

              {placement === 'after' && afterOptions.length > 0 ? (
                <>
                  <WorkflowConnectionPicker
                    label={t('workflow.placementAfterPick')}
                    options={afterOptions}
                    selectedIds={afterIds}
                    enabledIds={afterCandidateIds}
                    disabled={readOnly}
                    onToggle={(id) => {
                      setAfterIds((prev) =>
                        clampPredecessorIds(domain, node.id, toggleId(prev, id), {
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
                  disabled={readOnly}
                  onToggle={(id) =>
                    setParallelIds((prev) =>
                      clampParallelReferenceIds(domain, node.id, toggleId(prev, id)),
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
                  disabled={readOnly}
                  onToggle={(id) => setLeadsIntoIds((prev) => toggleId(prev, id))}
                />
              ) : null}
            </>
          ) : null}

          {!terminal && preview.length ? (
            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">
                {t('workflow.placementPreview')}
              </p>
              <ProductionFlowMap
                variant="editor"
                stages={preview}
                rtl={rtl}
                selectedId={node.id}
              />
            </div>
          ) : null}
        </div>
      </WorkflowDrawer>

      <ConfirmDialog
        open={confirmRemove}
        title={t('workflow.removeStage')}
        description={t('workflow.reconnectExplain')}
        confirmLabel={t('workflow.removeStage')}
        danger
        loading={removing}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove(node.id);
        }}
      />
    </>
  );
}
