import {
  deriveSuccMap,
  isOpeningCode,
  isReachable,
  sortedUnique,
} from './graph';
import { isMiddleProductionCode } from './successors';
import type { CanonicalWorkflowGraph } from './types';

function predKey(ids: readonly string[]): string {
  return sortedUnique([...ids]).join(',');
}

/** Full graph successor map; for a brand-new node, include it with no edges. */
function reachabilitySuccMap(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
): Record<string, string[]> {
  if (graph.nodes.some((n) => n.id === nodeId)) {
    return graph.successorsByNode;
  }
  const nodeIds = [...graph.nodes.map((n) => n.id), nodeId];
  const preds: Record<string, string[]> = {};
  for (const n of graph.nodes) {
    preds[n.id] = [...(graph.predecessorsByNode[n.id] ?? [])];
  }
  preds[nodeId] = [];
  return deriveSuccMap(nodeIds, preds);
}

/**
 * Stages this node may sit After.
 * Pool = Material Prep + middle production. Selected ids stay visible.
 * Excludes terminals, leads-into picks (except Inspection sink), descendants
 * of the target (would cycle), and ancestors/descendants of already-selected
 * After picks (no mixing chain levels — foam+paint). Parallel siblings
 * (foam+upholstery) remain allowed together.
 */
export function validPredecessorCandidateIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  selectedPredIds: readonly string[],
  opts?: {
    /** Mutual exclusion with leads-to (Inspection may stay in both as sink). */
    leadsIntoIds?: readonly string[];
    excludeIds?: readonly string[];
  },
): string[] {
  const selected = new Set(selectedPredIds);
  const exclude = new Set(opts?.excludeIds ?? []);
  const leadSet = new Set(opts?.leadsIntoIds ?? []);
  const inspectionId = graph.inspectionNodeId;
  const succ = reachabilitySuccMap(graph, nodeId);

  return graph.nodes
    .filter((n) => {
      if (n.id === nodeId) return false;
      if (isOpeningCode(n.code)) return true;
      return isMiddleProductionCode(n.code);
    })
    .map((n) => n.id)
    .filter((id) => !exclude.has(id))
    .filter((id) => {
      if (selected.has(id)) return true;
      if (leadSet.has(id) && id !== inspectionId) return false;
      // Sitting After a descendant of the target creates a cycle
      if (isReachable(succ, nodeId, id)) return false;
      // Don't mix upstream/downstream stages as simultaneous After targets
      for (const sel of selectedPredIds) {
        if (sel === id) continue;
        if (isReachable(succ, sel, id) || isReachable(succ, id, sel)) return false;
      }
      return true;
    });
}

/**
 * Stages this node may run Parallel with.
 * No ancestor/descendant of the target. Once a ref is selected, further picks
 * must share that exact predecessor set (true same-hop siblings).
 * Selected ids stay visible so they can be cleared.
 */
export function validParallelReferenceCandidateIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  selectedRefIds: readonly string[],
  opts?: {
    excludeIds?: readonly string[];
  },
): string[] {
  const selected = new Set(selectedRefIds);
  const exclude = new Set(opts?.excludeIds ?? []);
  const succ = reachabilitySuccMap(graph, nodeId);

  const anchorId = selectedRefIds[0];
  const requiredPredKey =
    anchorId != null
      ? predKey(graph.predecessorsByNode[anchorId] ?? [])
      : null;

  return graph.nodes
    .filter((n) => n.id !== nodeId && isMiddleProductionCode(n.code))
    .map((n) => n.id)
    .filter((id) => !exclude.has(id))
    .filter((id) => {
      if (selected.has(id)) return true;
      if (isReachable(succ, nodeId, id)) return false;
      if (isReachable(succ, id, nodeId)) return false;
      if (requiredPredKey != null) {
        const key = predKey(graph.predecessorsByNode[id] ?? []);
        if (key !== requiredPredKey) return false;
      }
      return true;
    });
}

/**
 * Clamp a Parallel multi-select to one hop: keep first valid ref, drop anything
 * that does not share its predecessor set.
 */
export function clampParallelReferenceIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  selectedRefIds: readonly string[],
): string[] {
  if (selectedRefIds.length === 0) return [];
  const strictEmpty = new Set(validParallelReferenceCandidateIds(graph, nodeId, []));
  const first = selectedRefIds.find((id) => strictEmpty.has(id));
  if (first == null) return [];
  const allow = new Set(validParallelReferenceCandidateIds(graph, nodeId, [first]));
  return selectedRefIds.filter((id) => id === first || allow.has(id));
}

/**
 * Clamp After multi-select so picks stay mutually non-chained.
 */
export function clampPredecessorIds(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  selectedPredIds: readonly string[],
  opts?: {
    leadsIntoIds?: readonly string[];
    excludeIds?: readonly string[];
  },
): string[] {
  const out: string[] = [];
  for (const id of selectedPredIds) {
    const allow = new Set(
      validPredecessorCandidateIds(graph, nodeId, out, opts),
    );
    if (allow.has(id)) out.push(id);
  }
  return out;
}
