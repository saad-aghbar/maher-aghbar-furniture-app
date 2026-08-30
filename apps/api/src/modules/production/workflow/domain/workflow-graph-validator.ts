/** Pure DAG validation for production workflow templates. */

export type WorkflowValidationNode = {
  id: string;
  nodeKey: string;
};

export type WorkflowValidationEdge = {
  fromNodeId: string;
  toNodeId: string;
};

export type WorkflowValidationIssue = {
  code:
    | 'WORKFLOW_CYCLE'
    | 'WORKFLOW_SELF_LINK'
    | 'WORKFLOW_DUPLICATE_EDGE'
    | 'WORKFLOW_DUPLICATE_NODE_KEY'
    | 'WORKFLOW_INVALID_STAGE'
    | 'WORKFLOW_NO_ROOT'
    | 'WORKFLOW_NO_TERMINAL'
    | 'WORKFLOW_MULTIPLE_TERMINALS'
    | 'WORKFLOW_UNREACHABLE_STAGE'
    | 'OPENING_CHAIN_MISSING'
    | 'OPENING_CHAIN_DUPLICATE'
    | 'OPENING_CHAIN_NOT_ROOT'
    | 'OPENING_CHAIN_OPTIONAL_LOCKED'
    | 'TERMINAL_CHAIN_MISSING'
    | 'TERMINAL_CHAIN_DUPLICATE'
    | 'TERMINAL_CHAIN_ORDER'
    | 'TERMINAL_CHAIN_TERMINAL_NOT_DELIVERY'
    | 'TERMINAL_CHAIN_OPTIONAL_LOCKED';
  message: string;
  nodeIds?: string[];
};

export type WorkflowValidationResult = {
  ok: boolean;
  issues: WorkflowValidationIssue[];
};

export function validateWorkflowGraph(
  nodes: WorkflowValidationNode[],
  edges: WorkflowValidationEdge[],
  options?: { allowOrphans?: boolean },
): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const keyCounts = new Map<string, number>();

  for (const node of nodes) {
    keyCounts.set(node.nodeKey, (keyCounts.get(node.nodeKey) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      issues.push({
        code: 'WORKFLOW_DUPLICATE_NODE_KEY',
        message: `Duplicate nodeKey "${key}".`,
        nodeIds: nodes.filter((n) => n.nodeKey === key).map((n) => n.id),
      });
    }
  }

  const edgeKeys = new Set<string>();
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const outdegree = new Map<string, number>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    indegree.set(id, 0);
    outdegree.set(id, 0);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({
        code: 'WORKFLOW_INVALID_STAGE',
        message: 'Edge references a missing node.',
        nodeIds: [edge.fromNodeId, edge.toNodeId],
      });
      continue;
    }
    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({
        code: 'WORKFLOW_SELF_LINK',
        message: 'A stage cannot depend on itself.',
        nodeIds: [edge.fromNodeId],
      });
      continue;
    }
    const key = `${edge.fromNodeId}->${edge.toNodeId}`;
    if (edgeKeys.has(key)) {
      issues.push({
        code: 'WORKFLOW_DUPLICATE_EDGE',
        message: 'Duplicate dependency edge.',
        nodeIds: [edge.fromNodeId, edge.toNodeId],
      });
      continue;
    }
    edgeKeys.add(key);
    adjacency.get(edge.fromNodeId)!.push(edge.toNodeId);
    indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1);
    outdegree.set(edge.fromNodeId, (outdegree.get(edge.fromNodeId) ?? 0) + 1);
  }

  if (nodes.length === 0) {
    issues.push({
      code: 'WORKFLOW_NO_ROOT',
      message: 'Workflow has no stages.',
    });
    return { ok: false, issues };
  }

  const roots = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const terminals = [...outdegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);

  if (roots.length === 0) {
    issues.push({
      code: 'WORKFLOW_NO_ROOT',
      message: 'Workflow has no starting stage (every stage has a dependency).',
    });
  }
  if (terminals.length === 0) {
    issues.push({
      code: 'WORKFLOW_NO_TERMINAL',
      message: 'Workflow has no terminal stage (every stage has a successor).',
    });
  } else if (terminals.length > 1) {
    issues.push({
      code: 'WORKFLOW_MULTIPLE_TERMINALS',
      message:
        'Workflow has more than one terminal stage — every other stage must lead into the last one.',
      nodeIds: terminals,
    });
  }

  // Kahn cycle detection
  const queue = [...roots];
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adjacency.get(id) ?? []) {
      const nextIn = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIn);
      if (nextIn === 0) queue.push(next);
    }
  }

  if (visited.size !== nodes.length && edges.length > 0) {
    const cyclic = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    issues.push({
      code: 'WORKFLOW_CYCLE',
      message: 'Workflow contains a cycle and cannot be published.',
      nodeIds: cyclic,
    });
  }

  if (!options?.allowOrphans && roots.length > 0) {
    const reachable = new Set<string>();
    const q = [...roots];
    while (q.length) {
      const id = q.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const next of adjacency.get(id) ?? []) q.push(next);
    }
    const unreachable = nodes.filter((n) => !reachable.has(n.id));
    if (unreachable.length) {
      issues.push({
        code: 'WORKFLOW_UNREACHABLE_STAGE',
        message: 'Some stages are unreachable from any starting stage.',
        nodeIds: unreachable.map((n) => n.id),
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
