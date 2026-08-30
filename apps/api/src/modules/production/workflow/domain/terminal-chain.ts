/**
 * Locked finishing chain: INSPECTION → PACKAGING → DELIVERY.
 * Compiler/publish are STRICT — never silently rewrite the graph here.
 * Auto-append helpers are authoring UX only (see planTerminalChainAppend).
 */

import type { WorkflowValidationIssue } from './workflow-graph-validator';

export const TERMINAL_STAGE_CODES = ['INSPECTION', 'PACKAGING', 'DELIVERY'] as const;
export type TerminalStageCode = (typeof TERMINAL_STAGE_CODES)[number];

export type TerminalChainNode = {
  id: string;
  nodeKey: string;
  stageCode: string;
  /** When false or skipped, locked stages are invalid. */
  isRequired?: boolean;
  isSkipped?: boolean;
};

export type TerminalChainEdge = {
  fromNodeId: string;
  toNodeId: string;
};

function hasDirectEdge(
  edges: TerminalChainEdge[],
  fromId: string,
  toId: string,
): boolean {
  return edges.some((e) => e.fromNodeId === fromId && e.toNodeId === toId);
}

/**
 * Strict terminal-chain invariant for included (non-excluded) workflow nodes.
 */
export function validateTerminalChain(
  nodes: TerminalChainNode[],
  edges: TerminalChainEdge[],
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (nodes.length === 0) return issues;

  const byCode = new Map<string, TerminalChainNode[]>();
  for (const n of nodes) {
    const list = byCode.get(n.stageCode) ?? [];
    list.push(n);
    byCode.set(n.stageCode, list);
  }

  for (const code of TERMINAL_STAGE_CODES) {
    const matches = byCode.get(code) ?? [];
    if (matches.length === 0) {
      issues.push({
        code: 'TERMINAL_CHAIN_MISSING',
        message: `Workflow must include exactly one ${code} stage.`,
      });
    } else if (matches.length > 1) {
      issues.push({
        code: 'TERMINAL_CHAIN_DUPLICATE',
        message: `Workflow must include exactly one ${code} stage (found ${matches.length}).`,
        nodeIds: matches.map((n) => n.id),
      });
    } else {
      const node = matches[0]!;
      if (node.isSkipped) {
        issues.push({
          code: 'TERMINAL_CHAIN_OPTIONAL_LOCKED',
          message: `${code} cannot be skipped or excluded.`,
          nodeIds: [node.id],
        });
      } else if (node.isRequired === false) {
        issues.push({
          code: 'TERMINAL_CHAIN_OPTIONAL_LOCKED',
          message: `${code} must remain required.`,
          nodeIds: [node.id],
        });
      }
    }
  }

  const inspection = byCode.get('INSPECTION')?.[0];
  const packaging = byCode.get('PACKAGING')?.[0];
  const delivery = byCode.get('DELIVERY')?.[0];
  if (!inspection || !packaging || !delivery) {
    return issues;
  }

  if (!hasDirectEdge(edges, inspection.id, packaging.id)) {
    issues.push({
      code: 'TERMINAL_CHAIN_ORDER',
      message: 'INSPECTION must have a hard dependency edge into PACKAGING.',
      nodeIds: [inspection.id, packaging.id],
    });
  }
  if (!hasDirectEdge(edges, packaging.id, delivery.id)) {
    issues.push({
      code: 'TERMINAL_CHAIN_ORDER',
      message: 'PACKAGING must have a hard dependency edge into DELIVERY.',
      nodeIds: [packaging.id, delivery.id],
    });
  }

  const outdegree = new Map<string, number>();
  for (const n of nodes) outdegree.set(n.id, 0);
  for (const e of edges) {
    if (outdegree.has(e.fromNodeId)) {
      outdegree.set(e.fromNodeId, (outdegree.get(e.fromNodeId) ?? 0) + 1);
    }
  }

  const terminals = nodes.filter((n) => (outdegree.get(n.id) ?? 0) === 0);
  if (terminals.length === 1 && terminals[0]!.id !== delivery.id) {
    issues.push({
      code: 'TERMINAL_CHAIN_TERMINAL_NOT_DELIVERY',
      message: 'The unique terminal stage must be DELIVERY.',
      nodeIds: [terminals[0]!.id, delivery.id],
    });
  }
  if ((outdegree.get(delivery.id) ?? 0) > 0) {
    issues.push({
      code: 'TERMINAL_CHAIN_ORDER',
      message: 'DELIVERY must have no successor stages.',
      nodeIds: [delivery.id],
    });
  }

  return issues;
}

export type TerminalAppendPlan = {
  addStageCodes: TerminalStageCode[];
  /** Edges to add as [fromStageCode, toStageCode] after nodes exist. */
  addEdges: Array<[string, string]>;
};

/**
 * Authoring UX helper: plan missing locked stages/edges. Never used inside compile.
 * Idempotent — empty when the chain is already present.
 */
export function planTerminalChainAppend(
  nodes: Array<{ stageCode: string }>,
  edges: Array<{ fromStageCode: string; toStageCode: string }>,
): TerminalAppendPlan {
  const codes = new Set(nodes.map((n) => n.stageCode));
  const edgeSet = new Set(edges.map((e) => `${e.fromStageCode}->${e.toStageCode}`));
  const addStageCodes: TerminalStageCode[] = [];
  for (const code of TERMINAL_STAGE_CODES) {
    if (!codes.has(code)) addStageCodes.push(code);
  }

  const addEdges: Array<[string, string]> = [];
  const ensureEdge = (from: string, to: string) => {
    if (!edgeSet.has(`${from}->${to}`)) {
      addEdges.push([from, to]);
      edgeSet.add(`${from}->${to}`);
    }
  };

  ensureEdge('INSPECTION', 'PACKAGING');
  ensureEdge('PACKAGING', 'DELIVERY');

  return { addStageCodes, addEdges };
}

export function executionKindForStageCode(
  code: string,
): 'PRODUCTION' | 'QUALITY' | 'LOGISTICS' {
  if (code === 'INSPECTION' || code === 'QC' || code === 'QUALITY') return 'QUALITY';
  if (code === 'DELIVERY') return 'LOGISTICS';
  return 'PRODUCTION';
}
