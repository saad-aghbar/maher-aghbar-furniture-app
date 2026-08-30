import type { WorkflowNode } from '@/api/modules/workflow';
import {
  computeParallelBands,
  isParallelToParallelJoin,
  type ParallelBand,
} from '@maher/workflow-domain';
import { predecessorsOf, type EdgeLike } from './rewireWorkflowEdges';

export type WorkflowLayoutNode = Pick<WorkflowNode, 'id' | 'sortOrder' | 'stageDefinition'>;

/**
 * - solo: single node at this level
 * - parallel: siblings sharing preds (inside a band) — no Together hub label
 * - together: target band whose preds are exactly a prior parallel band (band→band)
 */
export type WorkflowLayoutLane<T extends WorkflowLayoutNode = WorkflowLayoutNode> = {
  kind: 'solo' | 'parallel' | 'together';
  nodes: T[];
};

export type WorkflowLayoutLevel<T extends WorkflowLayoutNode = WorkflowLayoutNode> = {
  level: number;
  lanes: WorkflowLayoutLane<T>[];
};

const TERMINAL = new Set(['INSPECTION', 'PACKAGING', 'DELIVERY']);

function productionIds(nodes: WorkflowLayoutNode[]): string[] {
  return nodes
    .filter((n) => {
      const c = n.stageDefinition?.code;
      return c && !TERMINAL.has(c);
    })
    .map((n) => n.id);
}

function bandsFromEdges(nodes: WorkflowLayoutNode[], edges: EdgeLike[]): ParallelBand[] {
  const preds: Record<string, string[]> = {};
  for (const id of productionIds(nodes)) {
    preds[id] = predecessorsOf(edges, id).slice().sort();
  }
  return computeParallelBands(Object.keys(preds), preds);
}

/** Longest-path level: roots (no preds in the set) at 0. */
export function workflowNodeLevels(
  nodes: WorkflowLayoutNode[],
  edges: EdgeLike[],
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const memo = new Map<string, number>();

  function levelOf(id: string, stack: Set<string>): number {
    const cached = memo.get(id);
    if (cached != null) return cached;
    if (stack.has(id)) return 0;
    stack.add(id);
    const preds = predecessorsOf(edges, id).filter((p) => ids.has(p));
    const level = preds.length ? 1 + Math.max(...preds.map((p) => levelOf(p, stack))) : 0;
    stack.delete(id);
    memo.set(id, level);
    return level;
  }

  for (const n of nodes) {
    levelOf(n.id, new Set());
  }
  return memo;
}

function laneKind(
  siblingIds: string[],
  predIds: string[],
  bands: ParallelBand[],
): 'solo' | 'parallel' | 'together' {
  if (siblingIds.length < 2) return 'solo';
  const targetBand: ParallelBand = {
    id: 'tmp',
    nodeIds: siblingIds.slice().sort(),
    predecessorIds: predIds.slice().sort(),
  };
  const source = bands.find((b) => isParallelToParallelJoin(b, targetBand));
  if (source) return 'together';
  return 'parallel';
}

/**
 * DAG levels for stages list + placement chips.
 * Together label only for parallel-band → parallel-band joins.
 */
export function buildWorkflowLayoutLevels<T extends WorkflowLayoutNode>(
  nodes: T[],
  edges: EdgeLike[],
): WorkflowLayoutLevel<T>[] {
  if (nodes.length === 0) return [];

  const bands = bandsFromEdges(nodes, edges);
  const levels = workflowNodeLevels(nodes, edges);
  const byLevel = new Map<number, T[]>();
  for (const n of [...nodes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const lv = levels.get(n.id) ?? 0;
    const bucket = byLevel.get(lv) ?? [];
    bucket.push(n);
    byLevel.set(lv, bucket);
  }

  const maxLevel = Math.max(...byLevel.keys(), 0);
  const result: WorkflowLayoutLevel<T>[] = [];

  for (let level = 0; level <= maxLevel; level += 1) {
    const bucket = byLevel.get(level) ?? [];
    if (bucket.length === 0) continue;

    const remaining = [...bucket];
    const lanes: WorkflowLayoutLane<T>[] = [];
    const used = new Set<string>();

    for (const node of remaining) {
      if (used.has(node.id)) continue;
      const predKey = predecessorsOf(edges, node.id).slice().sort().join('|');
      const predIds = predKey ? predKey.split('|') : [];
      const siblings = remaining.filter((n) => {
        if (used.has(n.id)) return false;
        const key = predecessorsOf(edges, n.id).slice().sort().join('|');
        return key === predKey;
      });
      for (const s of siblings) used.add(s.id);
      lanes.push({
        kind: laneKind(
          siblings.map((s) => s.id),
          predIds,
          bands,
        ),
        nodes: siblings,
      });
    }

    result.push({ level, lanes });
  }

  return result;
}
