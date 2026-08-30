import { deriveSuccMap, sortedUnique } from './graph';

/**
 * Mathematical transitive reduction on a predecessor map.
 * Drops pred P of T when another pred Q is reachable from P (or more generally
 * when T remains reachable from P without the direct edge P→T).
 */
export function transitiveReducePredMap(
  nodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const id of nodeIds) {
    next[id] = [...(predecessorsByNode[id] ?? [])];
  }

  // Work on a copy of edges as adj for reachability without a candidate edge.
  for (const to of [...nodeIds].sort()) {
    const preds = sortedUnique(next[to] ?? []);
    if (preds.length < 2) {
      next[to] = preds;
      continue;
    }
    const kept: string[] = [];
    for (const from of preds) {
      // Build succ map without this direct edge
      const trial: Record<string, string[]> = {};
      for (const id of nodeIds) trial[id] = [];
      for (const [t, ps] of Object.entries(next)) {
        for (const p of ps) {
          if (t === to && p === from) continue;
          trial[p] = trial[p] ?? [];
          trial[p]!.push(t);
        }
      }
      for (const id of Object.keys(trial)) trial[id] = sortedUnique(trial[id]!);

      if (isReachableLocal(trial, from, to)) {
        // redundant
        continue;
      }
      kept.push(from);
    }
    next[to] = sortedUnique(kept);
  }
  return next;
}

function isReachableLocal(
  successorsByNode: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of successorsByNode[cur] ?? []) {
      if (n === to) return true;
      if (!seen.has(n)) stack.push(n);
    }
  }
  return false;
}

/** Reduce only among production nodes; terminal preds handled separately. */
export function transitiveReduceProduction(
  productionIds: string[],
  predecessorsByNode: Record<string, string[]>,
): Record<string, string[]> {
  const prodSet = new Set(productionIds);
  const prodPreds: Record<string, string[]> = {};
  for (const id of productionIds) {
    prodPreds[id] = (predecessorsByNode[id] ?? []).filter((p) => prodSet.has(p));
  }
  const reduced = transitiveReducePredMap(productionIds, prodPreds);
  const out: Record<string, string[]> = { ...predecessorsByNode };
  for (const id of productionIds) {
    // Keep any non-production preds (shouldn't exist for production nodes) + reduced
    const nonProd = (predecessorsByNode[id] ?? []).filter((p) => !prodSet.has(p));
    out[id] = sortedUnique([...nonProd, ...(reduced[id] ?? [])]);
  }
  return out;
}

export { deriveSuccMap };
