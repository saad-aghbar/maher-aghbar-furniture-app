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

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Order lanes within each level to reduce edge crossings (barycenter heuristic).
 * Ported from the mobile factory map so parallel branches stay symmetric.
 */
function orderLanesByBarycenter<T extends StageGraphInput>(
  levels: Map<number, T[]>,
  levelCount: number,
  edges: StageGraphEdge[],
): Map<number, T[]> {
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) {
    const kids = childrenOf.get(e.from) ?? [];
    kids.push(e.to);
    childrenOf.set(e.from, kids);
    const parents = parentsOf.get(e.to) ?? [];
    parents.push(e.from);
    parentsOf.set(e.to, parents);
  }

  let ordered = new Map(levels);
  const laneOf = () => {
    const map = new Map<string, number>();
    for (const [, bucket] of ordered) {
      bucket.forEach((s, i) => map.set(s.code, i));
    }
    return map;
  };

  for (let pass = 0; pass < 4; pass += 1) {
    const nextDown = new Map<number, T[]>();
    for (let level = 0; level < levelCount; level += 1) {
      const bucket = [...(ordered.get(level) ?? [])];
      if (level === 0) {
        nextDown.set(level, bucket);
        continue;
      }
      const lanes = laneOf();
      bucket.sort((a, b) => {
        const aParents = (parentsOf.get(a.code) ?? [])
          .map((p) => lanes.get(p))
          .filter((n): n is number => n != null);
        const bParents = (parentsOf.get(b.code) ?? [])
          .map((p) => lanes.get(p))
          .filter((n): n is number => n != null);
        const aMed = aParents.length ? median(aParents) : a.sortOrder;
        const bMed = bParents.length ? median(bParents) : b.sortOrder;
        return aMed - bMed || a.sortOrder - b.sortOrder;
      });
      nextDown.set(level, bucket);
    }
    ordered = nextDown;

    const nextUp = new Map<number, T[]>();
    for (let level = levelCount - 1; level >= 0; level -= 1) {
      const bucket = [...(ordered.get(level) ?? [])];
      if (level === levelCount - 1) {
        nextUp.set(level, bucket);
        continue;
      }
      const lanes = laneOf();
      for (let l = level + 1; l < levelCount; l += 1) {
        (nextUp.get(l) ?? ordered.get(l) ?? []).forEach((s, i) => lanes.set(s.code, i));
      }
      bucket.sort((a, b) => {
        const aKids = (childrenOf.get(a.code) ?? [])
          .map((c) => lanes.get(c))
          .filter((n): n is number => n != null);
        const bKids = (childrenOf.get(b.code) ?? [])
          .map((c) => lanes.get(c))
          .filter((n): n is number => n != null);
        const aMed = aKids.length ? median(aKids) : a.sortOrder;
        const bMed = bKids.length ? median(bKids) : b.sortOrder;
        return aMed - bMed || a.sortOrder - b.sortOrder;
      });
      nextUp.set(level, bucket);
    }
    const merged = new Map<number, T[]>();
    for (let level = 0; level < levelCount; level += 1) {
      merged.set(level, nextUp.get(level) ?? ordered.get(level) ?? []);
    }
    ordered = merged;
  }

  return ordered;
}

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

  const orderedLevels = orderLanesByBarycenter(levels, levelCount, edges);

  let maxLanes = 0;
  const nodes: StageGraphNode<T>[] = [];
  for (let level = 0; level < levelCount; level += 1) {
    const bucket = orderedLevels.get(level) ?? [];
    maxLanes = Math.max(maxLanes, bucket.length);
    bucket.forEach((stage, lane) => {
      nodes.push({ ...stage, level, lane });
    });
  }

  return { nodes, edges, levelCount, maxLanes };
}

/**
 * Edges for the map: real dependencies between adjacent levels only.
 * Longer spans attach to the nearest on-path neighbor instead of fanning out.
 */
export function displayStageEdges<T extends StageGraphInput>(
  layout: StageGraphLayout<T>,
): StageGraphEdge[] {
  if (!layout.nodes.length) return [];
  const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
  const byCode = new Map(layout.nodes.map((n) => [n.code, n]));
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
    if (fromLevel == null || toLevel == null) continue;
    if (toLevel === fromLevel + 1) add(edge.from, edge.to);
  }

  for (const edge of layout.edges) {
    const fromLevel = levelOf.get(edge.from);
    const toLevel = levelOf.get(edge.to);
    if (fromLevel == null || toLevel == null) continue;
    if (toLevel <= fromLevel + 1) continue;

    const candidates = layout.nodes.filter((n) => n.level === fromLevel + 1);
    if (!candidates.length) continue;
    const target = byCode.get(edge.to);
    const parent = byCode.get(edge.from);
    if (!target || !parent) continue;

    const onPath = candidates.filter((c) => {
      const stack = [c.code];
      const visited = new Set<string>();
      while (stack.length) {
        const code = stack.pop()!;
        if (code === target.code) return true;
        if (visited.has(code)) continue;
        visited.add(code);
        for (const e of layout.edges) {
          if (e.from === code) stack.push(e.to);
        }
      }
      return false;
    });

    const pool = onPath.length ? onPath : candidates;
    pool.sort(
      (a, b) =>
        Math.abs(a.lane - parent.lane) - Math.abs(b.lane - parent.lane) ||
        Math.abs(a.lane - target.lane) - Math.abs(b.lane - target.lane),
    );
    add(edge.from, pool[0]!.code);
  }

  return result;
}
