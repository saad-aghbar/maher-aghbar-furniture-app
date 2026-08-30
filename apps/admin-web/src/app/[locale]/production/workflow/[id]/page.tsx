'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AddWorkflowStageDrawer } from '@/components/workflow/add-workflow-stage-drawer';
import type { CreateStageValues } from '@/components/workflow/create-stage-form';
import { WorkflowEmptyState } from '@/components/workflow/workflow-empty-state';
import { WorkflowGraphCanvas } from '@/components/workflow/workflow-graph-canvas';
import { WorkflowHeader } from '@/components/workflow/workflow-header';
import { WorkflowSkeleton } from '@/components/workflow/workflow-skeleton';
import { WorkflowStageDrawer } from '@/components/workflow/workflow-stage-drawer';
import { WorkflowStageList } from '@/components/workflow/workflow-stage-list';
import type {
  StageDefinition,
  WorkflowDetail,
  WorkflowNode,
  WorkflowVersion,
} from '@/components/workflow/workflow-types';
import { WorkflowValidationPanel } from '@/components/workflow/workflow-validation-panel';
import { WorkflowVersionDrawer } from '@/components/workflow/workflow-version-drawer';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { workflowVersionToFlowStages } from '@/lib/workflow-labels';
import {
  canonicalizeDraftVersion,
  predecessorDiff,
  simulateAdd,
  simulateEdit,
  simulateParallelBandLink,
  simulateRemove,
  toDomainGraph,
  validateSimulated,
  type ParallelBandLinkMode,
  type PlacementIntent,
} from '@/lib/workflow-domain-adapter';
import {
  partitionWorkflowAnchors,
  isLockedAnchorNode,
  isTerminalNode,
  getInspectionNodeId,
  lockedAnchorNodeIds,
} from '@/lib/workflow-terminal';
import { Alert, Button, Card, EmptyState, ErrorState } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function WorkflowBuilderPage({ params }: { params: { id: string } }) {
  const workflowId = params.id;
  const t = useTranslations('production');
  const locale = useLocale();
  const rtl = locale === 'ar' || locale === 'he';
  const qc = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<Array<{ code: string; message: string }>>(
    [],
  );

  const workflowQuery = useQuery({
    queryKey: ['production-workflow', workflowId],
    queryFn: () => apiFetch<WorkflowDetail>(`/api/v1/production-workflows/${workflowId}`),
  });

  const draftVersionId = useMemo(() => {
    const wf = workflowQuery.data;
    if (!wf) return null;
    return wf.versions.find((v) => v.status === 'DRAFT')?.id ?? null;
  }, [workflowQuery.data]);

  const versionId = viewingVersionId ?? draftVersionId ?? workflowQuery.data?.activeVersion?.id ?? null;

  const versionQuery = useQuery({
    queryKey: ['production-workflow-version', workflowId, versionId],
    enabled: Boolean(versionId),
    queryFn: () =>
      apiFetch<WorkflowVersion>(`/api/v1/production-workflows/${workflowId}/versions/${versionId}`),
  });

  const stageLibraryQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () => apiFetch<StageDefinition[]>('/api/v1/production-stage-library'),
    staleTime: 60_000,
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['production-workflow', workflowId] });
    await qc.invalidateQueries({ queryKey: ['production-workflow-version', workflowId] });
  };

  const createDraftMutation = useMutation({
    mutationFn: (fromVersionId?: string) =>
      apiFetch<WorkflowVersion>(`/api/v1/production-workflows/${workflowId}/versions`, {
        method: 'POST',
        body: JSON.stringify(fromVersionId ? { fromVersionId } : {}),
      }),
    onSuccess: async (created) => {
      setBanner(t('workflow.createDraft'));
      setViewingVersionId(created.id);
      setVersionsOpen(false);
      await invalidate();
      try {
        let revision = created.revision;
        const opened = await apiFetch<{ revision: number }>(
          `/api/v1/production-workflows/${workflowId}/versions/${created.id}/ensure-opening-chain`,
          {
            method: 'POST',
            body: JSON.stringify({ expectedRevision: revision }),
          },
        );
        revision = opened.revision;
        await apiFetch(
          `/api/v1/production-workflows/${workflowId}/versions/${created.id}/ensure-terminal-chain`,
          {
            method: 'POST',
            body: JSON.stringify({ expectedRevision: revision }),
          },
        );
        await invalidate();
      } catch {
        /* draft still usable — publish will append anchors */
      }
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const ensureAnchorsMutation = useMutation({
    mutationFn: async (args: { versionId: string; revision: number }) => {
      let revision = args.revision;
      const opened = await apiFetch<{ applied: boolean; revision: number }>(
        `/api/v1/production-workflows/${workflowId}/versions/${args.versionId}/ensure-opening-chain`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: revision }),
        },
      );
      revision = opened.revision;
      return apiFetch<{ applied: boolean; revision: number }>(
        `/api/v1/production-workflows/${workflowId}/versions/${args.versionId}/ensure-terminal-chain`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: revision }),
        },
      );
    },
    onSuccess: async () => {
      await invalidate();
    },
  });
  const ensuredVersionRef = useRef<string | null>(null);

  const patchNode = (
    nodeId: string,
    body: Record<string, unknown>,
    expectedRevision?: number,
  ) => {
    const version = versionQuery.data!;
    return apiFetch(
      `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes/${nodeId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...body,
          ...(expectedRevision != null ? { expectedRevision } : {}),
        }),
      },
    );
  };

  const addMutation = useMutation({
    mutationFn: async (args: {
      stageId?: string;
      create?: CreateStageValues;
      required: boolean;
      runsAfterNodeIds: string[];
      leadsIntoNodeIds: string[];
      placement?: PlacementIntent;
    }) => {
      let stageId = args.stageId;
      let stageCode = 'CUSTOM';
      if (args.create) {
        const hours = args.create.hours.trim() ? Number(args.create.hours) : undefined;
        const created = await apiFetch<StageDefinition>('/api/v1/production-stage-library', {
          method: 'POST',
          body: JSON.stringify({
            nameEn: args.create.nameEn.trim(),
            nameAr: args.create.nameAr.trim(),
            nameHe: args.create.nameHe.trim() || undefined,
            responsibleDepartment: args.create.departmentCode || undefined,
            estimatedHours: Number.isFinite(hours) ? hours : undefined,
            requiresInspection: args.create.requiresInspection,
            requiresPhotos: args.create.requiresPhotos,
            schedulingResourceMode: args.create.schedulingResourceMode,
            resourceSlots:
              args.create.schedulingResourceMode === 'RESOURCE_CONSTRAINED'
                ? Number(args.create.resourceSlots) || 1
                : undefined,
          }),
        });
        stageId = created.id;
        stageCode = created.code;
      }
      if (!stageId) throw new Error(t('workflow.pickStageFirst'));
      const version = versionQuery.data!;
      if (!args.create) {
        stageCode =
          stageLibraryQuery.data?.find((s) => s.id === stageId)?.code ?? stageCode;
      }

      const placement: PlacementIntent =
        args.placement ??
        (args.runsAfterNodeIds.length === 0
          ? { kind: 'START' }
          : { kind: 'AFTER', predecessorIds: args.runsAfterNodeIds });

      const tempId = `__new_${Date.now()}`;
      const simulated = simulateAdd(version, {
        nodeId: tempId,
        code: stageCode,
        placement,
      });
      const explicitStarts =
        placement.kind === 'START' || placement.kind === 'PARALLEL'
          ? [tempId]
          : [];
      // Only treat as explicit start when the node actually has empty preds
      const startIds = explicitStarts.filter(
        (id) => (simulated.predecessorsByNode[id] ?? []).length === 0,
      );
      const validation = validateSimulated(simulated, startIds);
      if (!validation.ok) {
        throw new Error(validation.issues.map((i) => i.message).join('; ') || 'Invalid graph');
      }

      const newPreds = simulated.predecessorsByNode[tempId] ?? [];
      const maxSort = Math.max(0, ...version.nodes.map((n) => n.sortOrder));
      const createdNode = await apiFetch<WorkflowNode>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes`,
        {
          method: 'POST',
          body: JSON.stringify({
            stageDefinitionId: stageId,
            sortOrder: maxSort + 1,
            isRequiredByDefault: true,
            canBeSkipped: false,
            defaultEstimatedMinutes: args.create?.hours.trim()
              ? Math.round(Number(args.create.hours) * 60)
              : undefined,
            responsibleDepartmentId: args.create?.departmentId || undefined,
            runsAfterNodeIds: newPreds,
            expectedRevision: version.revision,
          }),
        },
      );

      const mid = await apiFetch<WorkflowVersion>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}`,
      );
      const finalGraph = simulateAdd(version, {
        nodeId: createdNode.id,
        code: stageCode,
        placement,
      });
      const patches = predecessorDiff(toDomainGraph(mid), finalGraph).filter(
        (p) => p.nodeId !== createdNode.id,
      );
      for (const patch of patches) {
        await patchNode(patch.nodeId, { runsAfterNodeIds: patch.runsAfterNodeIds });
      }
      return createdNode;
    },
    onSuccess: async () => {
      setAddOpen(false);
      setError(null);
      setBanner(t('workflow.stageAdded'));
      await invalidate();
      await stageLibraryQuery.refetch();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const saveNodeMutation = useMutation({
    mutationFn: async (args: {
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
      placement?: PlacementIntent;
      parallelIds?: string[];
    }) => {
      const version = versionQuery.data!;
      const placement: PlacementIntent =
        args.placement ??
        (args.runsAfterNodeIds.length === 0
          ? { kind: 'START' }
          : args.parallelIds && args.parallelIds.length > 0
            ? { kind: 'PARALLEL', referenceNodeIds: args.parallelIds }
            : { kind: 'AFTER', predecessorIds: args.runsAfterNodeIds });

      const before = toDomainGraph(version);
      const after = simulateEdit(version, { nodeId: args.nodeId, placement });
      const explicitStarts =
        placement.kind === 'START' || placement.kind === 'PARALLEL'
          ? [args.nodeId]
          : [];
      const startIds = explicitStarts.filter(
        (id) => (after.predecessorsByNode[id] ?? []).length === 0,
      );
      const validation = validateSimulated(after, startIds);
      if (!validation.ok) {
        throw new Error(validation.issues.map((i) => i.message).join('; ') || 'Invalid graph');
      }

      await patchNode(
        args.nodeId,
        {
          runsAfterNodeIds: after.predecessorsByNode[args.nodeId] ?? [],
          isRequiredByDefault: true,
          canBeSkipped: false,
          defaultEstimatedMinutes: args.defaultEstimatedMinutes,
          inventoryTracking: args.inventoryTracking,
          consumesRawMaterials: args.consumesRawMaterials,
          consumesSemiFinished: args.consumesSemiFinished,
          expectedPieceCount: args.expectedPieceCount ?? undefined,
        },
        version.revision,
      );

      const mid = await apiFetch<WorkflowVersion>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}`,
      );
      const patches = predecessorDiff(toDomainGraph(mid), after).filter(
        (p) => p.nodeId !== args.nodeId,
      );
      for (const patch of patches) {
        await patchNode(patch.nodeId, { runsAfterNodeIds: patch.runsAfterNodeIds });
      }
    },
    onSuccess: async () => {
      setSelectedId(null);
      setBanner(t('workflow.stageUpdated'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const version = versionQuery.data!;
      const before = toDomainGraph(version);
      const after = simulateRemove(version, nodeId);
      await apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes/${nodeId}?reconnect=false&expectedRevision=${version.revision}`,
        { method: 'DELETE' },
      );
      const mid = await apiFetch<WorkflowVersion>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}`,
      );
      const patches = predecessorDiff(toDomainGraph(mid), after);
      for (const patch of patches) {
        await patchNode(patch.nodeId, { runsAfterNodeIds: patch.runsAfterNodeIds });
      }
      void before;
    },
    onSuccess: async () => {
      setSelectedId(null);
      setBanner(t('workflow.stageRemoved'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  /** Persist canonical predecessor sets for editable drafts (legacy spider → minimal DAG). */
  const normalizeDraftMutation = useMutation({
    mutationFn: async () => {
      const version = versionQuery.data!;
      const { patches } = canonicalizeDraftVersion(version);
      for (const patch of patches) {
        await patchNode(patch.nodeId, { runsAfterNodeIds: patch.runsAfterNodeIds });
      }
      return patches.length;
    },
    onSuccess: async (count) => {
      setBanner(
        count > 0
          ? t('workflow.normalizedDraft', { count })
          : t('workflow.alreadyCanonical'),
      );
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const bandLinkMutation = useMutation({
    mutationFn: async (args: {
      fromBandNodeIds: string[];
      toBandNodeIds: string[];
      mode: ParallelBandLinkMode;
    }) => {
      const version = versionQuery.data!;
      const before = toDomainGraph(version);
      const after = simulateParallelBandLink(version, args);
      const validation = validateSimulated(after, [
        ...after.productionNodeIds.filter((id) => {
          const preds = after.predecessorsByNode[id] ?? [];
          if (preds.length > 0) return false;
          return after.nodes.find((n) => n.id === id)?.code === 'MATERIAL_PREP';
        }),
      ]);
      if (!validation.ok) {
        throw new Error(validation.issues.map((i) => i.message).join('; ') || 'Invalid graph');
      }
      const patches = predecessorDiff(before, after);
      for (const patch of patches) {
        await patchNode(patch.nodeId, { runsAfterNodeIds: patch.runsAfterNodeIds });
      }
    },
    onSuccess: async () => {
      setBanner(t('workflow.bandLinkSaved'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const validateMutation = useMutation({
    mutationFn: () => {
      const version = versionQuery.data!;
      return apiFetch<{ ok: boolean; issues?: Array<{ code: string; message: string }> }>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/validate`,
        { method: 'POST' },
      );
    },
    onSuccess: (result) => {
      setValidationIssues(result.issues ?? []);
      if (result.ok) setBanner(t('workflow.preview'));
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.body && typeof err.body === 'object') {
        const body = err.body as { issues?: Array<{ code: string; message: string }> };
        if (body.issues) {
          setValidationIssues(body.issues);
          return;
        }
      }
      setError(mutationErrorMessage(err));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const version = versionQuery.data!;
      let revision = version.revision;
      const opened = await apiFetch<{ revision: number }>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/ensure-opening-chain`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: revision }),
        },
      );
      revision = opened.revision;
      const appended = await apiFetch<{ revision: number }>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/ensure-terminal-chain`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: revision }),
        },
      );
      return apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: appended.revision }),
        },
      );
    },
    onSuccess: async () => {
      setPublishOpen(false);
      setBanner(t('workflow.published'));
      await invalidate();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const wf = workflowQuery.data;
  const version = versionQuery.data;
  const isDraft = version?.status === 'DRAFT';
  const nodes = useMemo(() => version?.nodes ?? [], [version?.nodes]);
  const edges = useMemo(() => version?.edges ?? [], [version?.edges]);
  const { terminal: terminalNodes } = useMemo(
    () => partitionWorkflowAnchors(nodes),
    [nodes],
  );
  const lockedIds = useMemo(() => lockedAnchorNodeIds(nodes), [nodes]);
  const stages = useMemo(
    () => workflowVersionToFlowStages(nodes, edges, locale),
    [locale, edges, nodes],
  );
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    if (!version || version.status !== 'DRAFT') return;
    if (ensuredVersionRef.current === version.id) return;
    if (ensureAnchorsMutation.isPending) return;
    const { terminal } = partitionWorkflowAnchors(version.nodes);
    const hasOpening = version.nodes.some((n) => n.stageDefinition.code === 'MATERIAL_PREP');
    if (terminal.length >= 3 && hasOpening) {
      ensuredVersionRef.current = version.id;
      return;
    }
    ensuredVersionRef.current = version.id;
    ensureAnchorsMutation.mutate({ versionId: version.id, revision: version.revision });
  }, [version?.id, version?.status, version?.revision, version?.nodes.length]);

  if (workflowQuery.isLoading) return <WorkflowSkeleton />;

  if (workflowQuery.isError || !wf) {
    return (
      <ErrorState
        title={t('workflow.loadError')}
        description={t('workflow.retry')}
        retryLabel={t('workflow.retry')}
        onRetry={() => void workflowQuery.refetch()}
      />
    );
  }

  const title = localizedName(locale, wf);

  return (
    <div className="space-y-6">
      <WorkflowHeader
        title={title}
        isDraft={Boolean(isDraft)}
        versionNumber={version?.versionNumber}
        onPublish={isDraft ? () => setPublishOpen(true) : undefined}
        onVersions={() => setVersionsOpen(true)}
        onValidate={versionId ? () => validateMutation.mutate() : undefined}
        publishDisabled={!isDraft}
        validatePending={validateMutation.isPending}
        publishPending={publishMutation.isPending}
      />

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <WorkflowValidationPanel issues={validationIssues} />

      {!versionId ? (
        <Card>
          <EmptyState
            title={t('workflow.draftVersion')}
            description={t('workflow.createDraft')}
            action={
              <Button
                loading={createDraftMutation.isPending}
                onClick={() => createDraftMutation.mutate(wf.activeVersion?.id ?? wf.versions[0]?.id)}
              >
                {t('workflow.createDraft')}
              </Button>
            }
          />
        </Card>
      ) : versionQuery.isLoading ? (
        <WorkflowSkeleton />
      ) : (
        <>
          {!isDraft ? (
            <Alert variant="info">{t('workflow.publishedReadOnly')}</Alert>
          ) : null}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">{t('workflow.stageList')}</h2>
              {isDraft ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={normalizeDraftMutation.isPending}
                    onClick={() => normalizeDraftMutation.mutate()}
                  >
                    {t('workflow.normalizeDraft')}
                  </Button>
                  <Button
                    size="sm"
                    leadingIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setAddOpen(true)}
                  >
                    {t('workflow.addStage')}
                  </Button>
                </div>
              ) : null}
            </div>
            {nodes.length === 0 ? (
              <WorkflowEmptyState onAdd={isDraft ? () => setAddOpen(true) : undefined} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <WorkflowGraphCanvas
                  stages={stages}
                  selectedId={selectedId}
                  onStageClick={(stage) => setSelectedId(stage.id)}
                  rtl={rtl}
                />
                <WorkflowStageList
                  stages={stages}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  lockedIds={lockedIds}
                  nodes={nodes}
                  edges={edges}
                  canEditBandLinks={Boolean(isDraft)}
                  bandLinkSaving={bandLinkMutation.isPending}
                  onBandLinkChange={(args) => bandLinkMutation.mutate(args)}
                />              </div>
            )}
          </div>
        </>
      )}

      <WorkflowStageDrawer
        open={Boolean(selected)}
        node={selected}
        nodes={nodes}
        edges={edges}
        readOnly={!isDraft}
        saving={saveNodeMutation.isPending}
        removing={removeMutation.isPending}
        onClose={() => setSelectedId(null)}
        onSave={(args) => saveNodeMutation.mutate(args)}
        onRemove={(id) => {
          const target = nodes.find((n) => n.id === id);
          if (target && isLockedAnchorNode(target)) {
            setError(
              isTerminalNode(target)
                ? t('workflow.errors.TERMINAL_CHAIN_LOCKED')
                : t('workflow.errors.OPENING_CHAIN_LOCKED'),
            );
            return;
          }
          removeMutation.mutate(id);
        }}
      />

      <AddWorkflowStageDrawer
        open={addOpen}
        nodes={nodes}
        edges={edges}
        library={stageLibraryQuery.data ?? []}
        saving={addMutation.isPending}
        onClose={() => setAddOpen(false)}
        onAdd={(args) => addMutation.mutate(args)}
      />

      <WorkflowVersionDrawer
        open={versionsOpen}
        versions={wf.versions}
        currentId={versionId}
        onClose={() => setVersionsOpen(false)}
        onView={(id) => {
          setViewingVersionId(id);
          setVersionsOpen(false);
        }}
        onCreateDraft={(id) => createDraftMutation.mutate(id)}
        createPending={createDraftMutation.isPending}
      />

      <ConfirmDialog
        open={publishOpen}
        title={t('workflow.publishConfirm')}
        description={t('workflow.futureOrdersOnly')}
        confirmLabel={t('workflow.publish')}
        loading={publishMutation.isPending}
        error={error}
        onClose={() => setPublishOpen(false)}
        onConfirm={() => publishMutation.mutate()}
      />
    </div>
  );
}
