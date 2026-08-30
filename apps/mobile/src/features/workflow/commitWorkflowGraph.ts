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
import { isApiError } from '@/api/errors';
import {
  applyParallelBandLink,
  buildPredMap,
  canonicalizeWorkflowGraph,
  diffPredecessorSets,
  edgesFromPredMap,
  simulateWorkflowMutation,
  validateCanonicalWorkflowGraph,
  type ParallelBandLinkMode,
  type PlacementIntent,
} from '@maher/workflow-domain';
import { isOpeningStageCode } from './workflowTerminal';
import { toDomainGraph } from './toDomainGraph';

async function freshRevision(workflowId: string, versionId: string, fallback: number) {
  try {
    const v = await getWorkflowVersion(workflowId, versionId);
    return v.revision;
  } catch {
    return fallback;
  }
}

function stageCodeForNode(version: WorkflowVersion, nodeId: string): string {
  return version.nodes.find((n) => n.id === nodeId)?.stageDefinition?.code ?? '';
}

/** Never rewrite inbound edges on opening or fully-locked finishing stages. */
export function isLockedRewireTarget(version: WorkflowVersion, nodeId: string): boolean {
  const code = stageCodeForNode(version, nodeId);
  return isOpeningStageCode(code) || code === 'PACKAGING' || code === 'DELIVERY';
}

async function patchRunsAfter(args: {
  workflowId: string;
  versionId: string;
  nodeId: string;
  runsAfterNodeIds: string[];
  fallbackRevision: number;
  extra?: Record<string, unknown>;
}): Promise<number> {
  let revision = await freshRevision(args.workflowId, args.versionId, args.fallbackRevision);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await updateWorkflowNode(args.workflowId, args.versionId, args.nodeId, {
        ...args.extra,
        runsAfterNodeIds: args.runsAfterNodeIds,
        expectedRevision: revision,
      });
      return revision + 1;
    } catch (err) {
      lastErr = err;
      if (!isStaleError(err)) throw err;
      revision = await freshRevision(args.workflowId, args.versionId, revision + 1);
    }
  }
  throw lastErr;
}

function isStaleError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code =
    'code' in err
      ? String((err as { code: string }).code)
      : isApiError(err)
        ? err.code
        : '';
  return code === 'WORKFLOW_VERSION_STALE' || code === 'CONFLICT';
}

/**
 * Persist minimal predecessor-set diff from domain. Does NOT run legacy heals.
 */
async function applyPredecessorDiff(args: {
  workflowId: string;
  versionId: string;
  version: WorkflowVersion;
  before: ReturnType<typeof toDomainGraph>;
  after: ReturnType<typeof toDomainGraph>;
  skipNodeIds?: ReadonlySet<string>;
}): Promise<WorkflowVersion> {
  const patches = diffPredecessorSets(args.before, args.after).filter(
    (p) => !args.skipNodeIds?.has(p.nodeId),
  );
  let revision = args.version.revision;
  for (const patch of patches) {
    if (isLockedRewireTarget(args.version, patch.nodeId)) {
      // Still allow Inspection frontier updates
      if (stageCodeForNode(args.version, patch.nodeId) !== 'INSPECTION') continue;
    }
    const code = stageCodeForNode(args.version, patch.nodeId);
    if (code === 'PACKAGING' || code === 'DELIVERY') continue;
    revision = await patchRunsAfter({
      workflowId: args.workflowId,
      versionId: args.versionId,
      nodeId: patch.nodeId,
      runsAfterNodeIds: patch.runsAfterNodeIds,
      fallbackRevision: revision,
    });
  }
  return getWorkflowVersion(args.workflowId, args.versionId);
}

/** Write version into cache, then invalidate related queries. */
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

/**
 * Editable-draft normalize: canonicalize → persist minimal diff.
 * Replaces legacy commitHealSingleSink / applyInspectionFeedHeal.
 */
