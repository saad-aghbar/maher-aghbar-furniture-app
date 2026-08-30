import {
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
  isLockedAnchorStageCode,
  isOpeningStageCode,
  isTerminalStageCode,
  type TerminalStageCode,
} from '@maher/types';
import type { WorkflowNode } from '@/api/modules/workflow';
import { predecessorsOf, successorsOf, isReachableFrom, type EdgeLike } from './rewireWorkflowEdges';

export {
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
  isLockedAnchorStageCode,
  isOpeningStageCode,
  isTerminalStageCode,
  type TerminalStageCode,
};

export function isTerminalNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  const code = node.stageDefinition?.code;
  return code ? isTerminalStageCode(code) : false;
}

export function isOpeningNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  const code = node.stageDefinition?.code;
  return code ? isOpeningStageCode(code) : false;
}

export function isLockedAnchorNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  const code = node.stageDefinition?.code;
  return code ? isLockedAnchorStageCode(code) : false;
}

export function getInspectionNodeId(nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[]): string | null {
  return nodes.find((n) => n.stageDefinition?.code === 'INSPECTION')?.id ?? null;
}

export function getMaterialPrepNodeId(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): string | null {
  return nodes.find((n) => n.stageDefinition?.code === OPENING_STAGE_CODE)?.id ?? null;
}

/** Production nodes only (excludes Inspection / Packaging / Delivery). Includes Material Prep. */
export function productionNodes<T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>(
  nodes: T[],
): T[] {
  return partitionWorkflowNodes(nodes).production;
}

/** Editable middle stages — excludes Material Prep and terminal chain. */
export function middleProductionNodes<
  T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>,
>(nodes: T[]): T[] {
  return partitionWorkflowAnchors(nodes).middle;
}

/** Last production node before the terminal chain (highest sortOrder tail in production subgraph). */
export function getLastProductionPredecessor(
  nodes: Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>[],
  edges: EdgeLike[],
): string | null {
  const prod = productionNodes(nodes);
  if (prod.length === 0) return null;
  const prodIds = new Set(prod.map((n) => n.id));
  const hasProdSuccessor = new Map<string, boolean>();
  for (const e of edges) {
    if (prodIds.has(e.fromNodeId) && prodIds.has(e.toNodeId)) {
      hasProdSuccessor.set(e.fromNodeId, true);
    }
  }
  const tails = prod.filter((n) => !hasProdSuccessor.get(n.id));
  const pool = tails.length > 0 ? tails : prod;
  return [...pool].sort((a, b) => b.sortOrder - a.sortOrder)[0]?.id ?? null;
}

/** Default wiring when inserting a new production stage: after last production, before Inspection. */
export function resolveInsertBeforeInspection(
  nodes: Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>[],
  edges: EdgeLike[],
): { runsAfterIds: string[]; leadsIntoIds: string[] } {
  const inspectionId = getInspectionNodeId(nodes);
  const lastProd = getLastProductionPredecessor(nodes, edges);
  return {
    runsAfterIds: lastProd ? [lastProd] : [],
    leadsIntoIds: inspectionId ? [inspectionId] : [],
  };
}

/**
 * Placement: Start of production — root beside Material Prep, joins Inspection.
 */
export function resolvePlacementStart(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): { runsAfterIds: string[]; leadsIntoIds: string[] } {
  const inspectionId = getInspectionNodeId(nodes);
  return {
    runsAfterIds: [],
    leadsIntoIds: inspectionId ? [inspectionId] : [],
  };
}

/**
 * Placement: After selected production stages → Inspection.
 */
export function resolvePlacementAfter(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
  afterNodeIds: string[],
): { runsAfterIds: string[]; leadsIntoIds: string[] } {
  const inspectionId = getInspectionNodeId(nodes);
  return {
    runsAfterIds: [...afterNodeIds],
    leadsIntoIds: inspectionId ? [inspectionId] : [],
  };
}

/**
 * Placement: Parallel with N siblings — union of their predecessors → Inspection.
 * Prefer resolveParallelPlacementSafe for cycle-free wiring.
 */
export function resolvePlacementParallelWith(
  edges: EdgeLike[],
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
  siblingNodeIds: string[],
): { runsAfterIds: string[]; leadsIntoIds: string[] } {
  const inspectionId = getInspectionNodeId(nodes);
  const safe = resolveParallelPlacementSafe({
    edges,
    targetId: '__new__',
    siblingNodeIds,
  });
  return {
    runsAfterIds: safe.runsAfterIds,
    leadsIntoIds: inspectionId ? [inspectionId] : [],
  };
}

/**
 * Safe parallel placement for edit/add:
 * - shared preds = union of sibling direct preds
 * - drop target and any descendant of target (would cycle)
 * - empty → start-level parallel (root beside Material Prep)
 * - siblings that are descendants of target get lifted to the same preds
 */
