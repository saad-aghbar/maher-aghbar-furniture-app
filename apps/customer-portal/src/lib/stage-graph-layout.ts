export type StageGraphInput = {
  code: string;
  dependsOnCodes: string[];
  sortOrder: number;
};

export type StageGraphNode<T extends StageGraphInput> = T & {
  level: number;
  lane: number;
};

export type StageGraphEdge = { from: string; to: string };

export type StageGraphLayout<T extends StageGraphInput> = {
  nodes: StageGraphNode<T>[];
  edges: StageGraphEdge[];
  levelCount: number;
  maxLanes: number;
};

export function layoutStageGraph<T extends StageGraphInput>(stages: T[]): StageGraphLayout<T> {
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
    const level = deps.length ? 1 + Math.max(...deps.map((d) => levelOf(d, stack))) : 0;
    stack.delete(code);
    levelMemo.set(code, level);
    return level;
  }

  for (const stage of stages) {
    levelOf(stage.code, new Set());
  }

  const levels = new Map<number, T[]>();
  for (const stage of [...stages].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const level = levelMemo.get(stage.code) ?? 0;
    const bucket = levels.get(level) ?? [];
    bucket.push(stage);
    levels.set(level, bucket);
  }

  const levelCount = levels.size ? Math.max(...levels.keys()) + 1 : 0;
  const edges: StageGraphEdge[] = [];
  for (const stage of stages) {
    for (const dep of stage.dependsOnCodes ?? []) {
      if (byCode.has(dep)) edges.push({ from: dep, to: stage.code });
    }
  }

  let maxLanes = 0;
  const nodes: StageGraphNode<T>[] = [];
  for (let level = 0; level < levelCount; level += 1) {
    const bucket = levels.get(level) ?? [];
    maxLanes = Math.max(maxLanes, bucket.length);
    bucket.forEach((stage, lane) => {
      nodes.push({ ...stage, level, lane });
    });
  }

  return { nodes, edges, levelCount, maxLanes };
}

export function displayStageEdges<T extends StageGraphInput>(
  layout: StageGraphLayout<T>,
): StageGraphEdge[] {
  if (!layout.nodes.length) return [];
  const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
  const seen = new Set<string>();
  const result: StageGraphEdge[] = [];
  const add = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ from, to });
  };
  for (const edge of layout.edges) {
    const fromLevel = levelOf.get(edge.from);
    const toLevel = levelOf.get(edge.to);
    if (fromLevel == null || toLevel == null) continue;
    if (toLevel === fromLevel + 1) add(edge.from, edge.to);
    else if (toLevel > fromLevel + 1) {
      const next = layout.nodes.find((n) => n.level === fromLevel + 1);
      if (next) add(edge.from, next.code);
      else add(edge.from, edge.to);
    }
  }
  return result;
}
