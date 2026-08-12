import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import {
  addWorkflowNode,
  createStageDefinition,
  getWorkflowVersion,
  removeWorkflowNode,
  updateWorkflowNode,
  type WorkflowVersion,
} from '@/api/modules/workflow';
import {
  editConnectionPatches,
  ensureSingleSinkPatches,
  resolveLeadsIntoForSave,
  resolveSinkId,
  resolveSortOrderForInsert,
  spliceSuccessorPreds,
  wouldCreateCycle,
} from './rewireWorkflowEdges';

async function freshRevision(workflowId: string, versionId: string, fallback: number) {
  try {
    const v = await getWorkflowVersion(workflowId, versionId);
    return v.revision;
  } catch {
    return fallback;
  }
}

async function applySinkHeal(
  workflowId: string,
  versionId: string,
  version: WorkflowVersion,
): Promise<WorkflowVersion> {
  const sinkId = resolveSinkId(
    version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    version.edges,
  );
  if (!sinkId) return version;

  const patches = ensureSingleSinkPatches(
    version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder })),
    version.edges,
    sinkId,
  );
  if (patches.length === 0) return version;

  let revision = version.revision;
  for (const patch of patches) {
    await updateWorkflowNode(workflowId, versionId, patch.nodeId, {
      runsAfterNodeIds: patch.runsAfterNodeIds,
      expectedRevision: revision,
    });
    revision += 1;
  }

  return getWorkflowVersion(workflowId, versionId);
}

/** Write healed version into cache, then invalidate related queries. */
export function useApplyWorkflowVersionCache(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return async (healed: WorkflowVersion) => {
    qc.setQueryData(queryKeys.workflow.version(workflowId, versionId), healed);
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) }),
      qc.invalidateQueries({ queryKey: queryKeys.workflow.stageLibrary() }),
    ]);
  };
}

/** Invalidate without a healed payload (e.g. after publish). */
export function useInvalidateWorkflowVersion(workflowId: string, versionId: string) {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.workflow.version(workflowId, versionId) }),
      qc.invalidateQueries({ queryKey: queryKeys.workflow.detail(workflowId) }),
      qc.invalidateQueries({ queryKey: queryKeys.workflow.stageLibrary() }),
    ]);
  };
}

/** Heal multi-terminal drafts (e.g. Carpentry dead-end) before publish. */
export async function commitHealSingleSink(args: {
  workflowId: string;
  version: WorkflowVersion;
}): Promise<WorkflowVersion> {
  const fresh = await getWorkflowVersion(args.workflowId, args.version.id);
  return applySinkHeal(args.workflowId, args.version.id, fresh);
}

export async function commitAddWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  stageDefinitionId: string;
  nodeKey: string;
  required: boolean;
  runsAfterIds: string[];
  leadsIntoIds: string[];
  /** Create-new-stage path */
  createStage?: { code: string; nameEn: string; nameAr: string; nameHe: string };
}): Promise<WorkflowVersion> {
  const { workflowId, version, required, runsAfterIds } = args;
  const nodeSort = version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder }));
  const leadsIntoIds = resolveLeadsIntoForSave({
    nodes: nodeSort,
    edges: version.edges,
    targetId: '__new__',
    runsAfterIds,
    leadsIntoIds: args.leadsIntoIds,
  });

  if (wouldCreateCycle(version.edges, '__new__', runsAfterIds, leadsIntoIds)) {
    throw Object.assign(new Error('WORKFLOW_CYCLE'), { code: 'WORKFLOW_CYCLE' });
  }

  let stageDefinitionId = args.stageDefinitionId;
  let nodeKey = args.nodeKey;
  if (args.createStage) {
    const created = await createStageDefinition(args.createStage);
    stageDefinitionId = created.id;
    nodeKey = created.code;
  }

  let revision = await freshRevision(workflowId, version.id, version.revision);
  const sortOrder = resolveSortOrderForInsert(nodeSort, runsAfterIds, leadsIntoIds);

  const created = (await addWorkflowNode(workflowId, version.id, {
    stageDefinitionId,
    nodeKey,
    sortOrder,
    isRequiredByDefault: required,
    canBeSkipped: !required,
    runsAfterNodeIds: runsAfterIds,
    expectedRevision: revision,
  })) as { id: string };
  revision += 1;

  if (leadsIntoIds.length > 0 && created?.id) {
    const patches = spliceSuccessorPreds(
      version.edges,
      created.id,
      runsAfterIds,
      leadsIntoIds,
    );
    for (const patch of patches) {
      await updateWorkflowNode(workflowId, version.id, patch.nodeId, {
        runsAfterNodeIds: patch.runsAfterNodeIds,
        expectedRevision: revision,
      });
      revision += 1;
    }
  }

  const after = await getWorkflowVersion(workflowId, version.id);
  return applySinkHeal(workflowId, version.id, after);
}

export async function commitEditWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  nodeId: string;
  required: boolean;
  runsAfterIds: string[];
  leadsIntoIds: string[];
}): Promise<WorkflowVersion> {
  const { workflowId, version, nodeId, required, runsAfterIds } = args;
  const nodeSort = version.nodes.map((n) => ({ id: n.id, sortOrder: n.sortOrder }));
  const leadsIntoIds = resolveLeadsIntoForSave({
    nodes: nodeSort,
    edges: version.edges,
    targetId: nodeId,
    runsAfterIds,
    leadsIntoIds: args.leadsIntoIds,
  });

  if (wouldCreateCycle(version.edges, nodeId, runsAfterIds, leadsIntoIds, true)) {
    throw Object.assign(new Error('WORKFLOW_CYCLE'), { code: 'WORKFLOW_CYCLE' });
  }

  const { targetRunsAfter, successorUpdates } = editConnectionPatches(
    version.edges,
    nodeId,
    runsAfterIds,
    leadsIntoIds,
  );

  let revision = await freshRevision(workflowId, version.id, version.revision);

  await updateWorkflowNode(workflowId, version.id, nodeId, {
    isRequiredByDefault: required,
    canBeSkipped: !required,
    runsAfterNodeIds: targetRunsAfter,
    expectedRevision: revision,
  });
  revision += 1;

  for (const patch of successorUpdates) {
    await updateWorkflowNode(workflowId, version.id, patch.nodeId, {
      runsAfterNodeIds: patch.runsAfterNodeIds,
      expectedRevision: revision,
    });
    revision += 1;
  }

  const after = await getWorkflowVersion(workflowId, version.id);
  return applySinkHeal(workflowId, version.id, after);
}

export async function commitRemoveWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  nodeId: string;
}): Promise<WorkflowVersion> {
  const revision = await freshRevision(
    args.workflowId,
    args.version.id,
    args.version.revision,
  );
  await removeWorkflowNode(args.workflowId, args.version.id, args.nodeId, revision);

  const after = await getWorkflowVersion(args.workflowId, args.version.id);
  return applySinkHeal(args.workflowId, args.version.id, after);
}
