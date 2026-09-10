import type { WorkflowVersion } from '@/api/modules/workflow';
import { workflowGraphChainRequirements } from '@maher/types';
import {
  canonicalizeWorkflowGraph,
  edgePairs,
  fromRawGraph,
  type CanonicalWorkflowGraph,
  type WorkflowDomainEdge,
  type WorkflowDomainNode,
} from '@maher/workflow-domain';

export function chainFlagsForVersion(version: Pick<WorkflowVersion, 'scope' | 'nodes'>) {
  return workflowGraphChainRequirements(
    version.scope,
    (version.nodes ?? []).map((n) => n.stageDefinition?.code ?? ''),
  );
}

/**
 * Convert API workflow version → canonical domain graph.
 * Sole edge source for mobile authoring UI after migration.
 */
export function toDomainGraph(version: WorkflowVersion): CanonicalWorkflowGraph {
  const nodes: WorkflowDomainNode[] = (version.nodes ?? [])
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition!.code,
      sortOrder: n.sortOrder,
    }));
  const edges: WorkflowDomainEdge[] = (version.edges ?? []).map((e) => ({
    from: e.fromNodeId,
    to: e.toNodeId,
  }));
  return fromRawGraph(nodes, edges, chainFlagsForVersion(version));
}

export function canonicalEdgePairs(graph: CanonicalWorkflowGraph): string[] {
  return edgePairs(graph.edges);
}

/** Edges as API-shaped objects for layout helpers that still expect fromNodeId/toNodeId. */
export function canonicalEdgesForLayout(graph: CanonicalWorkflowGraph): Array<{
  id: string;
  fromNodeId: string;
  toNodeId: string;
}> {
  return graph.edges.map((e, i) => ({
    id: `canon-${i}`,
    fromNodeId: e.from,
    toNodeId: e.to,
  }));
}

export function recanonicalizeFromVersionLike(
  nodes: WorkflowDomainNode[],
  edges: WorkflowDomainEdge[],
  options?: { requiresOpeningChain?: boolean; requiresTerminalChain?: boolean },
): CanonicalWorkflowGraph {
  return canonicalizeWorkflowGraph({
    nodes,
    edges,
    requiresOpeningChain: options?.requiresOpeningChain,
    requiresTerminalChain: options?.requiresTerminalChain,
  });
}
