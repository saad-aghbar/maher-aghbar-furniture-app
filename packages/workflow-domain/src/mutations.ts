import { canonicalizeWorkflowGraph } from './canonicalize';
import {
  deriveSuccMap,
  edgesFromPredMap,
  isOpeningCode,
  isProductionCode,
  isReachable,
  sortedUnique,
} from './graph';
import { filterStartSuccessorIds, isMiddleProductionCode } from './successors';
import type {
  CanonicalWorkflowGraph,
  PlacementIntent,
  WorkflowDomainEdge,
  WorkflowDomainNode,
  WorkflowMutation,
} from './types';

function clonePredMap(
  predecessorsByNode: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(predecessorsByNode)) {
    out[k] = [...v];
  }
  return out;
}

function productionSuccessors(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
): string[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return (graph.successorsByNode[nodeId] ?? []).filter((s) => {
    const code = byId.get(s)?.code ?? '';
    return isProductionCode(code);
  });
}

function materialPrepId(nodes: WorkflowDomainNode[]): string | null {
  return nodes.find((n) => isOpeningCode(n.code))?.id ?? null;
}

/**
 * Start stages must enter the production chain at the same hop Material Prep uses —
 * never skip straight to Inspection while Prep already feeds middle stages.
 */
function wireStartIntoAfterPrep(
  preds: Record<string, string[]>,
  nodes: WorkflowDomainNode[],
  startNodeId: string,
): void {
  const prepId = materialPrepId(nodes);
  if (!prepId || prepId === startNodeId) return;

  const nodeIds = nodes.map((n) => n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  let succ = deriveSuccMap(nodeIds, preds);
  const afterPrep = (succ[prepId] ?? []).filter((id) => {
    if (id === startNodeId) return false;
    return isProductionCode(byId.get(id)?.code ?? '');
  });
  if (afterPrep.length === 0) return;

  for (const target of afterPrep) {
    succ = deriveSuccMap(nodeIds, preds);
    if (isReachable(succ, startNodeId, target)) continue;
    if (isReachable(succ, target, startNodeId)) continue;
    preds[target] = sortedUnique([...(preds[target] ?? []), startNodeId]);
  }
}

/**
 * REMOVE X from a pred map (production splice). Does not touch Packaging/Delivery preds
 * except via later canonicalize.
 */
export function spliceRemoveNode(
  predecessorsByNode: Record<string, string[]>,
  nodes: WorkflowDomainNode[],
  nodeId: string,
): Record<string, string[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const preds = clonePredMap(predecessorsByNode);
  const P = sortedUnique(preds[nodeId] ?? []);
  const succ = deriveSuccMap(
    nodes.map((n) => n.id),
    preds,
  );
  const S = (succ[nodeId] ?? []).filter((s) => {
    const code = byId.get(s)?.code ?? '';
    // Splice into production successors; Inspection handled by canonicalize frontier
    return isProductionCode(code);
  });

  for (const s of S) {
    const without = (preds[s] ?? []).filter((id) => id !== nodeId);
    preds[s] = sortedUnique([...without, ...P]);
  }

  delete preds[nodeId];
  for (const id of Object.keys(preds)) {
    preds[id] = sortedUnique((preds[id] ?? []).filter((p) => p !== nodeId));
  }
  return preds;
}

function resolvePlacementPreds(
  graph: CanonicalWorkflowGraph,
  placement: PlacementIntent,
): string[] {
  if (placement.kind === 'START') return [];
  if (placement.kind === 'AFTER') {
    return sortedUnique(placement.predecessorIds);
  }
  // PARALLEL: copy preds of first reference (or union if all share same — use first's set;
  // if multiple refs, they should share the same pred set; take first)
  const refs = placement.referenceNodeIds;
  if (refs.length === 0) return [];
  const first = refs[0]!;
  return sortedUnique(graph.predecessorsByNode[first] ?? []);
}

function graphFromPreds(
  nodes: WorkflowDomainNode[],
  predecessorsByNode: Record<string, string[]>,
): CanonicalWorkflowGraph {
  const edges = edgesFromPredMap(predecessorsByNode);
  return canonicalizeWorkflowGraph({ nodes, edges });
}

function hasProductionOut(
  preds: Record<string, string[]>,
  nodeId: string,
): boolean {
  return Object.values(preds).some((ps) => ps.includes(nodeId));
}

/** Attach `nodeId` as a predecessor of each chosen middle-production successor. */
function wireExplicitSuccessors(
  preds: Record<string, string[]>,
  nodes: WorkflowDomainNode[],
  nodeId: string,
  successorIds: string[],
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = nodes.map((n) => n.id);
  for (const s of sortedUnique(successorIds)) {
    if (s === nodeId || !byId.has(s)) continue;
    if (!isMiddleProductionCode(byId.get(s)?.code ?? '')) continue;
    const succ = deriveSuccMap(nodeIds, preds);
    if (isReachable(succ, s, nodeId)) continue;
    preds[s] = sortedUnique([...(preds[s] ?? []), nodeId]);
  }
}

/**
 * Sole mutation engine for preview and save.
 */
export function simulateWorkflowMutation(
  graph: CanonicalWorkflowGraph,
  mutation: WorkflowMutation,
): CanonicalWorkflowGraph {
  if (mutation.kind === 'REMOVE') {
    return simulateRemove(graph, mutation.nodeId);
  }
  if (mutation.kind === 'ADD') {
    return simulateAdd(graph, mutation);
  }
  return simulateEditPlacement(graph, mutation.nodeId, mutation.placement);
}

function simulateRemove(graph: CanonicalWorkflowGraph, nodeId: string): CanonicalWorkflowGraph {
  const nodes = graph.nodes.filter((n) => n.id !== nodeId);
  const preds = spliceRemoveNode(graph.predecessorsByNode, graph.nodes, nodeId);
  // Drop removed from all
  const cleaned: Record<string, string[]> = {};
  for (const n of nodes) {
    cleaned[n.id] = sortedUnique((preds[n.id] ?? []).filter((p) => p !== nodeId));
  }
  reattachAccidentalOrphans(cleaned, nodes, new Set());
  return graphFromPreds(nodes, cleaned);
}

function simulateAdd(
  graph: CanonicalWorkflowGraph,
  mutation: Extract<WorkflowMutation, { kind: 'ADD' }>,
): CanonicalWorkflowGraph {
  const maxSort = Math.max(0, ...graph.nodes.map((n) => n.sortOrder));
  const newNode: WorkflowDomainNode = {
    id: mutation.nodeId,
    code: mutation.code,
    sortOrder: mutation.sortOrder ?? maxSort + 1,
  };
  const nodes = [...graph.nodes, newNode];
  const preds = clonePredMap(graph.predecessorsByNode);
  preds[mutation.nodeId] = resolvePlacementPreds(graph, mutation.placement);
  for (const n of nodes) {
    if (!preds[n.id]) preds[n.id] = [];
  }
  const explicitSuccs = mutation.placement.successorIds;
  if (explicitSuccs && explicitSuccs.length > 0) {
    const allowed =
      mutation.placement.kind === 'START'
        ? filterStartSuccessorIds(graph, explicitSuccs)
        : explicitSuccs;
    if (allowed.length > 0) {
      wireExplicitSuccessors(preds, nodes, mutation.nodeId, allowed);
    } else if (mutation.placement.kind === 'START') {
      wireStartIntoAfterPrep(preds, nodes, mutation.nodeId);
    }
  } else if (mutation.placement.kind === 'START') {
    wireStartIntoAfterPrep(preds, nodes, mutation.nodeId);
  }
  reattachAccidentalOrphans(preds, nodes, new Set([mutation.nodeId]));
  return graphFromPreds(nodes, preds);
}

/**
 * EDIT = remove-splice + reinsert + restore downstream continuity.
 *
 * After temporary remove, former production successors inherit oldPreds.
 * On reinsert, for each former successor S: replace oldPreds contribution with X
 * (i.e. remove members of oldPreds that were added by splice, add X), while keeping
 * other shared predecessors.
 */
function simulateEditPlacement(
  graph: CanonicalWorkflowGraph,
  nodeId: string,
  placement: PlacementIntent,
): CanonicalWorkflowGraph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;

  const oldPreds = sortedUnique(graph.predecessorsByNode[nodeId] ?? []);
  const oldSuccs = productionSuccessors(graph, nodeId);
  const oldPredSet = new Set(oldPreds);

  // Temporary remove
  let preds = spliceRemoveNode(graph.predecessorsByNode, graph.nodes, nodeId);
  const nodesWithout = graph.nodes.filter((n) => n.id !== nodeId);
  // Ensure keys
  const cleaned: Record<string, string[]> = {};
  for (const n of nodesWithout) {
    cleaned[n.id] = sortedUnique((preds[n.id] ?? []).filter((p) => p !== nodeId));
  }

  // Reinsert with new placement
  const newPreds = resolvePlacementPreds(
    // Use temporary graph for PARALLEL reference lookup — refs still in cleaned
    canonicalizeWorkflowGraph({
      nodes: nodesWithout,
      edges: edgesFromPredMap(cleaned),
    }),
    placement,
  );

  // For PARALLEL/AFTER, resolve against original graph when refs include nodeId's siblings
  const placementPreds =
    placement.kind === 'PARALLEL'
      ? resolvePlacementPreds(graph, placement)
      : placement.kind === 'AFTER'
        ? sortedUnique(placement.predecessorIds.filter((id) => id !== nodeId))
        : [];

  cleaned[nodeId] = placement.kind === 'START' ? [] : placementPreds.length ? placementPreds : newPreds;

  const nodes = [...nodesWithout, node];
  const explicitSuccs = placement.successorIds;

  if (explicitSuccs !== undefined) {
    // Caller chose outbound stages (or cleared them to the default Inspection path).
    if (explicitSuccs.length > 0) {
      const allowed =
        placement.kind === 'START'
          ? filterStartSuccessorIds(graph, explicitSuccs)
          : explicitSuccs;
      if (allowed.length > 0) {
        wireExplicitSuccessors(cleaned, nodes, nodeId, allowed);
      }
    }
  } else {
    // Restore downstream: for each former succ S, replace oldPreds inheritance with X
    for (const s of oldSuccs) {
      const current = cleaned[s] ?? [];
      const withoutOldPreds = current.filter((p) => !oldPredSet.has(p));
      cleaned[s] = sortedUnique([...withoutOldPreds, nodeId]);
    }
  }

  // Start with no production outs would otherwise become Inspection-only and skip
  // the chain after Material Prep — wire into Prep's production successors instead.
  if (placement.kind === 'START') {
    if (!hasProductionOut(cleaned, nodeId)) {
      wireStartIntoAfterPrep(cleaned, nodes, nodeId);
    }
  }

  // Never leave other middle stages floating after an edit.
  const allowedRoots = new Set<string>([nodeId]);
  if (placement.kind === 'START' || placement.kind === 'PARALLEL') {
    allowedRoots.add(nodeId);
  }
  reattachAccidentalOrphans(cleaned, nodes, allowedRoots);

  return graphFromPreds(nodes, cleaned);
}

