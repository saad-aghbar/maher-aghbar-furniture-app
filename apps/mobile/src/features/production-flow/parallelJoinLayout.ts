import type {
  StageGraphEdge,
  StageGraphLayout,
  StageGraphNode,
} from '@/features/sales-orders/stageGraphLayout';

export const JOIN_CODE_PREFIX = '__join_';

export function isJoinHubCode(code: string): boolean {
  return code.startsWith(JOIN_CODE_PREFIX);
}

export type ParallelJoinMeta = {
  joinCode: string;
  feederCodes: string[];
  successorCodes: string[];
};

export type ParallelJoinLayout = StageGraphLayout & {
  joins: ParallelJoinMeta[];
};

function predKey(codes: string[]): string {
  return [...codes].sort().join('|');
}

function predsOf(edges: StageGraphEdge[], code: string): string[] {
  return edges.filter((e) => e.to === code).map((e) => e.from);
}

/** True when ≥2 feeders all sit on the same layout level (a real parallel band). */
function feedersAreParallelBand(
  levelOf: Map<string, number>,
  feederCodes: string[],
): boolean {
  if (feederCodes.length < 2) return false;
  const levels = new Set<number>();
  for (const code of feederCodes) {
    const level = levelOf.get(code);
    if (level == null) return false;
    levels.add(level);
  }
  return levels.size === 1;
}

/**
 * Find parallel→parallel AND-sync cuts only.
 * Hub when ≥2 same-level feeders all feed ≥2 successors that share that exact pred set.
 * No hub for fan-in to one stage, fan-out, or independent 1:1 lanes.
 */
export function findAndSyncCuts(layout: StageGraphLayout): Array<{
  feederCodes: string[];
  successorCodes: string[];
  /** Insert join at this level (successors currently live at this level). */
  beforeLevel: number;
}> {
  if (!layout.nodes.length) return [];

  const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
  const byLevel = new Map<number, StageGraphNode[]>();
  for (const n of layout.nodes) {
    const bucket = byLevel.get(n.level) ?? [];
    bucket.push(n);
    byLevel.set(n.level, bucket);
  }

  const cuts: Array<{
    feederCodes: string[];
    successorCodes: string[];
    beforeLevel: number;
  }> = [];
  const coveredSuccessors = new Set<string>();

  const maxLevel = layout.levelCount - 1;
  for (let level = 0; level <= maxLevel; level += 1) {
    const nodes = byLevel.get(level) ?? [];
    if (nodes.length < 2) continue;

    const groups = new Map<string, StageGraphNode[]>();
    for (const n of nodes) {
      if (coveredSuccessors.has(n.code)) continue;
      const preds = predsOf(layout.edges, n.code).filter((p) => !isJoinHubCode(p));
      const key = predKey(preds);
      const g = groups.get(key) ?? [];
      g.push(n);
      groups.set(key, g);
    }

    for (const [key, group] of groups) {
      if (!key) continue;
      if (group.length < 2) continue;
      const feeders = key.split('|').filter(Boolean);
      if (!feedersAreParallelBand(levelOf, feeders)) continue;

      cuts.push({
        feederCodes: feeders,
        successorCodes: group.map((n) => n.code).sort(),
        beforeLevel: level,
      });
      for (const n of group) coveredSuccessors.add(n.code);
    }
  }

  return cuts.sort((a, b) => a.beforeLevel - b.beforeLevel);
}

/**
 * Edges to draw on the bubble map: canonical direct dependencies (already TR'd in domain).
 * Dedupe only — do not run a second transitive reduction.
 */
