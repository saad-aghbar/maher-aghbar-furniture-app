import type { StageGraphNode } from './types';

export interface DependencyGraph {
  nodes: Map<string, StageGraphNode>;
  /** code → codes that depend on it */
  dependents: Map<string, string[]>;
  /** code → direct parent codes (filtered to known nodes) */
  parents: Map<string, string[]>;
}

export function buildDependencyGraph(stages: StageGraphNode[]): DependencyGraph {
  const nodes = new Map<string, StageGraphNode>();
  for (const stage of stages) {
    nodes.set(stage.code, {
      ...stage,
      dependsOnCodes: [...(stage.dependsOnCodes ?? [])],
    });
  }

  const parents = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const code of nodes.keys()) {
    parents.set(code, []);
    dependents.set(code, []);
  }

  for (const stage of nodes.values()) {
    const knownParents = stage.dependsOnCodes.filter((p) => nodes.has(p));
    parents.set(stage.code, knownParents);
    for (const parent of knownParents) {
      dependents.get(parent)!.push(stage.code);
    }
  }

  return { nodes, dependents, parents };
}

/** Returns codes involved in a cycle, or empty if DAG is acyclic. */
export function detectCycles(graph: DependencyGraph): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycle: string[] = [];

  const dfs = (code: string, stack: string[]): boolean => {
    if (visiting.has(code)) {
      const idx = stack.indexOf(code);
      cycle.push(...stack.slice(idx), code);
      return true;
    }
    if (visited.has(code)) return false;

    visiting.add(code);
    stack.push(code);
    for (const child of graph.dependents.get(code) ?? []) {
      if (dfs(child, stack)) return true;
    }
    stack.pop();
    visiting.delete(code);
    visited.add(code);
    return false;
  };

  for (const code of graph.nodes.keys()) {
    if (!visited.has(code) && dfs(code, [])) break;
  }

  return cycle;
}

/**
 * Kahn-style topological layers. Parallel-ready stages share a layer.
 * Throws if the graph has a cycle.
 */
export function topologicalLayers(graph: DependencyGraph): string[][] {
  const cycle = detectCycles(graph);
  if (cycle.length > 0) {
    throw new Error(`Dependency cycle detected: ${cycle.join(' -> ')}`);
  }

  const indegree = new Map<string, number>();
  for (const code of graph.nodes.keys()) {
    indegree.set(code, (graph.parents.get(code) ?? []).length);
  }

  const layers: string[][] = [];
  let frontier = [...graph.nodes.keys()]
    .filter((c) => indegree.get(c) === 0)
    .sort((a, b) => a.localeCompare(b));

  let remaining = graph.nodes.size;
  while (frontier.length > 0) {
    layers.push(frontier);
    remaining -= frontier.length;
    const next: string[] = [];
    for (const code of frontier) {
      for (const child of graph.dependents.get(code) ?? []) {
        const d = (indegree.get(child) ?? 0) - 1;
        indegree.set(child, d);
        if (d === 0) next.push(child);
      }
    }
    frontier = next.sort((a, b) => a.localeCompare(b));
  }

  if (remaining !== 0) {
    throw new Error('Dependency cycle detected during layering');
  }

  return layers;
}

/** True when every known parent of `code` is in `completedCodes`. */
export function areParentsReady(
  code: string,
  completedCodes: Iterable<string>,
  graph: DependencyGraph,
): boolean {
  const done = completedCodes instanceof Set ? completedCodes : new Set(completedCodes);
  const parents = graph.parents.get(code) ?? [];
  return parents.every((p) => done.has(p));
}

/** Earliest start = max(parent ends), or null if no parents. */
export function mergeWaitInstant(
  code: string,
  parentEnds: Map<string, Date>,
  graph: DependencyGraph,
): Date | null {
  const parents = graph.parents.get(code) ?? [];
  if (parents.length === 0) return null;
  let max: Date | null = null;
  for (const p of parents) {
    const end = parentEnds.get(p);
    if (!end) return null;
    if (!max || end.getTime() > max.getTime()) max = end;
  }
  return max;
}
