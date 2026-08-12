/**
 * Generic workflow graph layout utilities (layered DAG).
 * Adapted from apps/mobile/src/features/sales-orders/stageGraphLayout.ts.
 */

export type WorkflowGraphStageInput = {
  /** Stable identifier for layout edges (defaults to `code`). */
  id?: string;
  code: string;
  sortOrder: number;
  dependsOnCodes?: string[];
  /** Alias for dependsOnCodes when callers use node keys instead of stage codes. */
  dependsOnKeys?: string[];
};

export type WorkflowGraphLayoutNode<T extends WorkflowGraphStageInput = WorkflowGraphStageInput> =
  T & {
    level: number;
    lane: number;
  };

export type WorkflowGraphLayoutEdge = {
  from: string;
  to: string;
};

export type WorkflowGraphLayout<T extends WorkflowGraphStageInput = WorkflowGraphStageInput> = {
  nodes: WorkflowGraphLayoutNode<T>[];
  edges: WorkflowGraphLayoutEdge[];
  levelCount: number;
  maxLanes: number;
};

function nodeKey(stage: WorkflowGraphStageInput): string {
  return stage.id ?? stage.code;
}

function dependencyKeys(stage: WorkflowGraphStageInput): string[] {
  if (stage.dependsOnKeys?.length) return stage.dependsOnKeys;
  return stage.dependsOnCodes ?? [];
}

/**
 * Edges for display: only adjacent levels, plus fill-ins so parallel
 * stages always merge into the next row (avoids long cross-level spaghetti).
 */
export function displayWorkflowGraphEdges<T extends WorkflowGraphStageInput>(
  layout: WorkflowGraphLayout<T>,
): WorkflowGraphLayoutEdge[] {
  if (!layout.nodes.length) return [];

  const levelOf = new Map(layout.nodes.map((n) => [nodeKey(n), n.level]));
  const result: WorkflowGraphLayoutEdge[] = [];
  const seen = new Set<string>();

  const add = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ from, to });
  };

  for (const edge of layout.edges) {
    const fromLevel = levelOf.get(edge.from);
    const toLevel = levelOf.get(edge.to);
    if (fromLevel != null && toLevel != null && toLevel === fromLevel + 1) {
      add(edge.from, edge.to);
    }
  }

  for (let level = 0; level < layout.levelCount - 1; level += 1) {
    const prev = layout.nodes.filter((n) => n.level === level);
    const next = layout.nodes.filter((n) => n.level === level + 1);
    for (const parent of prev) {
      const parentKey = nodeKey(parent);
      if (result.some((e) => e.from === parentKey)) continue;
      const direct = next.filter((n) => dependencyKeys(n).includes(parentKey));
      if (direct.length) {
        for (const child of direct) add(parentKey, nodeKey(child));
        continue;
      }
      if (next.length === 1) {
        add(parentKey, nodeKey(next[0]!));
      } else {
        for (const child of next) add(parentKey, nodeKey(child));
      }
    }
  }

  return result;
}

/**
 * Lay out workflow stages into dependency levels (one → many → one).
 * Level = 1 + max(parent levels); roots with no deps sit at 0.
 */
export function layoutWorkflowGraph<T extends WorkflowGraphStageInput>(
  stages: T[],
): WorkflowGraphLayout<T> {
  if (!stages.length) {
    return { nodes: [], edges: [], levelCount: 0, maxLanes: 0 };
  }

  const byKey = new Map(stages.map((s) => [nodeKey(s), s]));
  const levelMemo = new Map<string, number>();

  function levelOf(key: string, stack: Set<string>): number {
    const cached = levelMemo.get(key);
    if (cached != null) return cached;
    if (stack.has(key)) return 0;
    stack.add(key);
    const stage = byKey.get(key);
    const deps = dependencyKeys(stage ?? { code: key, sortOrder: 0 }).filter((d) => byKey.has(d));
    const level = deps.length ? 1 + Math.max(...deps.map((d) => levelOf(d, stack))) : 0;
    stack.delete(key);
    levelMemo.set(key, level);
    return level;
  }

  for (const stage of stages) {
    levelOf(nodeKey(stage), new Set());
  }

  const levels = new Map<number, T[]>();
  for (const stage of [...stages].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const level = levelMemo.get(nodeKey(stage)) ?? 0;
    const bucket = levels.get(level) ?? [];
    bucket.push(stage);
    levels.set(level, bucket);
  }

  const levelCount = levels.size ? Math.max(...levels.keys()) + 1 : 0;
  let maxLanes = 0;
  const nodes: WorkflowGraphLayoutNode<T>[] = [];

  for (let level = 0; level < levelCount; level += 1) {
    const bucket = levels.get(level) ?? [];
    maxLanes = Math.max(maxLanes, bucket.length);
    bucket.forEach((stage, lane) => {
      nodes.push({
        ...stage,
        level,
        lane,
      });
    });
  }

  const edges: WorkflowGraphLayoutEdge[] = [];
  for (const stage of stages) {
    const stageKey = nodeKey(stage);
    for (const dep of dependencyKeys(stage)) {
      if (byKey.has(dep)) {
        edges.push({ from: dep, to: stageKey });
      }
    }
  }

  return { nodes, edges, levelCount, maxLanes };
}

/** @deprecated Use layoutWorkflowGraph */
export const layoutStageGraph = layoutWorkflowGraph;

/** @deprecated Use displayWorkflowGraphEdges */
export const displayStageEdges = displayWorkflowGraphEdges;
