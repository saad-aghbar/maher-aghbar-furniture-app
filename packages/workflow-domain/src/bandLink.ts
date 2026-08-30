import { canonicalizeWorkflowGraph } from './canonicalize';
import { edgesFromPredMap, isProductionCode, sortedUnique } from './graph';
import type { CanonicalWorkflowGraph, ParallelBand } from './types';

export type ParallelBandLinkMode = 'together' | 'lanes';

export type ParallelBandLink = {
  fromBand: ParallelBand;
  toBand: ParallelBand;
  /** Current wiring between the bands. */
  mode: ParallelBandLinkMode | 'mixed';
};

function predKey(ids: string[]): string {
  return sortedUnique(ids).join(',');
}

function sortByGraphOrder(graph: CanonicalWorkflowGraph, ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ao = graph.nodes.find((n) => n.id === a)?.sortOrder ?? 0;
    const bo = graph.nodes.find((n) => n.id === b)?.sortOrder ?? 0;
    return ao - bo || (a < b ? -1 : a > b ? 1 : 0);
  });
}

function makeBand(nodeIds: string[], predecessorIds: string[]): ParallelBand {
  const ids = sortedUnique(nodeIds);
  const preds = sortedUnique(predecessorIds);
  return {
    id: `band:${predKey(preds) || 'root'}:${ids.join('+')}`,
    nodeIds: ids,
    predecessorIds: preds,
  };
}

/**
 * Detect parallel-band → parallel-band links (candidates for Together vs lanes).
 * Includes mixed/spaghetti wiring so authors can fix it with an explicit choice.
 */
export function detectParallelBandLinks(graph: CanonicalWorkflowGraph): ParallelBandLink[] {
  const bands = graph.parallelBands;
  if (bands.length < 1) return [];

  const links: ParallelBandLink[] = [];
  const seen = new Set<string>();

  const push = (fromBand: ParallelBand, toBand: ParallelBand) => {
    if (fromBand.id === toBand.id) return;
    if (fromBand.nodeIds.length < 2 || toBand.nodeIds.length < 2) return;
    const key = `${sortedUnique(fromBand.nodeIds).join(',')}->${sortedUnique(toBand.nodeIds).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      fromBand,
      toBand,
      mode: resolveBandLinkMode(graph, fromBand.nodeIds, toBand.nodeIds),
    });
  };

  // 1) Formal bands: toBand already shares identical preds
  for (const toBand of bands) {
    const sharedPredKey = predKey(toBand.predecessorIds);
    if (sharedPredKey) {
      const fromTogether = bands.find((b) => predKey(b.nodeIds) === sharedPredKey);
      if (fromTogether) {
        push(fromTogether, toBand);
        continue;
      }
    }

    const feederCounts = new Map<string, number>();
    for (const tid of toBand.nodeIds) {
      for (const pid of graph.predecessorsByNode[tid] ?? []) {
        const fromBand = bands.find((b) => b.nodeIds.includes(pid));
        if (!fromBand) continue;
        feederCounts.set(fromBand.id, (feederCounts.get(fromBand.id) ?? 0) + 1);
      }
    }
    let bestId: string | null = null;
    let bestCount = 0;
    for (const [id, count] of feederCounts) {
      if (count > bestCount) {
        bestId = id;
        bestCount = count;
      }
    }
    if (bestId && bestCount > 0) {
      const fromBand = bands.find((b) => b.id === bestId);
      if (fromBand) push(fromBand, toBand);
    }
  }

  // 2) Soft candidates: ≥2 production nodes fed by a prior band (even if preds differ)
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const fromBand of bands) {
    const fromSet = new Set(fromBand.nodeIds);
    const fed = new Set<string>();
    for (const fid of fromBand.nodeIds) {
      for (const sid of graph.successorsByNode[fid] ?? []) {
        const code = byId.get(sid)?.code ?? '';
        if (!isProductionCode(code)) continue;
        if (fromSet.has(sid)) continue;
        // Must have at least one pred in fromBand
        const preds = graph.predecessorsByNode[sid] ?? [];
        if (!preds.some((p) => fromSet.has(p))) continue;
        fed.add(sid);
      }
    }
    if (fed.size < 2) continue;
    // Prefer an existing formal band that covers these nodes
    const existing = bands.find((b) => b.nodeIds.every((id) => fed.has(id)) && b.nodeIds.length >= 2);
    const toIds = existing ? existing.nodeIds : [...fed];
    if (toIds.length < 2) continue;
    // Shared preds among toIds (may be empty/mixed)
    const firstPreds = graph.predecessorsByNode[toIds[0]!] ?? [];
    const shared = firstPreds.filter((p) =>
      toIds.every((tid) => (graph.predecessorsByNode[tid] ?? []).includes(p)),
    );
    push(fromBand, existing ?? makeBand(toIds, shared));
  }

  return links;
}

/**
 * Rewire toBand after fromBand as either:
 * - together: every to-node waits for every from-node (Together hub)
 * - lanes: 1:1 by sort order (independent lines, no Together)
 */
export function applyParallelBandLink(
  graph: CanonicalWorkflowGraph,
  args: {
    fromBandNodeIds: string[];
    toBandNodeIds: string[];
    mode: ParallelBandLinkMode;
  },
): CanonicalWorkflowGraph {
  const fromIds = sortedUnique(args.fromBandNodeIds);
  const toIds = sortedUnique(args.toBandNodeIds);
  if (fromIds.length < 2 || toIds.length < 2) return graph;

  const preds: Record<string, string[]> = {};
  for (const n of graph.nodes) {
    preds[n.id] = [...(graph.predecessorsByNode[n.id] ?? [])];
  }

  if (args.mode === 'together') {
    for (const tid of toIds) {
      preds[tid] = [...fromIds];
    }
  } else {
    const fromSorted = sortByGraphOrder(graph, fromIds);
    const toSorted = sortByGraphOrder(graph, toIds);
    for (let i = 0; i < toSorted.length; i += 1) {
      const tid = toSorted[i]!;
      const fid = fromSorted[Math.min(i, fromSorted.length - 1)]!;
      preds[tid] = [fid];
    }
  }

  return canonicalizeWorkflowGraph({
    nodes: graph.nodes,
    edges: edgesFromPredMap(preds),
  });
}

export function resolveBandLinkMode(
  graph: CanonicalWorkflowGraph,
  fromBandNodeIds: string[],
  toBandNodeIds: string[],
): ParallelBandLinkMode | 'mixed' {
  const fromKey = predKey(fromBandNodeIds);
  let together = true;
  let lanes = true;
  const fromSet = new Set(fromBandNodeIds);
  const fromSorted = sortByGraphOrder(graph, fromBandNodeIds);
  const toSorted = sortByGraphOrder(graph, toBandNodeIds);

  for (let i = 0; i < toSorted.length; i += 1) {
    const tid = toSorted[i]!;
    const p = sortedUnique(graph.predecessorsByNode[tid] ?? []);
    if (predKey(p) !== fromKey) together = false;
    const expected = fromSorted[Math.min(i, fromSorted.length - 1)];
    if (p.length !== 1 || p[0] !== expected || !fromSet.has(p[0]!)) lanes = false;
  }
  if (together) return 'together';
  if (lanes) return 'lanes';
  return 'mixed';
}