/**
 * Middle stages that lost every predecessor (not intentional Start roots) attach After Material Prep.
 */
function reattachAccidentalOrphans(
  preds: Record<string, string[]>,
  nodes: WorkflowDomainNode[],
  allowedEmptyRootIds: ReadonlySet<string>,
): void {
  const prepId = materialPrepId(nodes);
  if (!prepId) return;
  for (const n of nodes) {
    if (!isProductionCode(n.code)) continue;
    if (isOpeningCode(n.code)) continue;
    if (allowedEmptyRootIds.has(n.id)) continue;
    if ((preds[n.id] ?? []).length > 0) continue;
    preds[n.id] = [prepId];
  }
}

/** Build a working graph from raw nodes/edges (canonicalize once). */
export function fromRawGraph(
  nodes: WorkflowDomainNode[],
  edges: WorkflowDomainEdge[],
): CanonicalWorkflowGraph {
  return canonicalizeWorkflowGraph({ nodes, edges });
}

export function applyPatchesToPredMap(
  predecessorsByNode: Record<string, string[]>,
  patches: Array<{ nodeId: string; runsAfterNodeIds: string[] }>,
): Record<string, string[]> {
  const next = clonePredMap(predecessorsByNode);
  for (const p of patches) {
    next[p.nodeId] = sortedUnique(p.runsAfterNodeIds);
  }
  return next;
}
