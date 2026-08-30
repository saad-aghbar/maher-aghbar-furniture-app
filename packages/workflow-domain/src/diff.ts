import { sortedUnique } from './graph';
import type { CanonicalWorkflowGraph, PredecessorPatch } from './types';

/**
 * Minimal predecessor-set patches. Skips Packaging/Delivery unless changed
 * (canonicalizer normally keeps them stable).
 */
export function diffPredecessorSets(
  oldGraph: CanonicalWorkflowGraph,
  newGraph: CanonicalWorkflowGraph,
): PredecessorPatch[] {
  const patches: PredecessorPatch[] = [];
  const allIds = sortedUnique([
    ...oldGraph.nodes.map((n) => n.id),
    ...newGraph.nodes.map((n) => n.id),
  ]);
  const oldById = new Map(oldGraph.nodes.map((n) => [n.id, n]));
  const newById = new Map(newGraph.nodes.map((n) => [n.id, n]));

  for (const id of allIds) {
    if (!newById.has(id)) continue; // removed — handled by DELETE API
    const code = newById.get(id)?.code ?? '';
    if (code === 'PACKAGING' || code === 'DELIVERY') {
      // Only patch if broken vs canonical expectation
      const oldP = sortedUnique(oldGraph.predecessorsByNode[id] ?? []).join(',');
      const newP = sortedUnique(newGraph.predecessorsByNode[id] ?? []).join(',');
      if (oldP === newP) continue;
    }
    const oldP = sortedUnique(oldGraph.predecessorsByNode[id] ?? []);
    const newP = sortedUnique(newGraph.predecessorsByNode[id] ?? []);
    if (oldP.join(',') === newP.join(',')) continue;
    // New node not in old: still emit so add can set preds
    if (!oldById.has(id) || oldP.join(',') !== newP.join(',')) {
      patches.push({ nodeId: id, runsAfterNodeIds: newP });
    }
  }

  return patches.sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
}