export function layoutMapEdges(layout: StageGraphLayout): StageGraphEdge[] {
  if (!layout.nodes.length) return [];
  const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
  const candidates: StageGraphEdge[] = [];
  const seen = new Set<string>();
  for (const edge of layout.edges) {
    const fromLevel = levelOf.get(edge.from);
    const toLevel = levelOf.get(edge.to);
    if (fromLevel == null || toLevel == null) continue;
    if (toLevel <= fromLevel) continue;
    const key = `${edge.from}->${edge.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(edge);
  }
  return candidates;
}

/** @deprecated Prefer layoutMapEdges — kept for any leftover imports. */
export function adjacentLayoutEdges(layout: StageGraphLayout): StageGraphEdge[] {
  return layoutMapEdges(layout).filter((edge) => {
    const levelOf = new Map(layout.nodes.map((n) => [n.code, n.level]));
    return (levelOf.get(edge.to) ?? 0) === (levelOf.get(edge.from) ?? 0) + 1;
  });
}

/**
 * Insert display-only join hubs for parallel→parallel sync cuts.
 * Does not mutate the input layout.
 */
export function insertParallelJoinHubs(layout: StageGraphLayout): ParallelJoinLayout {
  const cuts = findAndSyncCuts(layout);
  if (cuts.length === 0) {
    return { ...layout, joins: [] };
  }

  // Apply cuts from lowest beforeLevel upward; each insert shifts later levels by +1.
  let nodes: StageGraphNode[] = layout.nodes.map((n) => ({ ...n }));
  let edges: StageGraphEdge[] = layout.edges.map((e) => ({ ...e }));
  const joins: ParallelJoinMeta[] = [];
  let shiftAccum = 0;

  for (let i = 0; i < cuts.length; i += 1) {
    const cut = cuts[i]!;
    const beforeLevel = cut.beforeLevel + shiftAccum;
    const joinCode = `${JOIN_CODE_PREFIX}${i}`;

    nodes = nodes.map((n) =>
      n.level >= beforeLevel ? { ...n, level: n.level + 1 } : n,
    );

    const joinNode: StageGraphNode = {
      code: joinCode,
      name: 'Together',
      status: 'PENDING',
      progressPercent: 0,
      dependsOnCodes: [...cut.feederCodes],
      sortOrder: -1 - i,
      level: beforeLevel,
      lane: 0,
    };
    nodes.push(joinNode);

    const feederSet = new Set(cut.feederCodes);
    const succSet = new Set(cut.successorCodes);
    const kept: StageGraphEdge[] = [];
    for (const e of edges) {
      if (feederSet.has(e.from) && succSet.has(e.to)) {
        continue;
      }
      kept.push(e);
    }
    for (const f of cut.feederCodes) {
      kept.push({ from: f, to: joinCode });
    }
    for (const s of cut.successorCodes) {
      kept.push({ from: joinCode, to: s });
    }
    edges = kept;

    joins.push({
      joinCode,
      feederCodes: [...cut.feederCodes],
      successorCodes: [...cut.successorCodes],
    });
    shiftAccum += 1;
  }

  const byLevel = new Map<number, StageGraphNode[]>();
  for (const n of nodes) {
    const bucket = byLevel.get(n.level) ?? [];
    bucket.push(n);
    byLevel.set(n.level, bucket);
  }
  let maxLanes = 0;
  const leveled: StageGraphNode[] = [];
  const levelCount = byLevel.size ? Math.max(...byLevel.keys()) + 1 : 0;
  for (let level = 0; level < levelCount; level += 1) {
    const bucket = (byLevel.get(level) ?? []).slice().sort((a, b) => {
      if (isJoinHubCode(a.code)) return -1;
      if (isJoinHubCode(b.code)) return 1;
      return a.lane - b.lane || a.sortOrder - b.sortOrder;
    });
    maxLanes = Math.max(maxLanes, bucket.length);
    bucket.forEach((n, lane) => {
      leveled.push({ ...n, level, lane });
    });
  }

  return {
    nodes: leveled,
    edges,
    levelCount,
    maxLanes,
    joins,
  };
}

/** Aggregate progress of feeder stages (DONE/SKIPPED = 100). */
export function joinHubProgress(
  feederCodes: string[],
  stageByCode: Map<string, { status: string; progressPercent: number }>,
): { percent: number; allDone: boolean } {
  if (feederCodes.length === 0) return { percent: 0, allDone: false };
  let sum = 0;
  let allDone = true;
  for (const code of feederCodes) {
    const s = stageByCode.get(code);
    const status = (s?.status ?? '').toUpperCase();
    const done = status === 'COMPLETED' || status === 'DONE' || status === 'SKIPPED';
    if (!done) allDone = false;
    const p = done ? 100 : Math.max(0, Math.min(100, Number(s?.progressPercent ?? 0)));
    sum += p;
  }
  return { percent: Math.round(sum / feederCodes.length), allDone };
}
