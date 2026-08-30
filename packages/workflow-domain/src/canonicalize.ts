import { OPENING_STAGE_CODE } from '@maher/types';
import { computeProductionFrontier } from './frontier';
import {
  buildPredMap,
  computeLevels,
  deriveSuccMap,
  edgesFromPredMap,
  isOpeningCode,
  isProductionCode,
  isTerminalCode,
  sortedUnique,
} from './graph';
import { computeParallelBands } from './parallelBands';
import { transitiveReduceProduction } from './transitiveReduction';
import type {
  CanonicalWorkflowGraph,
  WorkflowDomainEdge,
  WorkflowDomainNode,
} from './types';

export type CanonicalizeInput = {
  nodes: WorkflowDomainNode[];
  edges: WorkflowDomainEdge[];
};

/**
 * Enforce invariants only. Does NOT invent production parents for orphans.
 */
export function canonicalizeWorkflowGraph(input: CanonicalizeInput): CanonicalWorkflowGraph {
  const nodes = [...input.nodes].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const nodeIds = nodes.map((n) => n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const inspectionNodeId =
    nodes.find((n) => n.code === 'INSPECTION')?.id ?? null;
  const packagingNodeId =
    nodes.find((n) => n.code === 'PACKAGING')?.id ?? null;
  const deliveryNodeId =
    nodes.find((n) => n.code === 'DELIVERY')?.id ?? null;

  const productionNodeIds = sortedUnique(
    nodes.filter((n) => isProductionCode(n.code)).map((n) => n.id),
  );

  // Start from edges; drop unknown / self
  const rawEdges = input.edges
    .filter((e) => e.from !== e.to && byId.has(e.from) && byId.has(e.to))
    .map((e) => ({ from: e.from, to: e.to }));

  let predecessorsByNode = buildPredMap(nodeIds, rawEdges);

  // Strip production → Packaging/Delivery and any edge into Packaging/Delivery except Inspection→Packaging, Packaging→Delivery
  for (const id of nodeIds) {
    const code = byId.get(id)?.code ?? '';
    if (code === 'PACKAGING') {
      predecessorsByNode[id] = inspectionNodeId ? [inspectionNodeId] : [];
      continue;
    }
    if (code === 'DELIVERY') {
      predecessorsByNode[id] = packagingNodeId ? [packagingNodeId] : [];
      continue;
    }
    // Production + Inspection: drop terminal preds except we handle Inspection below
    predecessorsByNode[id] = sortedUnique(
      (predecessorsByNode[id] ?? []).filter((p) => {
        const pc = byId.get(p)?.code ?? '';
        return !isTerminalCode(pc) || (code === 'INSPECTION' && false);
      }),
    );
  }

  // Transitive reduce production subgraph only
  predecessorsByNode = transitiveReduceProduction(productionNodeIds, predecessorsByNode);

  // REPLACE Inspection preds with production frontier
  const frontierNodeIds = computeProductionFrontier(productionNodeIds, predecessorsByNode);
  if (inspectionNodeId) {
    predecessorsByNode[inspectionNodeId] = [...frontierNodeIds];
  }
  if (packagingNodeId && inspectionNodeId) {
    predecessorsByNode[packagingNodeId] = [inspectionNodeId];
  }
  if (deliveryNodeId && packagingNodeId) {
    predecessorsByNode[deliveryNodeId] = [packagingNodeId];
  }

  // Ensure every node key exists
  for (const id of nodeIds) {
    if (!predecessorsByNode[id]) predecessorsByNode[id] = [];
    predecessorsByNode[id] = sortedUnique(predecessorsByNode[id]!);
  }

  const successorsByNode = deriveSuccMap(nodeIds, predecessorsByNode);
  const edges = edgesFromPredMap(predecessorsByNode);
  const levels = computeLevels(nodeIds, predecessorsByNode);
  const parallelBands = computeParallelBands(productionNodeIds, predecessorsByNode);

  return {
    nodes,
    edges,
    predecessorsByNode,
    successorsByNode,
    levels,
    parallelBands,
    productionNodeIds,
    inspectionNodeId,
    packagingNodeId,
    deliveryNodeId,
    frontierNodeIds,
  };
}

export function isAllowedRoot(node: WorkflowDomainNode, isExplicitStart = false): boolean {
  return isOpeningCode(node.code) || isExplicitStart || node.code === OPENING_STAGE_CODE;
}