export async function commitCanonicalizeDraft(args: {
  workflowId: string;
  version: WorkflowVersion;
}): Promise<WorkflowVersion> {
  const fresh = await getWorkflowVersion(args.workflowId, args.version.id);
  const nodes = (fresh.nodes ?? [])
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition!.code,
      sortOrder: n.sortOrder,
    }));
  const rawEdges = (fresh.edges ?? []).map((e) => ({
    from: e.fromNodeId,
    to: e.toNodeId,
  }));
  const nodeIds = nodes.map((n) => n.id);
  const rawPreds = buildPredMap(nodeIds, rawEdges);
  const after = canonicalizeWorkflowGraph({ nodes, edges: rawEdges });
  const before = {
    ...after,
    predecessorsByNode: rawPreds,
    edges: edgesFromPredMap(rawPreds),
  };
  return applyPredecessorDiff({
    workflowId: args.workflowId,
    versionId: args.version.id,
    version: fresh,
    before,
    after,
  });
}

export async function commitAddWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  stageDefinitionId: string;
  nodeKey: string;
  code: string;
  placement: PlacementIntent;
  required?: boolean;
  createStage?: { code?: string; nameEn: string; nameAr: string; nameHe?: string };
}): Promise<WorkflowVersion> {
  const { workflowId, version, placement } = args;
  const required = true;
  const before = toDomainGraph(version);

  let stageDefinitionId = args.stageDefinitionId;
  let nodeKey = args.nodeKey;
  let code = args.code;
  if (args.createStage) {
    // Omit code so API generates a unique slug (same as admin-web).
    const created = await createStageDefinition({
      nameEn: args.createStage.nameEn,
      nameAr: args.createStage.nameAr,
      nameHe: args.createStage.nameHe || undefined,
    });
    stageDefinitionId = created.id;
    nodeKey = created.code;
    code = created.code;
  }

  if (!stageDefinitionId) {
    throw Object.assign(new Error('Pick or create a stage first'), {
      code: 'WORKFLOW_VALIDATION',
    });
  }

  const tempId = `__new_${Date.now()}`;
  const simulated = simulateWorkflowMutation(before, {
    kind: 'ADD',
    nodeId: tempId,
    code,
    placement,
  });
  const explicitStarts = new Set(
    simulated.productionNodeIds.filter((id) => {
      const preds = simulated.predecessorsByNode[id] ?? [];
      if (preds.length > 0) return false;
      const code = simulated.nodes.find((n) => n.id === id)?.code ?? '';
      if (code === 'MATERIAL_PREP') return true;
      if (id !== tempId) return false;
      return placement.kind === 'START' || placement.kind === 'PARALLEL';
    }),
  );
  const validation = validateCanonicalWorkflowGraph(simulated, {
    explicitStartIds: explicitStarts,
  });
  if (!validation.ok) {
    const msg = validation.issues.map((i) => i.message).join('; ');
    throw Object.assign(new Error(msg || 'Invalid workflow graph'), {
      code: 'WORKFLOW_VALIDATION',
    });
  }

  const newPreds = simulated.predecessorsByNode[tempId] ?? [];
  let revision = await freshRevision(workflowId, version.id, version.revision);
  const maxSort = Math.max(0, ...version.nodes.map((n) => n.sortOrder));

  const createdRaw = await addWorkflowNode(workflowId, version.id, {
    stageDefinitionId,
    // Omit empty nodeKey — API derives a unique key from the stage code
    ...(nodeKey.trim() ? { nodeKey } : {}),
    sortOrder: maxSort + 1,
    isRequiredByDefault: required,
    canBeSkipped: !required,
    runsAfterNodeIds: newPreds,
    expectedRevision: revision,
  });
  const createdId =
    createdRaw && typeof createdRaw === 'object' && 'id' in createdRaw
      ? String((createdRaw as { id: string }).id)
      : '';
  revision += 1;

  const afterAdd = await getWorkflowVersion(workflowId, version.id);
  if (!createdId) return afterAdd;

  // Re-simulate with real id and apply remaining pred diffs (Inspection frontier, etc.)
  const mid = toDomainGraph(afterAdd);
  const finalGraph = simulateWorkflowMutation(before, {
    kind: 'ADD',
    nodeId: createdId,
    code,
    placement,
  });
  return applyPredecessorDiff({
    workflowId,
    versionId: version.id,
    version: afterAdd,
    before: mid,
    after: finalGraph,
    skipNodeIds: new Set([createdId]), // already set on create
  });
}

