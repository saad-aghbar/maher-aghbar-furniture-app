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
import { nodeLabel, previewFlowStages, stageLabel } from '@/lib/workflow-labels';
import {
  resolveLeadsIntoForSave,
  validLeadsIntoCandidates,
  validRunsAfterCandidates,
} from '@/lib/workflow-rewire';
import { Button, Input, Select } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

const NEW_ID = '__new__';

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
  }) => void;
};

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
  const [required, setRequired] = useState(true);
  const [runsAfter, setRunsAfter] = useState<string[]>([]);
  const [leadsInto, setLeadsInto] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode('existing');
    setQuery('');
    setPickStageId('');
    setCreate(emptyCreateStageValues());
    setRequired(true);
    setRunsAfter([]);
    setLeadsInto([]);
  }, [open]);

  const usedStageIds = useMemo(
    () => new Set(nodes.map((n) => n.stageDefinition.id)),
    [nodes],
  );

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter((s) => {
      if (!s.isActive || usedStageIds.has(s.id)) return false;
      if (!q) return true;
      const name = localizedName(locale, s).toLowerCase();
      return name.includes(q) || s.nameEn.toLowerCase().includes(q);
    });
  }, [library, locale, query, usedStageIds]);

  const sortNodes = useMemo(
    () => nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    [nodes],
  );
  const options = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: nodeLabel(locale, n) })),
    [locale, nodes],
  );

  const runCandidates = useMemo(
    () => validRunsAfterCandidates(sortNodes, edges, NEW_ID, runsAfter, leadsInto, false),
    [edges, leadsInto, runsAfter, sortNodes],
  );
  const leadCandidates = useMemo(
    () => validLeadsIntoCandidates(sortNodes, edges, NEW_ID, runsAfter, leadsInto, false),
    [edges, leadsInto, runsAfter, sortNodes],
  );

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

  const resolvedLeads = resolveLeadsIntoForSave({
    nodes: sortNodes,
    edges,
    targetId: NEW_ID,
    runsAfterIds: runsAfter,
    leadsIntoIds: leadsInto,
  });

  const preview = previewFlowStages({
    nodes,
    edges,
    locale,
    previewName,
    runsAfterIds: runsAfter,
    leadsIntoIds: resolvedLeads,
    optional: !required,
  });

  const canSave =
    mode === 'create' ? Boolean(create.nameEn.trim() && create.nameAr.trim()) : Boolean(pickStageId);

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
            disabled={!canSave}
            onClick={() =>
              onAdd({
                stageId: mode === 'existing' ? pickStageId : undefined,
                create: mode === 'create' ? create : undefined,
                required,
                runsAfterNodeIds: runsAfter,
                leadsIntoNodeIds: resolvedLeads,
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

        <Select
          label={`${t('workflow.required')} / ${t('workflow.optional')}`}
          value={required ? 'required' : 'optional'}
          onChange={(e) => setRequired(e.target.value === 'required')}
          options={[
            { value: 'required', label: t('workflow.required') },
            { value: 'optional', label: t('workflow.optional') },
          ]}
        />

        <WorkflowConnectionPicker
          label={t('workflow.runsAfter')}
          hint={t('workflow.runsAfterHint')}
          options={options}
          selectedIds={runsAfter}
          enabledIds={runCandidates}
          onToggle={(id) =>
            setRunsAfter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
        {runsAfter.length === 0 ? (
          <p className="text-xs text-text-tertiary">{t('workflow.startStage')}</p>
        ) : runsAfter.length > 1 ? (
          <p className="text-xs text-text-tertiary">{t('workflow.canRunInParallel')}</p>
        ) : null}

        <WorkflowConnectionPicker
          label={t('workflow.leadsInto')}
          hint={t('workflow.mergeHint')}
          options={options}
          selectedIds={leadsInto}
          enabledIds={leadCandidates}
          onToggle={(id) =>
            setLeadsInto((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />

        {preview.length ? (
          <div>
            <p className="mb-2 text-xs font-medium text-text-secondary">{t('workflow.previewLive')}</p>
            <ProductionFlowMap variant="editor" stages={preview} rtl={rtl} selectedId="__preview__" />
          </div>
        ) : null}
      </div>
    </WorkflowDrawer>
  );
}
