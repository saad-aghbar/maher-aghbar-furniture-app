/**
 * @deprecated Authoring uses @maher/workflow-domain via toDomainGraph / commitCanonicalizeDraft.
 * These helpers remain only for legacy unit tests. Do not call from UI or commit paths.
 */
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from '@/api/modules/workflow';
import { canonicalizeWorkflowGraph } from '@maher/workflow-domain';
import type { EdgeLike } from './rewireWorkflowEdges';
import { getMaterialPrepNodeId, middleProductionNodes } from './workflowTerminal';

/** @deprecated No-op — orphans stay invalid roots until author places them. */
export function ensureSensibleRootPatches(
  _nodes: Array<Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>,
  _edges: EdgeLike[],
): Array<{ nodeId: string; runsAfterNodeIds: string[] }> {
  return [];
}

/** @deprecated Preview must use canonicalizeWorkflowGraph / toDomainGraph. */
export function normalizeWorkflowEdgesForPreview(
  version: Pick<WorkflowVersion, 'edges'>,
  nodes: WorkflowNode[],
): EdgeLike[] {
  const domainNodes = nodes
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition!.code,
      sortOrder: n.sortOrder,
    }));
  const raw = (version.edges ?? []).map((e) => ({
    from: e.fromNodeId,
    to: e.toNodeId,
  }));
  const g = canonicalizeWorkflowGraph({ nodes: domainNodes, edges: raw });
  return g.edges.map((e) => ({ fromNodeId: e.from, toNodeId: e.to }));
}

/** @deprecated Use toDomainGraph + canonicalEdgesForLayout. */
export function healedEdgesForVersion(version: WorkflowVersion): WorkflowEdge[] {
  const nodes = version.nodes ?? [];
  return normalizeWorkflowEdgesForPreview(version, nodes).map((e) => ({
    id: `${e.fromNodeId}->${e.toNodeId}`,
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
  })) as WorkflowEdge[];
}

/** Default After target when adding without explicit pick (frontier / prep). */
export function defaultAfterPredecessorIds(
  nodes: Array<Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>,
  edges: EdgeLike[],
): string[] {
  const middle = middleProductionNodes(nodes as WorkflowNode[]);
  if (middle.length > 0) {
    const outs = new Set(edges.map((e) => e.fromNodeId));
    const frontier = middle.filter((n) => !outs.has(n.id));
    const pick = frontier[frontier.length - 1] ?? middle[middle.length - 1];
    return pick ? [pick.id] : [];
  }
  const prep = getMaterialPrepNodeId(nodes);
  return prep ? [prep] : [];
}
