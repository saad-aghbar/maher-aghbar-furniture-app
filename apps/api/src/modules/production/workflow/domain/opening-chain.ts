/**
 * Locked opening stage: MATERIAL_PREP as a required root (no predecessors).
 * Compiler/publish are STRICT — never silently rewrite the graph here.
 * Auto-append helpers are authoring UX only (see planOpeningChainAppend).
 */

import type { WorkflowValidationIssue } from './workflow-graph-validator';
import { OPENING_STAGE_CODE } from './opening-constants';

export { OPENING_STAGE_CODE } from './opening-constants';

export type OpeningChainNode = {
  id: string;
  nodeKey: string;
  stageCode: string;
  isRequired?: boolean;
  isSkipped?: boolean;
};

export type OpeningChainEdge = {
  fromNodeId: string;
  toNodeId: string;
};

/**
 * Strict opening-chain invariant: exactly one MATERIAL_PREP, required, no inbound edges.
 */
export function validateOpeningChain(
  nodes: OpeningChainNode[],
  edges: OpeningChainEdge[],
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (nodes.length === 0) return issues;

  const matches = nodes.filter((n) => n.stageCode === OPENING_STAGE_CODE);
  if (matches.length === 0) {
    issues.push({
      code: 'OPENING_CHAIN_MISSING',
      message: `Workflow must include exactly one ${OPENING_STAGE_CODE} stage.`,
    });
    return issues;
  }
  if (matches.length > 1) {
    issues.push({
      code: 'OPENING_CHAIN_DUPLICATE',
      message: `Workflow must include exactly one ${OPENING_STAGE_CODE} stage (found ${matches.length}).`,
      nodeIds: matches.map((n) => n.id),
    });
    return issues;
  }

  const node = matches[0]!;
  if (node.isSkipped) {
    issues.push({
      code: 'OPENING_CHAIN_OPTIONAL_LOCKED',
      message: `${OPENING_STAGE_CODE} cannot be skipped or excluded.`,
      nodeIds: [node.id],
    });
  } else if (node.isRequired === false) {
    issues.push({
      code: 'OPENING_CHAIN_OPTIONAL_LOCKED',
      message: `${OPENING_STAGE_CODE} must remain required.`,
      nodeIds: [node.id],
    });
  }

  const inbound = edges.filter((e) => e.toNodeId === node.id);
  if (inbound.length > 0) {
    issues.push({
      code: 'OPENING_CHAIN_NOT_ROOT',
      message: `${OPENING_STAGE_CODE} must be a starting stage with no predecessors.`,
      nodeIds: [node.id, ...inbound.map((e) => e.fromNodeId)],
    });
  }

  return issues;
}

export type OpeningAppendPlan = {
  addStageCode: typeof OPENING_STAGE_CODE | null;
};

/**
 * Authoring UX helper: plan missing Material Prep. Never used inside compile.
 * Idempotent — empty when already present.
 */
export function planOpeningChainAppend(
  nodes: Array<{ stageCode: string }>,
): OpeningAppendPlan {
  const has = nodes.some((n) => n.stageCode === OPENING_STAGE_CODE);
  return { addStageCode: has ? null : OPENING_STAGE_CODE };
}
