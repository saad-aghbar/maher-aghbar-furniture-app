/**
 * @deprecated Do not use for authoring commits. Prefer @maher/workflow-domain.
 * Still imported by drawers for predecessorsOf/successorsOf helpers and unit tests.
 * Inspection/sink heal helpers below are dead at runtime (return empty / domain no longer uses them).
 */
export type EdgeLike = { fromNodeId: string; toNodeId: string };

/** Incoming predecessor ids for a node. */
export function predecessorsOf(edges: EdgeLike[], nodeId: string): string[] {
  return edges.filter((e) => e.toNodeId === nodeId).map((e) => e.fromNodeId);
}

/** Outgoing successor ids for a node. */
export function successorsOf(edges: EdgeLike[], nodeId: string): string[] {
  return edges.filter((e) => e.fromNodeId === nodeId).map((e) => e.toNodeId);
}

/** True if `toId` is reachable from `fromId` following directed edges. */
export function isReachableFrom(edges: EdgeLike[], fromId: string, toId: string): boolean {
  if (fromId === toId) return true;
  const seen = new Set<string>();
  const stack = [fromId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of successorsOf(edges, cur)) {
      if (next === toId) return true;
      if (!seen.has(next)) stack.push(next);
    }
  }
  return false;
}

/**
 * True if adding edges from each p in preds → target, and from target → each s in succs,
 * would introduce a cycle in the graph.
 */
export function wouldCreateCycle(
  edges: EdgeLike[],
  targetId: string,
  preds: string[],
  succs: string[],
  /** When editing an existing node, ignore its current edges first. */
  replaceTargetIncoming = false,
): boolean {
  const filtered = replaceTargetIncoming
    ? edges.filter((e) => e.toNodeId !== targetId && e.fromNodeId !== targetId)
    : edges.filter((e) => !(e.toNodeId === targetId && preds.includes(e.fromNodeId)));

  const adj = new Map<string, string[]>();
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, []);
  };

  for (const e of filtered) {
    ensure(e.fromNodeId);
    ensure(e.toNodeId);
    adj.get(e.fromNodeId)!.push(e.toNodeId);
  }
  ensure(targetId);
  for (const p of preds) {
    ensure(p);
    adj.get(p)!.push(targetId);
  }
  for (const s of succs) {
    ensure(s);
    adj.get(targetId)!.push(s);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const id of adj.keys()) {
    if (dfs(id)) return true;
  }
  return false;
}

/**
 * After inserting `newNodeId` with predecessors `preds`, compute the new predecessor
 * list for each successor so edges become preds → new → succ (splice).
 */
export function spliceSuccessorPreds(
  edges: EdgeLike[],
  newNodeId: string,
  preds: string[],
  successorIds: string[],
): Array<{ nodeId: string; runsAfterNodeIds: string[] }> {
  const predSet = new Set(preds);
  return successorIds.map((s) => {
    const current = predecessorsOf(edges, s).filter((id) => !predSet.has(id) && id !== newNodeId);
    return { nodeId: s, runsAfterNodeIds: [...current, newNodeId] };
  });
}

/**
 * On edit: set target preds to `preds`, and make outgoing match `succs`
 * (add target as pred of each succ; remove target from former successors not in succs).
 */
export function editConnectionPatches(
  edges: EdgeLike[],
  targetId: string,
  preds: string[],
  succs: string[],
): {
  targetRunsAfter: string[];
  successorUpdates: Array<{ nodeId: string; runsAfterNodeIds: string[] }>;
} {
  const succSet = new Set(succs);
  const formerSuccs = successorsOf(edges, targetId);
  const updates: Array<{ nodeId: string; runsAfterNodeIds: string[] }> = [];

  for (const s of formerSuccs) {
    if (succSet.has(s)) continue;
    const next = predecessorsOf(edges, s).filter((id) => id !== targetId);
    updates.push({ nodeId: s, runsAfterNodeIds: next });
  }

  for (const s of succs) {
    const current = predecessorsOf(edges, s);
    if (current.includes(targetId)) continue;
    updates.push({ nodeId: s, runsAfterNodeIds: [...current, targetId] });
  }

  return { targetRunsAfter: preds, successorUpdates: updates };
}

export function resolveSortOrderForInsert(
  sortedSortOrders: Array<{ id: string; sortOrder: number }>,
  preds: string[],
  succs: string[],
): number {
  if (sortedSortOrders.length === 0) return 0;
  if (preds.length === 0 && succs.length > 0) {
    const firstSucc = sortedSortOrders.find((n) => n.id === succs[0]);
    return Math.max(0, (firstSucc?.sortOrder ?? 0) - 1);
  }
  if (preds.length > 0) {
    const maxPred = Math.max(
      ...preds.map((id) => sortedSortOrders.find((n) => n.id === id)?.sortOrder ?? 0),
    );
    return maxPred + 1;
  }
  const last = sortedSortOrders[sortedSortOrders.length - 1];
  return (last?.sortOrder ?? 0) + 1;
}

export type NodeSortLike = { id: string; sortOrder: number };

/** Nodes with outdegree 0 (finishing stages). */
export function findTerminals(edges: EdgeLike[], nodeIds: string[]): string[] {
  const outdegree = new Map(nodeIds.map((id) => [id, 0]));
  for (const e of edges) {
    if (!outdegree.has(e.fromNodeId)) continue;
    outdegree.set(e.fromNodeId, (outdegree.get(e.fromNodeId) ?? 0) + 1);
  }
  return nodeIds.filter((id) => (outdegree.get(id) ?? 0) === 0);
}

