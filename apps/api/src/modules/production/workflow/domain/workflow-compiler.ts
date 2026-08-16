/**
 * Pure workflow compiler: version graph + product/order overrides → compiled DAG.
 * Excluded nodes are removed and edges are rewritten across gaps.
 */

import {
  validateWorkflowGraph,
  type WorkflowValidationIssue,
} from './workflow-graph-validator';

export type Applicability = 'INHERIT' | 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED';

export type CompilerStageDef = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
  resourceSlots?: number | null;
};

export type CompilerNode = {
  id: string;
  nodeKey: string;
  stageDefinitionId: string;
  sortOrder: number;
  displayX?: number | null;
  displayY?: number | null;
  isRequiredByDefault: boolean;
  canBeSkipped: boolean;
  defaultEstimatedMinutes?: number | null;
  responsibleDepartmentId?: string | null;
  requiresInspectionOverride?: boolean | null;
  requiresPhotosOverride?: boolean | null;
  inventoryTracking?: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED' | null;
  consumesRawMaterials?: boolean | null;
  consumesSemiFinished?: boolean | null;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
  resourceSlots?: number | null;
  outputQtyPerUnit?: number | null;
  outputNameAr?: string | null;
  outputNameEn?: string | null;
  outputNameHe?: string | null;
  defaultWarehouseId?: string | null;
  metadata?: unknown;
  stage: CompilerStageDef;
};

export type CompilerEdge = {
  fromNodeId: string;
  toNodeId: string;
  dependencyType?: 'HARD';
};

export type CompilerProductOverride = {
  workflowNodeId?: string | null;
  stageDefinitionId: string;
  applicability: Applicability;
  estimatedMinutes?: number | null;
  responsibleDepartmentId?: string | null;
};

export type CompilerOrderOverride = {
  nodeKey: string;
  applicability?: Applicability;
  estimatedMinutes?: number | null;
  skip?: boolean;
  skipReason?: string | null;
  responsibleDepartmentId?: string | null;
};

export type CompiledNode = {
  sourceWorkflowNodeId: string;
  nodeKey: string;
  stageDefinitionId: string;
  stageCode: string;
  nameAr: string;
  nameEn: string;
  nameHe: string | null;
  isRequired: boolean;
  isSkipped: boolean;
  skipReason: string | null;
  estimatedMinutes: number | null;
  estimateReviewRequired: boolean;
  responsibleDepartmentId: string | null;
  responsibleDepartmentCode: string | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  inventoryTracking: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  schedulingResourceMode: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
  resourceSlots: number;
  outputQtyPerUnit: number | null;
  outputNameAr: string | null;
  outputNameEn: string | null;
  outputNameHe: string | null;
  defaultWarehouseId: string | null;
  sortOrder: number;
  displayX: number | null;
  displayY: number | null;
  metadata: unknown;
};

export type CompiledEdge = {
  fromNodeKey: string;
  toNodeKey: string;
  dependencyType: 'HARD';
};

export type CompiledProductionWorkflow = {
  included: CompiledNode[];
  excluded: CompiledNode[];
  edges: CompiledEdge[];
  roots: string[];
  terminals: string[];
  dependencyMap: Record<string, string[]>;
  downstreamMap: Record<string, string[]>;
  topologicalOrder: string[];
  issues: WorkflowValidationIssue[];
};

function resolveApplicability(
  node: CompilerNode,
  product?: CompilerProductOverride,
  order?: CompilerOrderOverride,
): 'REQUIRED' | 'OPTIONAL' | 'EXCLUDED' {
  if (order?.applicability && order.applicability !== 'INHERIT') {
    return order.applicability;
  }
  if (product?.applicability && product.applicability !== 'INHERIT') {
    return product.applicability;
  }
  if (node.isRequiredByDefault) return 'REQUIRED';
  if (node.canBeSkipped) return 'OPTIONAL';
  return 'REQUIRED';
}

function hoursToMinutes(hours?: number | null): number | null {
  if (hours == null || Number.isNaN(Number(hours))) return null;
  return Math.round(Number(hours) * 60);
}

