import {
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
  isLockedAnchorStageCode,
  isOpeningStageCode,
  isTerminalStageCode,
  type TerminalStageCode,
} from '@maher/types';
import type { WorkflowNode } from '@/components/workflow/workflow-types';
import {
  isReachableFrom,
  predecessorsOf,
  type EdgeLike,
} from '@/lib/workflow-rewire';

export { isReachableFrom };

export {
  OPENING_STAGE_CODE,
  TERMINAL_STAGE_CODES,
  isLockedAnchorStageCode,
  isOpeningStageCode,
  isTerminalStageCode,
  type TerminalStageCode,
};

export function isTerminalNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  return isTerminalStageCode(node.stageDefinition.code);
}

export function isOpeningNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  return isOpeningStageCode(node.stageDefinition.code);
}

export function isLockedAnchorNode(node: Pick<WorkflowNode, 'stageDefinition'>): boolean {
  return isLockedAnchorStageCode(node.stageDefinition.code);
}

export function getInspectionNodeId(nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[]): string | null {
  return nodes.find((n) => n.stageDefinition.code === 'INSPECTION')?.id ?? null;
}

export function getMaterialPrepNodeId(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): string | null {
  return nodes.find((n) => n.stageDefinition.code === OPENING_STAGE_CODE)?.id ?? null;
}

export function productionNodes<T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>(
  nodes: T[],
): T[] {
  return partitionNodes(nodes).production;
}

export function middleProductionNodes<
  T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>,
>(nodes: T[]): T[] {
  return partitionWorkflowAnchors(nodes).middle;
}

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

export function resolvePlacementStart(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): { runsAfterIds: string[]; leadsIntoIds: string[] } {
  const inspectionId = getInspectionNodeId(nodes);
  return {
    runsAfterIds: [],
    leadsIntoIds: inspectionId ? [inspectionId] : [],
  };
}

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

  const runsAfterIds = [...union].filter((p) => {
    if (p === targetId) return false;
    if (isReachableFrom(edges, targetId, p)) return false;
    return true;
  });

  const siblingLiftPatches: Array<{ nodeId: string; runsAfterNodeIds: string[] }> = [];
  for (const sid of siblingNodeIds) {
    if (sid === targetId) continue;
    if (!isReachableFrom(edges, targetId, sid)) {
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

export function terminalNodeIds(nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[]): Set<string> {
  return new Set(nodes.filter(isTerminalNode).map((n) => n.id));
}

export function lockedAnchorNodeIds(
  nodes: Pick<WorkflowNode, 'id' | 'stageDefinition'>[],
): Set<string> {
  return new Set(nodes.filter(isLockedAnchorNode).map((n) => n.id));
}

export function partitionNodes<T extends Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>>(
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
      TERMINAL_STAGE_CODES.indexOf(a.stageDefinition.code as TerminalStageCode) -
      TERMINAL_STAGE_CODES.indexOf(b.stageDefinition.code as TerminalStageCode),
  );
  production.sort((a, b) => a.sortOrder - b.sortOrder);
  return { production, terminal };
}

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
      TERMINAL_STAGE_CODES.indexOf(a.stageDefinition.code as TerminalStageCode) -
      TERMINAL_STAGE_CODES.indexOf(b.stageDefinition.code as TerminalStageCode),
  );
  opening.sort((a, b) => a.sortOrder - b.sortOrder);
  middle.sort((a, b) => a.sortOrder - b.sortOrder);
  return { opening, middle, terminal };
}

export function executionKindForNode(
  node: Pick<WorkflowNode, 'stageDefinition'>,
): 'PRODUCTION' | 'QUALITY' | 'LOGISTICS' {
  const kind = node.stageDefinition.executionKind;
  if (kind) return kind;
  const code = node.stageDefinition.code;
  if (code === 'INSPECTION' || code === 'QC' || code === 'QUALITY') return 'QUALITY';
  if (code === 'DELIVERY') return 'LOGISTICS';
  return 'PRODUCTION';
}
