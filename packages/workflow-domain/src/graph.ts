import { OPENING_STAGE_CODE, TERMINAL_STAGE_CODES } from '@maher/types';
import type { WorkflowDomainEdge, WorkflowDomainNode } from './types';

export function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function isTerminalCode(code: string): boolean {
  return (TERMINAL_STAGE_CODES as readonly string[]).includes(code);
}

export function isOpeningCode(code: string): boolean {
  return code === OPENING_STAGE_CODE;
}

export function isProductionCode(code: string): boolean {
  return !isTerminalCode(code);
}

export function nodeById(nodes: WorkflowDomainNode[]): Map<string, WorkflowDomainNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function codeOf(nodes: WorkflowDomainNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.code ?? '';
}

export function buildPredMap(
  nodeIds: string[],
  edges: WorkflowDomainEdge[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const id of nodeIds) map[id] = [];
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!map[e.to]) map[e.to] = [];
    if (!map[e.from]) map[e.from] = [];
    map[e.to]!.push(e.from);
  }
  for (const id of Object.keys(map)) {
    map[id] = sortedUnique(map[id]!);
  }
  return map;
}

export function deriveSuccMap(
  nodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const id of nodeIds) map[id] = [];
  for (const [to, preds] of Object.entries(predecessorsByNode)) {
    for (const from of preds) {
      if (!map[from]) map[from] = [];
      map[from]!.push(to);
    }
  }
  for (const id of Object.keys(map)) {
    map[id] = sortedUnique(map[id]!);
  }
  return map;
}

export function edgesFromPredMap(
  predecessorsByNode: Record<string, string[]>,
): WorkflowDomainEdge[] {
  const edges: WorkflowDomainEdge[] = [];
  for (const [to, preds] of Object.entries(predecessorsByNode)) {
    for (const from of sortedUnique(preds)) {
      if (from === to) continue;
      edges.push({ from, to });
    }
  }
  return edges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0;
  });
}

export function isReachable(
  successorsByNode: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of successorsByNode[cur] ?? []) {
      if (next === to) return true;
      if (!seen.has(next)) stack.push(next);
    }
  }
  return false;
}

export function computeLevels(
  nodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): Record<string, number> {
  const levels: Record<string, number> = {};
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): number {
    if (visited.has(id)) return levels[id] ?? 0;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const preds = predecessorsByNode[id] ?? [];
    let level = 0;
    for (const p of preds) {
      level = Math.max(level, dfs(p) + 1);
    }
    visiting.delete(id);
    visited.add(id);
    levels[id] = level;
    return level;
  }

  for (const id of [...nodeIds].sort()) {
    dfs(id);
  }
  return levels;
}

export function hasCycle(
  nodeIds: string[],
  predecessorsByNode: Record<string, string[]>,
): boolean {
  const succ = deriveSuccMap(nodeIds, predecessorsByNode);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of succ[id] ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of nodeIds) {
    if (dfs(id)) return true;
  }
  return false;
}

export function edgePairs(edges: WorkflowDomainEdge[]): string[] {
  return edges.map((e) => `${e.from}->${e.to}`).sort();
}
