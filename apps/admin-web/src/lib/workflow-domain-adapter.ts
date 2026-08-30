import {
  applyParallelBandLink,
  canonicalizeWorkflowGraph,
  detectParallelBandLinks,
  diffPredecessorSets,
  fromRawGraph,
  simulateWorkflowMutation,
  validateCanonicalWorkflowGraph,
  type CanonicalWorkflowGraph,
  type ParallelBandLinkMode,
  type PlacementIntent,
  type PredecessorPatch,
} from '@maher/workflow-domain';
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from '@/components/workflow/workflow-types';

export function toDomainGraph(version: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): CanonicalWorkflowGraph {
  const nodes = version.nodes
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition.code,
      sortOrder: n.sortOrder,
    }));
  const edges = version.edges.map((e) => ({
    from: e.fromNodeId,
    to: e.toNodeId,
  }));
  return fromRawGraph(nodes, edges);
}

export function simulateParallelBandLink(
  version: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  args: {
    fromBandNodeIds: string[];
    toBandNodeIds: string[];
    mode: ParallelBandLinkMode;
  },
): CanonicalWorkflowGraph {
  return applyParallelBandLink(toDomainGraph(version), args);
}

export { detectParallelBandLinks, applyParallelBandLink };
export type { ParallelBandLinkMode };

export function canonicalDependsByNode(version: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): Map<string, string[]> {
  const g = toDomainGraph(version);
  return new Map(Object.entries(g.predecessorsByNode));
}

export function simulateAdd(
  version: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  args: { nodeId: string; code: string; placement: PlacementIntent },
): CanonicalWorkflowGraph {
  return simulateWorkflowMutation(toDomainGraph(version), {
    kind: 'ADD',
    nodeId: args.nodeId,
    code: args.code,
    placement: args.placement,
  });
}

export function simulateEdit(
  version: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  args: { nodeId: string; placement: PlacementIntent },
): CanonicalWorkflowGraph {
  return simulateWorkflowMutation(toDomainGraph(version), {
    kind: 'EDIT_PLACEMENT',
    nodeId: args.nodeId,
    placement: args.placement,
  });
}

export function simulateRemove(
  version: { nodes: WorkflowNode[]; edges: WorkflowEdge[] },
  nodeId: string,
): CanonicalWorkflowGraph {
  return simulateWorkflowMutation(toDomainGraph(version), {
    kind: 'REMOVE',
    nodeId,
  });
}

export function validateSimulated(
  graph: CanonicalWorkflowGraph,
  explicitStartIds: string[] = [],
) {
  return validateCanonicalWorkflowGraph(graph, {
    explicitStartIds: new Set(explicitStartIds),
  });
}

export function predecessorDiff(
  before: CanonicalWorkflowGraph,
  after: CanonicalWorkflowGraph,
): PredecessorPatch[] {
  return diffPredecessorSets(before, after).filter((p) => {
    const code = after.nodes.find((n) => n.id === p.nodeId)?.code ?? '';
    return code !== 'PACKAGING' && code !== 'DELIVERY';
  });
}

export function canonicalizeDraftVersion(version: WorkflowVersion): {
  before: CanonicalWorkflowGraph;
  after: CanonicalWorkflowGraph;
  patches: PredecessorPatch[];
} {
  const nodes = version.nodes
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition.code,
      sortOrder: n.sortOrder,
    }));
  const rawEdges = version.edges.map((e) => ({
    from: e.fromNodeId,
    to: e.toNodeId,
  }));
  const after = canonicalizeWorkflowGraph({ nodes, edges: rawEdges });
  const before = toDomainGraph(version);
  // Diff raw preds vs canonical: rebuild before from raw without TR
  const rawPreds: Record<string, string[]> = {};
  for (const n of nodes) rawPreds[n.id] = [];
  for (const e of rawEdges) {
    if (!rawPreds[e.to]) rawPreds[e.to] = [];
    rawPreds[e.to]!.push(e.from);
  }
  const beforeRaw = {
    ...after,
    predecessorsByNode: Object.fromEntries(
      Object.entries(rawPreds).map(([k, v]) => [k, [...new Set(v)].sort()]),
    ),
    edges: rawEdges,
  };
  return {
    before: beforeRaw,
    after,
    patches: predecessorDiff(beforeRaw, after),
  };
}

export type { PlacementIntent, CanonicalWorkflowGraph, PredecessorPatch };

export {
  clampParallelReferenceIds,
  clampPredecessorIds,
  materialPrepSuccessorIds,
  productionSuccessorIds,
  validParallelReferenceCandidateIds,
  validPredecessorCandidateIds,
  validSuccessorCandidateIds,
  withSuccessorIds,
} from '@maher/workflow-domain';
