'use client';

import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { mutationErrorMessage } from '@/hooks/use-api-mutation';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { localizedName } from '@maher/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

interface StageDefinition {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface WorkflowNode {
  id: string;
  nodeKey: string;
  sortOrder: number;
  isRequiredByDefault: boolean;
  canBeSkipped: boolean;
  stageDefinition: StageDefinition;
  incomingEdges?: { fromNodeId: string }[];
}

interface WorkflowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

interface WorkflowVersion {
  id: string;
  versionNumber: number;
  status: string;
  revision: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowDetail {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  status: string;
  activeVersion?: WorkflowVersion | null;
  versions: Array<{ id: string; versionNumber: number; status: string }>;
}

function nodeLabel(node: WorkflowNode, locale: string) {
  return localizedName(locale, node.stageDefinition, node.stageDefinition.code);
}

export default function WorkflowBuilderPage({ params }: { params: { id: string } }) {
  const workflowId = params.id;
  const t = useTranslations('production');
  const tc = useTranslations('catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();

  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<Array<{ code: string; message: string }>>(
    [],
  );

  const [pickStageId, setPickStageId] = useState('');
  const [newStageCode, setNewStageCode] = useState('');
  const [newStageEn, setNewStageEn] = useState('');
  const [newStageAr, setNewStageAr] = useState('');
  const [createNewStage, setCreateNewStage] = useState(false);
  const [required, setRequired] = useState(true);
  const [runsAfter, setRunsAfter] = useState<string[]>([]);

  const workflowQuery = useQuery({
    queryKey: ['production-workflow', workflowId],
    queryFn: () => apiFetch<WorkflowDetail>(`/api/v1/production-workflows/${workflowId}`),
  });

  const draftVersionId = useMemo(() => {
    const wf = workflowQuery.data;
    if (!wf) return null;
    const draft = wf.versions.find((v) => v.status === 'DRAFT');
    return draft?.id ?? null;
  }, [workflowQuery.data]);

  const versionQuery = useQuery({
    queryKey: ['production-workflow-version', workflowId, draftVersionId],
    enabled: Boolean(draftVersionId),
    queryFn: () =>
      apiFetch<WorkflowVersion>(
        `/api/v1/production-workflows/${workflowId}/versions/${draftVersionId}`,
      ),
  });

  const stageLibraryQuery = useQuery({
    queryKey: ['production-stage-library'],
    queryFn: () => apiFetch<StageDefinition[]>('/api/v1/production-stage-library'),
    staleTime: 60_000,
  });

  const createDraftMutation = useMutation({
    mutationFn: (fromVersionId?: string) =>
      apiFetch<WorkflowVersion>(`/api/v1/production-workflows/${workflowId}/versions`, {
        method: 'POST',
        body: JSON.stringify(fromVersionId ? { fromVersionId } : {}),
      }),
    onSuccess: async () => {
      setBanner(t('workflow.createDraft'));
      await qc.invalidateQueries({ queryKey: ['production-workflow', workflowId] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const addNodeMutation = useMutation({
    mutationFn: async () => {
      let stageId = pickStageId;
      if (createNewStage) {
        const created = await apiFetch<StageDefinition>('/api/v1/production-stage-library', {
          method: 'POST',
          body: JSON.stringify({
            code: newStageCode.trim(),
            nameEn: newStageEn.trim(),
            nameAr: newStageAr.trim(),
            sortOrder: (stageLibraryQuery.data?.length ?? 0) + 1,
          }),
        });
        stageId = created.id;
      }
      const version = versionQuery.data!;
      const stage = (stageLibraryQuery.data ?? []).find((s) => s.id === stageId);
      const nodeKey = stage?.code ?? newStageCode.trim();
      return apiFetch(`/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes`, {
        method: 'POST',
        body: JSON.stringify({
          stageDefinitionId: stageId,
          nodeKey,
          sortOrder: version.nodes.length,
          isRequiredByDefault: required,
          canBeSkipped: !required,
          runsAfterNodeIds: runsAfter,
          expectedRevision: version.revision,
        }),
      });
    },
    onSuccess: async () => {
      setAddOpen(false);
      setPickStageId('');
      setRunsAfter([]);
      setCreateNewStage(false);
      setError(null);
      await qc.invalidateQueries({ queryKey: ['production-workflow-version', workflowId] });
      await qc.invalidateQueries({ queryKey: ['production-workflow', workflowId] });
      await stageLibraryQuery.refetch();
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const updateNodeMutation = useMutation({
    mutationFn: (args: {
      nodeId: string;
      runsAfterNodeIds: string[];
      isRequiredByDefault: boolean;
    }) => {
      const version = versionQuery.data!;
      return apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes/${args.nodeId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isRequiredByDefault: args.isRequiredByDefault,
            canBeSkipped: !args.isRequiredByDefault,
            runsAfterNodeIds: args.runsAfterNodeIds,
            expectedRevision: version.revision,
          }),
        },
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['production-workflow-version', workflowId] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const removeNodeMutation = useMutation({
    mutationFn: (nodeId: string) => {
      const version = versionQuery.data!;
      return apiFetch(
        `/api/v1/production-workflows/${workflowId}/versions/${version.id}/nodes/${nodeId}?reconnect=true&expectedRevision=${version.revision}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['production-workflow-version', workflowId] });
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
      setBanner(t('workflow.publish'));
      await qc.invalidateQueries({ queryKey: ['production-workflow', workflowId] });
      await qc.invalidateQueries({ queryKey: ['production-workflow-version', workflowId] });
    },
    onError: (err) => setError(mutationErrorMessage(err)),
  });

  const wf = workflowQuery.data;
  const version = versionQuery.data;
  const isDraft = version?.status === 'DRAFT';
  const nodes = version?.nodes ?? [];
  const edges = version?.edges ?? [];

  const incomingByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      const list = map.get(edge.toNodeId) ?? [];
      list.push(edge.fromNodeId);
      map.set(edge.toNodeId, list);
    }
    return map;
  }, [edges]);

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.sortOrder - b.sortOrder || a.nodeKey.localeCompare(b.nodeKey)),
    [nodes],
  );

  if (workflowQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

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

  const title = localizedName(locale, wf, wf.code);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/production/workflow" className="text-sm text-text-secondary hover:text-brand">
            ← {t('workflow.title')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-text-secondary" dir="ltr">
            {wf.code}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!draftVersionId ? (
            <Button
              variant="secondary"
              loading={createDraftMutation.isPending}
              onClick={() =>
                createDraftMutation.mutate(wf.activeVersion?.id ?? wf.versions[0]?.id)
              }
            >
              {t('workflow.createDraft')}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                loading={validateMutation.isPending}
                onClick={() => validateMutation.mutate()}
              >
                {t('workflow.preview')}
              </Button>
              <Button
                loading={publishMutation.isPending}
                onClick={() => setPublishOpen(true)}
                disabled={!isDraft}
              >
                {t('workflow.publish')}
              </Button>
            </>
          )}
          <Link href="/production/workflow/stages">
            <Button variant="ghost">{t('workflow.stageLibrary')}</Button>
          </Link>
        </div>
      </div>

      {banner ? <Alert variant="success">{banner}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {validationIssues.length ? (
        <Alert variant="warning">
          <ul className="list-disc ps-4">
            {validationIssues.map((issue) => (
              <li key={issue.code}>
                {t(`workflow.errors.${issue.code}` as never, { default: issue.message })}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {!draftVersionId ? (
        <Card>
          <EmptyState
            title={t('workflow.draftVersion')}
            description={t('workflow.createDraft')}
            action={
              <Button
                loading={createDraftMutation.isPending}
                onClick={() =>
                  createDraftMutation.mutate(wf.activeVersion?.id ?? wf.versions[0]?.id)
                }
              >
                {t('workflow.createDraft')}
              </Button>
            }
          />
        </Card>
      ) : versionQuery.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card
          title={`${t('workflow.draftVersion')} v${version?.versionNumber ?? '—'}`}
          actions={
            isDraft ? (
              <Button
                size="sm"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => setAddOpen(true)}
              >
                {t('workflow.addStage')}
              </Button>
            ) : null
          }
        >
          {sortedNodes.length === 0 ? (
            <EmptyState title={t('workflow.emptyStages')} description={t('workflow.runsAfterHint')} />
          ) : (
            <div className="space-y-4">
              {sortedNodes.map((node, index) => {
                const predecessors = incomingByNode.get(node.id) ?? [];
                const otherNodes = sortedNodes.filter((n) => n.id !== node.id);
                return (
                  <div
                    key={node.id}
                    className="rounded-xl border border-border bg-surface-muted/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                            {index + 1}
                          </span>
                          <p className="font-semibold text-text-primary">
                            {nodeLabel(node, locale)}
                          </p>
                          <Badge variant={node.isRequiredByDefault ? 'default' : 'warning'}>
                            {node.isRequiredByDefault ? t('workflow.required') : t('workflow.optional')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-text-tertiary" dir="ltr">
                          {node.nodeKey}
                        </p>
                      </div>
                      {isDraft ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          leadingIcon={<Trash2 className="h-4 w-4" />}
                          onClick={() => removeNodeMutation.mutate(node.id)}
                          loading={removeNodeMutation.isPending}
                        >
                          {t('workflow.removeStage')}
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-medium text-text-secondary">
                          {t('workflow.runsAfter')}
                        </p>
                        <p className="mb-2 text-[11px] text-text-tertiary">{t('workflow.runsAfterHint')}</p>
                        {isDraft ? (
                          <div className="flex flex-wrap gap-2">
                            {otherNodes.map((candidate) => {
                              const checked = predecessors.includes(candidate.id);
                              return (
                                <label
                                  key={candidate.id}
                                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...predecessors, candidate.id]
                                        : predecessors.filter((id) => id !== candidate.id);
                                      updateNodeMutation.mutate({
                                        nodeId: node.id,
                                        runsAfterNodeIds: next,
                                        isRequiredByDefault: node.isRequiredByDefault,
                                      });
                                    }}
                                  />
                                  {nodeLabel(candidate, locale)}
                                </label>
                              );
                            })}
                            {otherNodes.length === 0 ? (
                              <span className="text-xs text-text-tertiary">—</span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {predecessors.length === 0 ? (
                              <Badge variant="success">{t('workflow.parallel')}</Badge>
                            ) : (
                              predecessors.map((pid) => {
                                const pred = sortedNodes.find((n) => n.id === pid);
                                return pred ? (
                                  <Badge key={pid}>{nodeLabel(pred, locale)}</Badge>
                                ) : null;
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {isDraft ? (
                        <div>
                          <p className="mb-2 text-xs font-medium text-text-secondary">
                            {t('workflow.required')} / {t('workflow.optional')}
                          </p>
                          <Select
                            value={node.isRequiredByDefault ? 'required' : 'optional'}
                            onChange={(e) =>
                              updateNodeMutation.mutate({
                                nodeId: node.id,
                                runsAfterNodeIds: predecessors,
                                isRequiredByDefault: e.target.value === 'required',
                              })
                            }
                            options={[
                              { value: 'required', label: t('workflow.required') },
                              { value: 'optional', label: t('workflow.optional') },
                            ]}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {wf.activeVersion ? (
        <Card title={t('workflow.activeVersion')}>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>
              v{wf.activeVersion.versionNumber} · {wf.activeVersion.nodes?.length ?? 0}{' '}
              {t('workflow.stageName').toLowerCase()}
            </span>
            <StatusBadge status={wf.activeVersion.status} />
          </div>
        </Card>
      ) : null}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('workflow.addStage')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              loading={addNodeMutation.isPending}
              disabled={!createNewStage ? !pickStageId : !newStageCode.trim() || !newStageEn.trim()}
              onClick={() => addNodeMutation.mutate()}
            >
              {t('workflow.addStage')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createNewStage}
              onChange={(e) => setCreateNewStage(e.target.checked)}
            />
            {t('workflow.createStage')}
          </label>
          {createNewStage ? (
            <>
              <Input label="Code" value={newStageCode} onChange={(e) => setNewStageCode(e.target.value)} dir="ltr" />
              <Input label={tc('nameEn')} value={newStageEn} onChange={(e) => setNewStageEn(e.target.value)} />
              <Input label={tc('nameAr')} value={newStageAr} onChange={(e) => setNewStageAr(e.target.value)} />
            </>
          ) : (
            <Select
              label={t('workflow.stageName')}
              value={pickStageId}
              onChange={(e) => setPickStageId(e.target.value)}
              options={[
                { value: '', label: '—' },
                ...(stageLibraryQuery.data ?? [])
                  .filter((s) => s.isActive)
                  .map((s) => ({
                    value: s.id,
                    label: `${localizedName(locale, s)} (${s.code})`,
                  })),
              ]}
            />
          )}
          <Select
            label={t('workflow.required')}
            value={required ? 'required' : 'optional'}
            onChange={(e) => setRequired(e.target.value === 'required')}
            options={[
              { value: 'required', label: t('workflow.required') },
              { value: 'optional', label: t('workflow.optional') },
            ]}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">{t('workflow.runsAfter')}</p>
            <div className="flex flex-wrap gap-2">
              {sortedNodes.map((n) => (
                <label
                  key={n.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={runsAfter.includes(n.id)}
                    onChange={(e) =>
                      setRunsAfter((prev) =>
                        e.target.checked ? [...prev, n.id] : prev.filter((id) => id !== n.id),
                      )
                    }
                  />
                  {nodeLabel(n, locale)}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

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
