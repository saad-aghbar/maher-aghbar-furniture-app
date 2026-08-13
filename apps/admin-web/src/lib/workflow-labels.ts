import { localizedName } from '@maher/i18n';

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

/** Map a workflow version DAG to flow-map stages. Layout identity is the node id. */
export function workflowVersionToFlowStages(
  nodes: WorkflowNodeLike[],
  edges: WorkflowEdgeLike[],
  locale: string,
  extra?: Partial<Pick<FlowStageView, 'status' | 'progressPercent'>> & {
    errorIds?: Iterable<string>;
  },
): FlowStageView[] {
  const errorSet = new Set(extra?.errorIds ?? []);
  const deps = new Map<string, string[]>();
  for (const node of nodes) deps.set(node.id, []);
  for (const edge of edges) {
    const list = deps.get(edge.toNodeId) ?? [];
    list.push(edge.fromNodeId);
    deps.set(edge.toNodeId, list);
  }
  return [...nodes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((node, index) => ({
      id: node.id,
      code: node.id,
      name: nodeLabel(locale, node),
      status: extra?.status ?? 'PENDING',
      progressPercent: extra?.progressPercent ?? 0,
      dependsOnCodes: deps.get(node.id) ?? [],
      sortOrder: node.sortOrder ?? index,
      estimatedMinutes: node.defaultEstimatedMinutes ?? null,
      optional: node.isRequiredByDefault === false,
      hasError: errorSet.has(node.id),
    }));
}

const PREVIEW_ID = '__preview__';

export function previewFlowStages(args: {
  nodes: WorkflowNodeLike[];
  edges: WorkflowEdgeLike[];
  locale: string;
  previewName: string;
  runsAfterIds: string[];
  leadsIntoIds: string[];
  optional?: boolean;
}): FlowStageView[] {
  const previewNode: WorkflowNodeLike = {
    id: PREVIEW_ID,
    sortOrder: args.nodes.length,
    isRequiredByDefault: !args.optional,
    stageDefinition: {
      nameEn: args.previewName,
      nameAr: args.previewName,
      nameHe: args.previewName,
    },
  };
  const extraEdges: WorkflowEdgeLike[] = [
    ...args.runsAfterIds.map((fromNodeId) => ({ fromNodeId, toNodeId: PREVIEW_ID })),
    ...args.leadsIntoIds.map((toNodeId) => ({ fromNodeId: PREVIEW_ID, toNodeId })),
  ];
  return workflowVersionToFlowStages(
    [...args.nodes, previewNode],
    [...args.edges, ...extraEdges],
    args.locale,
  );
}

export { PREVIEW_ID };
