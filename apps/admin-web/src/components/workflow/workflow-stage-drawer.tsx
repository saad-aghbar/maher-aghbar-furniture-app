'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { ProductionFlowMap } from '@/components/workflow/production-flow-map';
import { WorkflowConnectionPicker } from '@/components/workflow/workflow-connection-picker';
import { WorkflowDrawer } from '@/components/workflow/workflow-drawer';
import type { WorkflowEdge, WorkflowNode } from '@/components/workflow/workflow-types';
import { nodeLabel, previewFlowStages } from '@/lib/workflow-labels';
import {
  predecessorsOf,
  resolveLeadsIntoForSave,
  successorsOf,
  validLeadsIntoCandidates,
  validRunsAfterCandidates,
} from '@/lib/workflow-rewire';
import { Badge, Button, Input, Select } from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

type StageBehavior =
  | 'NONE'
  | 'USES_MATERIALS'
  | 'PRODUCES_SEMI_FINISHED'
  | 'USES_SEMI_FINISHED'
  | 'USES_AND_PRODUCES'
  | 'PRODUCES_FINISHED';

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
  const [required, setRequired] = useState(true);
  const [runsAfter, setRunsAfter] = useState<string[]>([]);
  const [leadsInto, setLeadsInto] = useState<string[]>([]);
  const [hours, setHours] = useState('');
  const [behavior, setBehavior] = useState<StageBehavior>('NONE');
  const [consumeRaw, setConsumeRaw] = useState(false);
  const [consumeSemi, setConsumeSemi] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!node) return;
    setRequired(node.isRequiredByDefault);
    setRunsAfter(predecessorsOf(edges, node.id));
    setLeadsInto(successorsOf(edges, node.id));
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
    setConfirmRemove(false);
  }, [node, edges]);

  const sortNodes = useMemo(
    () => nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    [nodes],
  );
  const options = useMemo(
    () => nodes.filter((n) => n.id !== node?.id).map((n) => ({ id: n.id, label: nodeLabel(locale, n) })),
    [locale, node?.id, nodes],
  );

  const runCandidates = useMemo(() => {
    if (!node) return [];
    return validRunsAfterCandidates(sortNodes, edges, node.id, runsAfter, leadsInto, true);
  }, [edges, leadsInto, node, runsAfter, sortNodes]);

  const leadCandidates = useMemo(() => {
    if (!node) return [];
    return validLeadsIntoCandidates(sortNodes, edges, node.id, runsAfter, leadsInto, true);
  }, [edges, leadsInto, node, runsAfter, sortNodes]);

  const preview = useMemo(() => {
    if (!node) return [];
    const others = nodes.filter((n) => n.id !== node.id);
    const otherEdges = edges.filter((e) => e.fromNodeId !== node.id && e.toNodeId !== node.id);
    const resolvedLeads = resolveLeadsIntoForSave({
      nodes: sortNodes,
      edges,
      targetId: node.id,
      runsAfterIds: runsAfter,
      leadsIntoIds: leadsInto,
    });
    return previewFlowStages({
      nodes: others,
      edges: otherEdges,
      locale,
      previewName: nodeLabel(locale, node),
      runsAfterIds: runsAfter,
      leadsIntoIds: resolvedLeads,
      optional: !required,
    });
  }, [edges, leadsInto, locale, node, nodes, required, runsAfter, sortNodes]);

  if (!node) return null;

  const hoursNum = hours.trim() ? Number(hours) : NaN;

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
              <Button
                variant="danger"
                onClick={() => setConfirmRemove(true)}
                disabled={saving || removing}
              >
                {t('workflow.removeStage')}
              </Button>
              <Button
                loading={saving}
                onClick={() =>
                  onSave({
                    nodeId: node.id,
                    runsAfterNodeIds: runsAfter,
                    leadsIntoNodeIds: resolveLeadsIntoForSave({
                      nodes: sortNodes,
                      edges,
                      targetId: node.id,
                      runsAfterIds: runsAfter,
                      leadsIntoIds: leadsInto,
                    }),
                    isRequiredByDefault: required,
                    defaultEstimatedMinutes: Number.isFinite(hoursNum)
                      ? Math.round(hoursNum * 60)
                      : undefined,
                    ...flagsFromBehavior(behavior, consumeRaw, consumeSemi),
                  })
                }
              >
                {t('workflow.saveStage')}
              </Button>
            </>
          )
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={required ? 'default' : 'warning'}>
              {required ? t('workflow.required') : t('workflow.optional')}
            </Badge>
            {node.stageDefinition.responsibleDepartment ? (
              <Badge>{node.stageDefinition.responsibleDepartment}</Badge>
            ) : null}
          </div>

          {!readOnly ? (
            <Select
              label={`${t('workflow.required')} / ${t('workflow.optional')}`}
              value={required ? 'required' : 'optional'}
              onChange={(e) => setRequired(e.target.value === 'required')}
              options={[
                { value: 'required', label: t('workflow.required') },
                { value: 'optional', label: t('workflow.optional') },
              ]}
            />
          ) : null}

          <Input
            label={t('workflow.estimatedDuration')}
            type="number"
            min={0}
            step="0.25"
            value={hours}
            disabled={readOnly}
            onChange={(e) => setHours(e.target.value)}
          />

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

          <WorkflowConnectionPicker
            label={t('workflow.runsAfter')}
            hint={t('workflow.runsAfterHint')}
            options={options}
            selectedIds={runsAfter}
            enabledIds={runCandidates}
            disabled={readOnly}
            onToggle={(id) =>
              setRunsAfter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
          {runsAfter.length === 0 ? (
            <p className="text-xs text-text-tertiary">{t('workflow.runsAfterEmptyHint')}</p>
          ) : null}

          <WorkflowConnectionPicker
            label={t('workflow.leadsInto')}
            hint={t('workflow.mergeHint')}
            options={options}
            selectedIds={leadsInto}
            enabledIds={leadCandidates}
            disabled={readOnly}
            onToggle={(id) =>
              setLeadsInto((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
          {runsAfter.length > 1 ? (
            <p className="text-xs text-text-tertiary">{t('workflow.canRunInParallel')}</p>
          ) : null}

          {preview.length ? (
            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">{t('workflow.previewLive')}</p>
              <ProductionFlowMap variant="editor" stages={preview} rtl={rtl} selectedId="__preview__" />
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
