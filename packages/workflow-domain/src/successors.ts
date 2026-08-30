import {
  deriveSuccMap,
  isOpeningCode,
  isProductionCode,
  isReachable,
  sortedUnique,
} from './graph';
import type { CanonicalWorkflowGraph, PlacementIntent } from './types';

export function isMiddleProductionCode(code: string): boolean {
  return isProductionCode(code) && !isOpeningCode(code);
}

/** Production stages this node currently feeds (not Inspection / Packaging / Delivery / Prep). */
export function productionSuccessorIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
): string[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return (graph.successorsByNode[nodeId] ?? []).filter((s) =>
    isMiddleProductionCode(byId.get(s)?.code ?? ''),
  );
}

/**
 * Material Prep's current middle-production successors — the only hop a Start
 * stage may join (same set wireStartIntoAfterPrep uses).
 */
export function materialPrepSuccessorIds(graph: CanonicalWorkflowGraph): string[] {
  const prepId = graph.nodes.find((n) => isOpeningCode(n.code))?.id ?? null;
  if (!prepId) return [];
  return productionSuccessorIds(graph, prepId);
}

/**
 * Stages `nodeId` may legally feed after sitting behind `predecessorIds`.
 * Empty picker = keep the usual inferred path (frontier → Inspection).
 *
 * For Start placements, pass `restrictToIds` = Material Prep's production
 * successors so Start cannot skip ahead into later stages.
 */
export function validSuccessorCandidateIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  predecessorIds: string[],
  opts?: {
    /** When set, only these ids are eligible (e.g. Prep's next hop for Start). */
    restrictToIds?: readonly string[];
    /** Always excluded (e.g. parallel siblings). */
    excludeIds?: readonly string[];
  },
): string[] {
  const predSet = new Set(predecessorIds.filter((id) => id !== nodeId));
  const exclude = new Set(opts?.excludeIds ?? []);
  const restrict =
    opts?.restrictToIds != null ? new Set(opts.restrictToIds) : null;
  const known = graph.nodes.some((n) => n.id === nodeId);
  const nodeIds = known ? graph.nodes.map((n) => n.id) : [...graph.nodes.map((n) => n.id), nodeId];
  const preds: Record<string, string[]> = {};
  for (const id of nodeIds) {
    if (id === nodeId) {
      preds[id] = sortedUnique([...predSet]);
      continue;
    }
    preds[id] = sortedUnique((graph.predecessorsByNode[id] ?? []).filter((p) => p !== nodeId));
  }
  const succ = deriveSuccMap(nodeIds, preds);

  return graph.nodes
    .filter((n) => n.id !== nodeId && isMiddleProductionCode(n.code))
    .map((n) => n.id)
    .filter((id) => !predSet.has(id))
    .filter((id) => !exclude.has(id))
    .filter((id) => (restrict ? restrict.has(id) : true))
    .filter((id) => !isReachable(succ, id, nodeId));
}

/** Filter chosen Start successor ids down to Prep's production hop. */
export function filterStartSuccessorIds(
  graph: CanonicalWorkflowGraph,
  successorIds: readonly string[],
): string[] {
  const allow = new Set(materialPrepSuccessorIds(graph));
  return sortedUnique(successorIds.filter((id) => allow.has(id)));
}

export function withSuccessorIds(
  placement: PlacementIntent,
  successorIds: string[],
): PlacementIntent {
  if (successorIds.length === 0) {
    const { successorIds: _drop, ...rest } = placement;
    return rest;
  }
  return { ...placement, successorIds };
}