export async function commitEditWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  nodeId: string;
  placement: PlacementIntent;
  required?: boolean;
}): Promise<WorkflowVersion> {
  const { workflowId, version, nodeId, placement } = args;
  const required = true;
  const before = toDomainGraph(version);
  const after = simulateWorkflowMutation(before, {
    kind: 'EDIT_PLACEMENT',
    nodeId,
    placement,
  });
  const explicitStarts = new Set(
    after.productionNodeIds.filter((id) => {
      const preds = after.predecessorsByNode[id] ?? [];
      if (preds.length > 0) return false;
      const code = after.nodes.find((n) => n.id === id)?.code ?? '';
      if (code === 'MATERIAL_PREP') return true;
      // Start, or Parallel with a root (e.g. Material Prep) → intentional empty preds
      if (id !== nodeId) return false;
      return placement.kind === 'START' || placement.kind === 'PARALLEL';
    }),
  );
  const validation = validateCanonicalWorkflowGraph(after, { explicitStartIds: explicitStarts });
  if (!validation.ok) {
    const msg = validation.issues.map((i) => i.message).join('; ');
    throw Object.assign(new Error(msg || 'Invalid workflow graph'), {
      code: 'WORKFLOW_VALIDATION',
    });
  }

  let revision = await freshRevision(workflowId, version.id, version.revision);
  // Patch target required flags + first apply all pred diffs
  revision = await patchRunsAfter({
    workflowId,
    versionId: version.id,
    nodeId,
    runsAfterNodeIds: after.predecessorsByNode[nodeId] ?? [],
    fallbackRevision: revision,
    extra: {
      isRequiredByDefault: required,
      canBeSkipped: !required,
    },
  });

  const mid = await getWorkflowVersion(workflowId, version.id);
  return applyPredecessorDiff({
    workflowId,
    versionId: version.id,
    version: mid,
    before: toDomainGraph(mid),
    after,
    skipNodeIds: new Set([nodeId]),
  });
}

export async function commitRemoveWorkflowStage(args: {
  workflowId: string;
  version: WorkflowVersion;
  nodeId: string;
}): Promise<WorkflowVersion> {
  const before = toDomainGraph(args.version);
  const after = simulateWorkflowMutation(before, {
    kind: 'REMOVE',
    nodeId: args.nodeId,
  });

  const revision = await freshRevision(
    args.workflowId,
    args.version.id,
    args.version.revision,
  );
  await removeWorkflowNode(args.workflowId, args.version.id, args.nodeId, revision, {
    reconnect: false,
  });

  const mid = await getWorkflowVersion(args.workflowId, args.version.id);
  return applyPredecessorDiff({
    workflowId: args.workflowId,
    versionId: args.version.id,
    version: mid,
    before: toDomainGraph(mid),
    after,
  });
}

/**
 * Between two parallel groups: wait for all (Together) or continue as independent lanes.
 */
export async function commitParallelBandLink(args: {
  workflowId: string;
  version: WorkflowVersion;
  fromBandNodeIds: string[];
  toBandNodeIds: string[];
  mode: ParallelBandLinkMode;
}): Promise<WorkflowVersion> {
  const fresh = await getWorkflowVersion(args.workflowId, args.version.id);
  const before = toDomainGraph(fresh);
  const after = applyParallelBandLink(before, {
    fromBandNodeIds: args.fromBandNodeIds,
    toBandNodeIds: args.toBandNodeIds,
    mode: args.mode,
  });
  const validation = validateCanonicalWorkflowGraph(after, {
    explicitStartIds: new Set(
      after.productionNodeIds.filter((id) => {
        const preds = after.predecessorsByNode[id] ?? [];
        if (preds.length > 0) return false;
        return after.nodes.find((n) => n.id === id)?.code === 'MATERIAL_PREP';
      }),
    ),
  });
  if (!validation.ok) {
    const msg = validation.issues.map((i) => i.message).join('; ');
    throw Object.assign(new Error(msg || 'Invalid workflow graph'), {
      code: 'WORKFLOW_VALIDATION',
    });
  }
  return applyPredecessorDiff({
    workflowId: args.workflowId,
    versionId: fresh.id,
    version: fresh,
    before,
    after,
  });
}
