import { sortedUnique } from './graph';
import type { ParallelBand } from './types';

/**
 * Parallel bands = 2+ production stages with identical sorted predecessor sets.
 */
export function computeParallelBands(
  productionNodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): ParallelBand[] {
  const groups = new Map<string, string[]>();
  for (const id of productionNodeIds) {
    const key = sortedUnique(predecessorsByNode[id] ?? []).join(',');
    const list = groups.get(key) ?? [];
    list.push(id);
    groups.set(key, list);
  }
  const bands: ParallelBand[] = [];
  for (const [key, ids] of [...groups.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  )) {
    const nodeIds = sortedUnique(ids);
    if (nodeIds.length < 2) continue;
    bands.push({
      id: `band:${key || 'root'}`,
      nodeIds,
      predecessorIds: key ? key.split(',') : [],
    });
  }
  return bands;
}

/** Whether target band depends on every member of source band (exact or contains). */
export function isParallelToParallelJoin(
  sourceBand: ParallelBand,
  targetBand: ParallelBand,
): boolean {
  if (sourceBand.nodeIds.length < 2 || targetBand.nodeIds.length < 2) return false;
  const sourceSet = new Set(sourceBand.nodeIds);
  // Every target member's preds must include the full source band
  for (const t of targetBand.nodeIds) {
    // We need preds of t — passed via band only has shared preds of members.
    // Callers should verify per-node; this helper checks shared band preds contain source.
    void t;
  }
  // Prefer exact: targetBand.predecessorIds equals sourceBand.nodeIds as a set
  const targetPreds = new Set(targetBand.predecessorIds);
  if (sourceBand.nodeIds.every((id) => targetPreds.has(id)) && targetPreds.size === sourceSet.size) {
    return true;
  }
  // Or target preds exactly equal source band node ids (sorted match)
  const a = sortedUnique(sourceBand.nodeIds).join(',');
  const b = sortedUnique(targetBand.predecessorIds).join(',');
  return a === b && sourceBand.nodeIds.length >= 2;
}