export function resolveParallelPlacementSafe(args: {
  edges: EdgeLike[];
  targetId: string;
  siblingNodeIds: string[];
}): {
  runsAfterIds: string[];
  siblingLiftPatches: Array<{ nodeId: string; runsAfterNodeIds: string[] }>;
} {
  const { edges, targetId, siblingNodeIds } = args;
  const union = new Set<string>();
  for (const sid of siblingNodeIds) {
    for (const p of predecessorsOf(edges, sid)) {
      union.add(p);
    }
  }

  const safePreds = [...union].filter((p) => {
    if (p === targetId) return false;
    // Descendant of target cannot be a predecessor of target.
    if (isReachableFrom(edges, targetId, p)) return false;
    return true;
  });

  const runsAfterIds = safePreds;
  const siblingLiftPatches: Array<{ nodeId: string; runsAfterNodeIds: string[] }> = [];

  for (const sid of siblingNodeIds) {
    if (sid === targetId) continue;
    // Lift descendants of target so they become true siblings.
    if (!isReachableFrom(edges, targetId, sid)) {
      // Already not downstream — still align preds if they differ from safe set.
      const current = predecessorsOf(edges, sid).slice().sort().join('|');
      const desired = [...runsAfterIds].sort().join('|');
      if (current !== desired) {
        siblingLiftPatches.push({ nodeId: sid, runsAfterNodeIds: [...runsAfterIds] });
      }
      continue;
    }
    siblingLiftPatches.push({ nodeId: sid, runsAfterNodeIds: [...runsAfterIds] });
  }

  return { runsAfterIds, siblingLiftPatches };
}

/** Drop lift patches that would rewrite locked anchors (caller should also filter). */
export function filterSiblingLiftPatches<
  T extends { nodeId: string; runsAfterNodeIds: string[] },
>(
  patches: T[],
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): T[] {
  const locked = lockedAnchorNodeIds(nodes);
  const inspectionId = getInspectionNodeId(nodes);
  return patches.filter((p) => {
    if (locked.has(p.nodeId) && p.nodeId !== inspectionId) return false;
    // Never lift Inspection via parallel — Inspection preds are heal/splice only.
    if (p.nodeId === inspectionId) return false;
    return true;
  });
}

export function terminalNodeIds(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): Set<string> {
  return new Set(nodes.filter(isTerminalNode).map((n) => n.id));
}

export function lockedAnchorNodeIds(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): Set<string> {
  return new Set(nodes.filter(isLockedAnchorNode).map((n) => n.id));
}

export function partitionWorkflowNodes<T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>(
  nodes: T[],
): { production: T[]; terminal: T[] } {
  const production: T[] = [];
  const terminal: T[] = [];
  for (const node of nodes) {
    if (isTerminalNode(node)) terminal.push(node);
    else production.push(node);
  }
  terminal.sort(
    (a, b) =>
      TERMINAL_STAGE_CODES.indexOf((a.stageDefinition?.code ?? '') as TerminalStageCode) -
      TERMINAL_STAGE_CODES.indexOf((b.stageDefinition?.code ?? '') as TerminalStageCode),
  );
  production.sort((a, b) => a.sortOrder - b.sortOrder);
  return { production, terminal };
}

/** Group middle stages that share the same predecessor set into "together" lanes. */
export function groupParallelLanes<
  T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>,
>(
  nodes: T[],
  edges: EdgeLike[],
): Array<{ kind: 'solo' | 'together'; nodes: T[] }> {
  const remaining = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
  const lanes: Array<{ kind: 'solo' | 'together'; nodes: T[] }> = [];
  const used = new Set<string>();

  for (const node of remaining) {
    if (used.has(node.id)) continue;
    const predKey = predecessorsOf(edges, node.id).slice().sort().join('|');
    const siblings = remaining.filter((n) => {
      if (used.has(n.id)) return false;
      const key = predecessorsOf(edges, n.id).slice().sort().join('|');
      return key === predKey;
    });
    for (const s of siblings) used.add(s.id);
    lanes.push({
      kind: siblings.length > 1 ? 'together' : 'solo',
      nodes: siblings,
    });
  }
  return lanes;
}

/** Three-zone partition: Material Prep | editable middle | finishing trio. */
export function partitionWorkflowAnchors<
  T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>,
>(nodes: T[]): { opening: T[]; middle: T[]; terminal: T[] } {
  const opening: T[] = [];
  const middle: T[] = [];
  const terminal: T[] = [];
  for (const node of nodes) {
    if (isOpeningNode(node)) opening.push(node);
    else if (isTerminalNode(node)) terminal.push(node);
    else middle.push(node);
  }
  terminal.sort(
    (a, b) =>
      TERMINAL_STAGE_CODES.indexOf((a.stageDefinition?.code ?? '') as TerminalStageCode) -
      TERMINAL_STAGE_CODES.indexOf((b.stageDefinition?.code ?? '') as TerminalStageCode),
  );
  opening.sort((a, b) => a.sortOrder - b.sortOrder);
  middle.sort((a, b) => a.sortOrder - b.sortOrder);
  return { opening, middle, terminal };
}
