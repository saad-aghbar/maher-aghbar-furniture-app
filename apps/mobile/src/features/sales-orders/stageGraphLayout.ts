import type { OrderStageView } from './selectOrderDetail';

export type StageGraphNode = OrderStageView & {
  level: number;
  lane: number;
};

export type StageGraphEdge = {
  from: string;
  to: string;
};

export type StageGraphLayout = {
  nodes: StageGraphNode[];
  edges: StageGraphEdge[];
  levelCount: number;
  maxLanes: number;
};

/**
 * Edges for the barrel map: only adjacent levels, plus fill-ins so parallel
 * stages always merge into the next row (avoids long cross-level spaghetti).
 */
export function displayStageEdges(layout: StageGraphLayout): StageGraphEdge[] {
  if (!layout.nodes.length) return [];

  const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
  const result: StageGraphEdge[] = [];
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
      if (result.some((e) => e.from === parent.code)) continue;
      const direct = next.filter((n) => (n.dependsOnCodes ?? []).includes(parent.code));
      if (direct.length) {
        for (const child of direct) add(parent.code, child.code);
        continue;
      }
      if (next.length === 1) {
        add(parent.code, next[0]!.code);
      } else {
        for (const child of next) add(parent.code, child.code);
      }
    }
  }

  return result;
}

/**
 * Lay out production stages into dependency levels (one → many → one).
 * Level = 1 + max(parent levels); roots with no deps sit at 0.
 */
export function layoutStageGraph(stages: OrderStageView[]): StageGraphLayout {
  if (!stages.length) {
    return { nodes: [], edges: [], levelCount: 0, maxLanes: 0 };
  }

  const byCode = new Map(stages.map((s) => [s.code, s]));
  const levelMemo = new Map<string, number>();

  function levelOf(code: string, stack: Set<string>): number {
    const cached = levelMemo.get(code);
    if (cached != null) return cached;
    if (stack.has(code)) return 0;
    stack.add(code);
    const stage = byCode.get(code);
    const deps = (stage?.dependsOnCodes ?? []).filter((d) => byCode.has(d));
    const level = deps.length
      ? 1 + Math.max(...deps.map((d) => levelOf(d, stack)))
      : 0;
    stack.delete(code);
    levelMemo.set(code, level);
    return level;
  }

  for (const stage of stages) {
    levelOf(stage.code, new Set());
  }

  const levels = new Map<number, OrderStageView[]>();
  for (const stage of [...stages].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const level = levelMemo.get(stage.code) ?? 0;
    const bucket = levels.get(level) ?? [];
    bucket.push(stage);
    levels.set(level, bucket);
  }

  const levelCount = levels.size ? Math.max(...levels.keys()) + 1 : 0;
  let maxLanes = 0;
  const nodes: StageGraphNode[] = [];

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

  const edges: StageGraphEdge[] = [];
  for (const stage of stages) {
    for (const dep of stage.dependsOnCodes ?? []) {
      if (byCode.has(dep)) {
        edges.push({ from: dep, to: stage.code });
      }
    }
  }

  return { nodes, edges, levelCount, maxLanes };
}
