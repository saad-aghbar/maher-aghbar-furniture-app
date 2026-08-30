import { OPENING_STAGE_CODE } from '@maher/types';
import { hasCycle, isOpeningCode, isProductionCode, isReachable, sortedUnique } from './graph';
import { transitiveReduceProduction } from './transitiveReduction';
import type {
  CanonicalWorkflowGraph,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from './types';

export type ValidateOptions = {
  /** Node ids that are allowed to have empty preds beyond Material Prep (explicit START). */
  explicitStartIds?: ReadonlySet<string>;
};

export function validateCanonicalWorkflowGraph(
  graph: CanonicalWorkflowGraph,
  options: ValidateOptions = {},
): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const explicitStarts = options.explicitStartIds ?? new Set<string>();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodeIds = graph.nodes.map((n) => n.id);

  if (hasCycle(nodeIds, graph.predecessorsByNode)) {
    issues.push({ code: 'CYCLE', message: 'Graph contains a cycle' });
  }

  // Duplicate / self edges
  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === e.to) {
      issues.push({ code: 'SELF_EDGE', message: `Self edge on ${e.from}`, nodeId: e.from });
    }
    const key = `${e.from}->${e.to}`;
    if (seen.has(key)) {
      issues.push({ code: 'DUPLICATE_EDGE', message: `Duplicate edge ${key}` });
    }
    seen.add(key);
  }

  if (!graph.inspectionNodeId) {
    issues.push({ code: 'TERMINAL_MISSING', message: 'Missing INSPECTION' });
  }
  if (!graph.packagingNodeId) {
    issues.push({ code: 'TERMINAL_MISSING', message: 'Missing PACKAGING' });
  }
  if (!graph.deliveryNodeId) {
    issues.push({ code: 'TERMINAL_MISSING', message: 'Missing DELIVERY' });
  }

  if (graph.inspectionNodeId && graph.packagingNodeId) {
    const packPreds = graph.predecessorsByNode[graph.packagingNodeId] ?? [];
    if (packPreds.length !== 1 || packPreds[0] !== graph.inspectionNodeId) {
      issues.push({
        code: 'TERMINAL_ORDER',
        message: 'Packaging must depend only on Inspection',
        nodeId: graph.packagingNodeId,
      });
    }
  }
  if (graph.packagingNodeId && graph.deliveryNodeId) {
    const delPreds = graph.predecessorsByNode[graph.deliveryNodeId] ?? [];
    if (delPreds.length !== 1 || delPreds[0] !== graph.packagingNodeId) {
      issues.push({
        code: 'TERMINAL_ORDER',
        message: 'Delivery must depend only on Packaging',
        nodeId: graph.deliveryNodeId,
      });
    }
  }

  // Inspection = frontier
  if (graph.inspectionNodeId) {
    const inspPreds = sortedUnique(graph.predecessorsByNode[graph.inspectionNodeId] ?? []);
    const frontier = sortedUnique(graph.frontierNodeIds);
    if (inspPreds.join(',') !== frontier.join(',')) {
      issues.push({
        code: 'INSPECTION_FRONTIER',
        message: `Inspection preds [${inspPreds}] != frontier [${frontier}]`,
        nodeId: graph.inspectionNodeId,
      });
    }
  }

  // No production → Packaging/Delivery
  for (const e of graph.edges) {
    const toCode = byId.get(e.to)?.code ?? '';
    const fromCode = byId.get(e.from)?.code ?? '';
    if ((toCode === 'PACKAGING' || toCode === 'DELIVERY') && isProductionCode(fromCode)) {
      issues.push({
        code: 'PROD_TO_TERMINAL',
        message: `Production ${e.from} must not edge to ${toCode}`,
        nodeId: e.from,
      });
    }
  }

  // Roots
  for (const id of graph.productionNodeIds) {
    const node = byId.get(id)!;
    const preds = graph.predecessorsByNode[id] ?? [];
    if (preds.length === 0) {
      const allowed =
        isOpeningCode(node.code) ||
        node.code === OPENING_STAGE_CODE ||
        explicitStarts.has(id);
      if (!allowed) {
        const label = node.code.replace(/_/g, ' ').toLowerCase();
        issues.push({
          code: 'ILLEGAL_ROOT',
          message: `${label} can’t float on its own — place it After or Parallel with another stage, or mark it Start.`,
          nodeId: id,
        });
      }
    }
  }

  // Reach Inspection
  if (graph.inspectionNodeId) {
    for (const id of graph.productionNodeIds) {
      if (!isReachable(graph.successorsByNode, id, graph.inspectionNodeId)) {
        issues.push({
          code: 'UNREACHABLE_INSPECTION',
          message: `${id} cannot reach Inspection`,
          nodeId: id,
        });
      }
    }
  }

  // No redundant transitive production edges
  const reduced = transitiveReduceProduction(
    graph.productionNodeIds,
    graph.predecessorsByNode,
  );
  for (const id of graph.productionNodeIds) {
    const a = sortedUnique(graph.predecessorsByNode[id] ?? []).join(',');
    const b = sortedUnique(reduced[id] ?? []).join(',');
    if (a !== b) {
      issues.push({
        code: 'REDUNDANT_EDGE',
        message: `Node ${id} has redundant predecessors`,
        nodeId: id,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