export function compileWorkflow(input: {
  nodes: CompilerNode[];
  edges: CompilerEdge[];
  productOverrides?: CompilerProductOverride[];
  orderOverrides?: CompilerOrderOverride[];
  /** product stage estimate minutes by stageDefinitionId */
  productEstimateMinutes?: Record<string, number | null | undefined>;
}): CompiledProductionWorkflow {
  const productByNode = new Map<string, CompilerProductOverride>();
  const productByStage = new Map<string, CompilerProductOverride>();
  for (const o of input.productOverrides ?? []) {
    if (o.workflowNodeId) productByNode.set(o.workflowNodeId, o);
    productByStage.set(o.stageDefinitionId, o);
  }
  const orderByKey = new Map((input.orderOverrides ?? []).map((o) => [o.nodeKey, o]));

  const included: CompiledNode[] = [];
  const excluded: CompiledNode[] = [];
  const includedIds = new Set<string>();

  for (const node of input.nodes) {
    const product =
      productByNode.get(node.id) ?? productByStage.get(node.stageDefinitionId);
    const order = orderByKey.get(node.nodeKey);
    const applicability = resolveApplicability(node, product, order);

    const estimateFromOrder = order?.estimatedMinutes;
    const estimateFromProductOverride = product?.estimatedMinutes;
    const estimateFromProductEstimate =
      input.productEstimateMinutes?.[node.stageDefinitionId] ?? null;
    const estimateFromNode = node.defaultEstimatedMinutes ?? null;
    const estimateFromStage = hoursToMinutes(node.stage.estimatedHours);

    let estimatedMinutes =
      estimateFromOrder ??
      estimateFromProductOverride ??
      estimateFromProductEstimate ??
      estimateFromNode ??
      estimateFromStage ??
      null;

    const estimateReviewRequired = estimatedMinutes == null || estimatedMinutes <= 0;
    if (estimateReviewRequired) estimatedMinutes = null;

    const compiled: CompiledNode = {
      sourceWorkflowNodeId: node.id,
      nodeKey: node.nodeKey,
      stageDefinitionId: node.stageDefinitionId,
      stageCode: node.stage.code,
      nameAr: node.stage.nameAr,
      nameEn: node.stage.nameEn,
      nameHe: node.stage.nameHe ?? null,
      isRequired: applicability === 'REQUIRED',
      isSkipped: Boolean(order?.skip) || applicability === 'EXCLUDED',
      skipReason: order?.skipReason ?? (applicability === 'EXCLUDED' ? 'EXCLUDED' : null),
      estimatedMinutes,
      estimateReviewRequired,
      responsibleDepartmentId:
        order?.responsibleDepartmentId ??
        product?.responsibleDepartmentId ??
        node.responsibleDepartmentId ??
        null,
      responsibleDepartmentCode: node.stage.responsibleDepartment ?? null,
      requiresInspection:
        node.requiresInspectionOverride ?? node.stage.requiresInspection,
      requiresPhotos: node.requiresPhotosOverride ?? node.stage.requiresPhotos,
      inventoryTracking: node.inventoryTracking ?? 'NONE',
      consumesRawMaterials: Boolean(node.consumesRawMaterials),
      consumesSemiFinished: Boolean(node.consumesSemiFinished),
      schedulingResourceMode:
        node.schedulingResourceMode ??
        node.stage.schedulingResourceMode ??
        'WORKER_CONSTRAINED',
      resourceSlots: node.resourceSlots ?? node.stage.resourceSlots ?? 1,
      outputQtyPerUnit: node.outputQtyPerUnit ?? null,
      outputNameAr: node.outputNameAr ?? null,
      outputNameEn: node.outputNameEn ?? null,
      outputNameHe: node.outputNameHe ?? null,
      defaultWarehouseId: node.defaultWarehouseId ?? null,
      sortOrder: node.sortOrder,
      displayX: node.displayX ?? null,
      displayY: node.displayY ?? null,
      metadata: node.metadata ?? null,
    };

    // OPTIONAL default: include unless product/order set EXCLUDED or order.skip
    if (applicability === 'EXCLUDED' || order?.skip) {
      excluded.push({ ...compiled, isSkipped: true });
      continue;
    }
    // OPTIONAL with no explicit exclude → include as optional (isRequired false)
    if (applicability === 'OPTIONAL') {
      compiled.isRequired = false;
    }
    included.push(compiled);
    includedIds.add(node.id);
  }

  // Rewrite edges across excluded nodes (transitive bridge)
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of input.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of input.edges) {
    outgoing.get(e.fromNodeId)?.push(e.toNodeId);
    incoming.get(e.toNodeId)?.push(e.fromNodeId);
  }

  const idToKey = new Map(input.nodes.map((n) => [n.id, n.nodeKey]));
  const edgeSet = new Set<string>();
  const compiledEdges: CompiledEdge[] = [];

  function ancestorsIncluded(nodeId: string, seen = new Set<string>()): string[] {
    const result: string[] = [];
    for (const pred of incoming.get(nodeId) ?? []) {
      if (seen.has(pred)) continue;
      seen.add(pred);
      if (includedIds.has(pred)) result.push(pred);
      else result.push(...ancestorsIncluded(pred, seen));
    }
    return result;
  }

  for (const node of input.nodes) {
    if (!includedIds.has(node.id)) continue;
    for (const succ of outgoing.get(node.id) ?? []) {
      if (includedIds.has(succ)) {
        const fromKey = idToKey.get(node.id)!;
        const toKey = idToKey.get(succ)!;
        const key = `${fromKey}->${toKey}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          compiledEdges.push({ fromNodeKey: fromKey, toNodeKey: toKey, dependencyType: 'HARD' });
        }
      } else {
        // bridge through excluded: find included descendants
        const stack = [...(outgoing.get(succ) ?? [])];
        const visited = new Set<string>([succ]);
        while (stack.length) {
          const cur = stack.pop()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          if (includedIds.has(cur)) {
            const fromKey = idToKey.get(node.id)!;
            const toKey = idToKey.get(cur)!;
            const key = `${fromKey}->${toKey}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              compiledEdges.push({
                fromNodeKey: fromKey,
                toNodeKey: toKey,
                dependencyType: 'HARD',
              });
            }
          } else {
            stack.push(...(outgoing.get(cur) ?? []));
          }
        }
      }
    }
  }

  // Also bridge when predecessor excluded: included node may need ancestors of excluded preds
  for (const node of input.nodes) {
    if (!includedIds.has(node.id)) continue;
    for (const pred of incoming.get(node.id) ?? []) {
      if (includedIds.has(pred)) continue;
      for (const anc of ancestorsIncluded(pred)) {
        const fromKey = idToKey.get(anc)!;
        const toKey = idToKey.get(node.id)!;
        const key = `${fromKey}->${toKey}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          compiledEdges.push({
            fromNodeKey: fromKey,
            toNodeKey: toKey,
            dependencyType: 'HARD',
          });
        }
      }
    }
  }

  included.sort((a, b) => a.sortOrder - b.sortOrder);

  // Transitive reduction: drop A→C when A→…→C already exists via included nodes
  const reducedEdges = transitiveReduce(compiledEdges, included.map((n) => n.nodeKey));

  const dependencyMap: Record<string, string[]> = {};
  const downstreamMap: Record<string, string[]> = {};
  for (const n of included) {
    dependencyMap[n.nodeKey] = [];
    downstreamMap[n.nodeKey] = [];
  }
  for (const e of reducedEdges) {
    dependencyMap[e.toNodeKey]?.push(e.fromNodeKey);
    downstreamMap[e.fromNodeKey]?.push(e.toNodeKey);
  }

  const indeg = new Map(included.map((n) => [n.nodeKey, 0]));
  for (const e of reducedEdges) {
    indeg.set(e.toNodeKey, (indeg.get(e.toNodeKey) ?? 0) + 1);
  }
  const roots = [...indeg.entries()].filter(([, d]) => d === 0).map(([k]) => k);
  const terminals = included
    .filter((n) => (downstreamMap[n.nodeKey] ?? []).length === 0)
    .map((n) => n.nodeKey);

  const topologicalOrder: string[] = [];
  const q = [...roots];
  const localIndeg = new Map(indeg);
  while (q.length) {
    const key = q.shift()!;
    topologicalOrder.push(key);
    for (const next of downstreamMap[key] ?? []) {
      const d = (localIndeg.get(next) ?? 0) - 1;
      localIndeg.set(next, d);
      if (d === 0) q.push(next);
    }
  }

  const validationNodes = included.map((n) => ({ id: n.nodeKey, nodeKey: n.nodeKey }));
  const validationEdges = reducedEdges.map((e) => ({
    fromNodeId: e.fromNodeKey,
    toNodeId: e.toNodeKey,
  }));
  const validation = validateWorkflowGraph(validationNodes, validationEdges);

  return {
    included,
    excluded,
    edges: reducedEdges,
    roots,
    terminals,
    dependencyMap,
    downstreamMap,
    topologicalOrder,
    issues: validation.issues,
  };
}

function transitiveReduce(edges: CompiledEdge[], nodeKeys: string[]): CompiledEdge[] {
  const down = new Map<string, string[]>();
  for (const k of nodeKeys) down.set(k, []);
  for (const e of edges) down.get(e.fromNodeKey)?.push(e.toNodeKey);

  return edges.filter((e) => {
    const alt = new Map(down);
    alt.set(
      e.fromNodeKey,
      (alt.get(e.fromNodeKey) ?? []).filter((x) => x !== e.toNodeKey),
    );
    function reach(from: string, to: string, seen = new Set<string>()): boolean {
      for (const next of alt.get(from) ?? []) {
        if (next === to) return true;
        if (seen.has(next)) continue;
        seen.add(next);
        if (reach(next, to, seen)) return true;
      }
      return false;
    }
    // Drop edge if another path already connects from → to
    return !reach(e.fromNodeKey, e.toNodeKey);
  });
}
