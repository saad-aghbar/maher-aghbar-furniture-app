'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { AddWorkflowStageDrawer } from '@/components/workflow/add-workflow-stage-drawer';
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
  editConnectionPatches,
  resolveSortOrderForInsert,
  spliceSuccessorPreds,
} from '@/lib/workflow-rewire';
import { Alert, Button, Card, EmptyState, ErrorState } from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { CreateStageValues } from '@/components/workflow/create-stage-form';

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
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

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
    }) => {
      let stageId = args.stageId;
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
          }),
        });
        stageId = created.id;
      }
      if (!stageId) throw new Error(t('workflow.pickStageFirst'));
      const version = versionQuery.data!;
      const sortOrder = resolveSortOrderForInsert(
        version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
        args.runsAfterNodeIds,
        args.leadsIntoNodeIds,
      );
      const createdNode = await apiFetch<WorkflowNode>(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes`,
        {
          method: 'POST',
          body: JSON.stringify({
            stageDefinitionId: stageId,
            sortOrder,
            isRequiredByDefault: args.required,
            canBeSkipped: !args.required,
            defaultEstimatedMinutes: args.create?.hours.trim()
              ? Math.round(Number(args.create.hours) * 60)
              : undefined,
            responsibleDepartmentId: args.create?.departmentId || undefined,
            runsAfterNodeIds: args.runsAfterNodeIds,
            expectedRevision: version.revision,
          }),
        },
      );
      const successorPatches = spliceSuccessorPreds(
        version.edges,
        createdNode.id,
        args.runsAfterNodeIds,
        args.leadsIntoNodeIds,
      );
      for (const patch of successorPatches) {
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
    }) => {
      const version = versionQuery.data!;
      const { successorUpdates } = editConnectionPatches(
        version.edges,
        args.nodeId,
        args.runsAfterNodeIds,
        args.leadsIntoNodeIds,
      );
      await patchNode(
        args.nodeId,
        {
          runsAfterNodeIds: args.runsAfterNodeIds,
          isRequiredByDefault: args.isRequiredByDefault,
          canBeSkipped: !args.isRequiredByDefault,
          defaultEstimatedMinutes: args.defaultEstimatedMinutes,
        },
        version.revision,
      );
      for (const patch of successorUpdates) {
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
    mutationFn: (nodeId: string) => {
      const version = versionQuery.data!;
      return apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes/${nodeId}?reconnect=true&expectedRevision=${version.revision}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: async () => {
      setSelectedId(null);
      setBanner(t('workflow.stageRemoved'));
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
    mutationFn: () => {
      const version = versionQuery.data!;
      return apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ expectedRevision: version.revision }),
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
  const stages = useMemo(
    () => workflowVersionToFlowStages(nodes, edges, locale),
    [edges, locale, nodes],
  );
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

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
        onAddStage={isDraft ? () => setAddOpen(true) : undefined}
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
          {stages.length === 0 ? (
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
              />
            </div>
          )}
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
        onRemove={(id) => removeMutation.mutate(id)}
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