/**
 * Canonical single sink: unique terminal, or among multiple terminals the highest sortOrder.
 */
export function resolveSinkId(nodes: NodeSortLike[], edges: EdgeLike[]): string | null {
  if (nodes.length === 0) return null;
  const ids = nodes.map((n) => n.id);
  const terminals = findTerminals(edges, ids);
  const pool = terminals.length > 0 ? terminals : ids;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    [...pool].sort(
      (a, b) => (byId.get(b)?.sortOrder ?? 0) - (byId.get(a)?.sortOrder ?? 0),
    )[0] ?? null
  );
}

/**
 * Empty Leads into for production authoring:
 * - explicit leadsInto wins
 * - otherwise insertBeforeNodeId (Inspection) when provided
 * - never auto-wire to Delivery / Packaging sink
 */
export function resolveLeadsIntoForSave(args: {
  nodes: NodeSortLike[];
  edges: EdgeLike[];
  targetId: string;
  runsAfterIds: string[];
  leadsIntoIds: string[];
  insertBeforeNodeId?: string | null;
}): string[] {
  const { targetId, runsAfterIds, leadsIntoIds, insertBeforeNodeId } = args;
  if (leadsIntoIds.length > 0) return [...leadsIntoIds];

  if (insertBeforeNodeId && insertBeforeNodeId !== targetId && !runsAfterIds.includes(insertBeforeNodeId)) {
    return [insertBeforeNodeId];
  }

  return [];
}

/**
 * Wire production dead-ends into Inspection (never Packaging/Delivery).
 */
/**
 * Drop Packaging / Delivery / Inspection from a predecessor list before PATCHing Inspection.
 */
export function sanitizeInspectionPredecessorIds(
  predIds: string[],
  codeForId: (id: string) => string,
): string[] {
  return predIds.filter((id) => {
    const code = codeForId(id);
    return code !== 'PACKAGING' && code !== 'DELIVERY' && code !== 'INSPECTION';
  });
}

/**
 * @deprecated Dead at runtime. Inspection preds come from @maher/workflow-domain frontier REPLACE.
 */
export function ensureInspectionFeedPatches(
  _nodes: Array<NodeSortLike & { stageCode?: string }>,
  _edges: EdgeLike[],
  _inspectionId: string,
  _skipDeadEndCodes: ReadonlySet<string> = new Set(['PACKAGING', 'DELIVERY', 'INSPECTION']),
): Array<{ nodeId: string; runsAfterNodeIds: string[] }> {
  return [];
}

export function ensureSingleSinkPatches(
  nodes: NodeSortLike[],
  edges: EdgeLike[],
  sinkId: string,
): Array<{ nodeId: string; runsAfterNodeIds: string[] }> {
  const ids = nodes.map((n) => n.id);
  if (!ids.includes(sinkId)) return [];

  const deadEnds = findTerminals(edges, ids).filter((id) => id !== sinkId);
  if (deadEnds.length === 0) return [];

  const currentPreds = predecessorsOf(edges, sinkId);
  const nextPreds = [...currentPreds];
  for (const d of deadEnds) {
    if (!nextPreds.includes(d)) nextPreds.push(d);
  }
  if (nextPreds.length === currentPreds.length) return [];
  return [{ nodeId: sinkId, runsAfterNodeIds: nextPreds }];
}

export function validRunsAfterCandidates(
  nodes: NodeSortLike[],
  edges: EdgeLike[],
  targetId: string,
  runsAfterIds: string[],
  leadsIntoIds: string[],
  replaceTarget = false,
  excludeNodeIds?: ReadonlySet<string>,
): string[] {
  const selected = new Set(runsAfterIds);
  const leadSet = new Set(leadsIntoIds);
  const sinkId = resolveSinkId(nodes, edges);

  return nodes
    .map((n) => n.id)
    .filter((id) => id !== targetId)
    .filter((id) => !excludeNodeIds?.has(id))
    .filter((id) => {
      if (selected.has(id)) return true;
      if (leadSet.has(id) && id !== sinkId) return false;

      const trialRunsAfter = [...runsAfterIds, id];
      const trialLeadsInto = resolveLeadsIntoForSave({
        nodes,
        edges,
        targetId,
        runsAfterIds: trialRunsAfter,
        leadsIntoIds: id === sinkId ? [] : leadsIntoIds.filter((x) => x !== id),
      });
      return !wouldCreateCycle(edges, targetId, trialRunsAfter, trialLeadsInto, replaceTarget);
    });
}

export function validLeadsIntoCandidates(
  nodes: NodeSortLike[],
  edges: EdgeLike[],
  targetId: string,
  runsAfterIds: string[],
  leadsIntoIds: string[],
  replaceTarget = false,
  excludeNodeIds?: ReadonlySet<string>,
): string[] {
  const predSet = new Set(runsAfterIds);
  const selected = new Set(leadsIntoIds);

  return nodes
    .map((n) => n.id)
    .filter((id) => id !== targetId && !predSet.has(id))
    .filter((id) => !excludeNodeIds?.has(id))
    .filter((id) => {
      if (selected.has(id)) return true;
      return !wouldCreateCycle(edges, targetId, runsAfterIds, [...leadsIntoIds, id], replaceTarget);
    });
}
