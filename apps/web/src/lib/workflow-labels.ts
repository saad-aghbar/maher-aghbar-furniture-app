import { localizedName } from '@maher/i18n';
import { canonicalizeWorkflowGraph, simulateWorkflowMutation, type PlacementIntent } from '@maher/workflow-domain';

export type FlowStageView = {
  id: string;
  code: string;
  name: string;
  status: string;
  progressPercent: number;
  dependsOnCodes: string[];
  sortOrder: number;
  estimatedMinutes?: number | null;
  optional?: boolean;
  hasError?: boolean;
};

export type NamedStage = {
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  code?: string;
};

export type WorkflowNodeLike = {
  id: string;
  sortOrder: number;
  isRequiredByDefault?: boolean;
  defaultEstimatedMinutes?: number | null;
  stageDefinition?: NamedStage | null;
};

export type WorkflowEdgeLike = { fromNodeId: string; toNodeId: string };

export function stageLabel(locale: string, stage: NamedStage, fallback = ''): string {
  return localizedName(locale, stage, fallback || stage.nameEn || stage.code || '');
}

export function nodeLabel(locale: string, node: WorkflowNodeLike): string {
  const def = node.stageDefinition;
  if (!def) return node.id;
  return stageLabel(locale, def);
}

/** Map a workflow version DAG to flow-map stages via canonical domain graph. */
export function workflowVersionToFlowStages(
  nodes: WorkflowNodeLike[],
  edges: WorkflowEdgeLike[],
  locale: string,
  extra?: Partial<Pick<FlowStageView, 'status' | 'progressPercent'>> & {
    errorIds?: Iterable<string>;
  },
): FlowStageView[] {
  const errorSet = new Set(extra?.errorIds ?? []);
  const domainNodes = nodes
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition!.code!,
      sortOrder: n.sortOrder,
    }));
  const domainEdges = edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId }));
  const graph = canonicalizeWorkflowGraph({ nodes: domainNodes, edges: domainEdges });

  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node, index) => ({
      id: node.id,
      code: node.id,
      name: nodeLabel(locale, node),
      status: extra?.status ?? 'PENDING',
      progressPercent: extra?.progressPercent ?? 0,
      dependsOnCodes: [...(graph.predecessorsByNode[node.id] ?? [])],
      sortOrder: node.sortOrder ?? index,
      estimatedMinutes: node.defaultEstimatedMinutes ?? null,
      optional: node.isRequiredByDefault === false,
      hasError: errorSet.has(node.id),
    }));
}

const PREVIEW_ID = '__preview__';

/** Preview via domain simulate — same semantics as mobile Add/Edit. */
export function previewFlowStagesFromPlacement(args: {
  nodes: WorkflowNodeLike[];
  edges: WorkflowEdgeLike[];
  locale: string;
  previewName: string;
  placement: PlacementIntent;
  /** When editing, replace this node id instead of adding PREVIEW_ID. */
  editNodeId?: string;
  optional?: boolean;
}): FlowStageView[] {
  const domainNodes = args.nodes
    .filter((n) => n.stageDefinition?.code)
    .map((n) => ({
      id: n.id,
      code: n.stageDefinition!.code!,
      sortOrder: n.sortOrder,
    }));
  const domainEdges = args.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId }));
  const base = canonicalizeWorkflowGraph({ nodes: domainNodes, edges: domainEdges });

  const simulated = args.editNodeId
    ? simulateWorkflowMutation(base, {
        kind: 'EDIT_PLACEMENT',
        nodeId: args.editNodeId,
        placement: args.placement,
      })
    : simulateWorkflowMutation(base, {
        kind: 'ADD',
        nodeId: PREVIEW_ID,
        code: 'YOU',
        placement: args.placement,
      });

  const previewNodeId = args.editNodeId ?? PREVIEW_ID;
  const labelNodes: WorkflowNodeLike[] = args.editNodeId
    ? args.nodes
    : [
        ...args.nodes,
        {
          id: PREVIEW_ID,
          sortOrder: 9999,
          stageDefinition: {
            code: 'YOU',
            nameEn: args.previewName,
            nameAr: args.previewName,
            nameHe: args.previewName,
          },
        },
      ];

  const idToName = new Map(labelNodes.map((n) => [n.id, nodeLabel(args.locale, n)]));
  if (!args.editNodeId) idToName.set(PREVIEW_ID, args.previewName);

  return simulated.nodes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((n, index) => {
      const src = labelNodes.find((x) => x.id === n.id);
      return {
        id: n.id,
        code: n.id,
        name: idToName.get(n.id) ?? n.code,
        status: n.id === previewNodeId ? 'READY' : 'PENDING',
        progressPercent: 0,
        dependsOnCodes: [...(simulated.predecessorsByNode[n.id] ?? [])],
        sortOrder: n.sortOrder ?? index,
        estimatedMinutes: src?.defaultEstimatedMinutes ?? null,
        optional: n.id === previewNodeId ? args.optional : src?.isRequiredByDefault === false,
      };
    });
}

/** @deprecated Prefer previewFlowStagesFromPlacement — leadsInto is no longer source of truth. */
export function previewFlowStages(args: {
  nodes: WorkflowNodeLike[];
  edges: WorkflowEdgeLike[];
  locale: string;
  previewName: string;
  runsAfterIds: string[];
  leadsIntoIds: string[];
  optional?: boolean;
}): FlowStageView[] {
  return previewFlowStagesFromPlacement({
    nodes: args.nodes,
    edges: args.edges,
    locale: args.locale,
    previewName: args.previewName,
    placement:
      args.runsAfterIds.length === 0
        ? { kind: 'START' }
        : { kind: 'AFTER', predecessorIds: args.runsAfterIds },
    optional: args.optional,
  });
}
