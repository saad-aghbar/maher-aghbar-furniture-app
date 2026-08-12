export type WorkflowGraphNodeStatus =
  | 'PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'BLOCKED';

export type WorkflowGraphEdgeDTO = {
  fromNodeKey: string;
  toNodeKey: string;
  dependencyType: 'HARD';
};

export type WorkflowGraphNodeBaseDTO = {
  nodeKey: string;
  stageCode: string;
  nameAr: string;
  nameEn: string;
  nameHe: string | null;
  sortOrder: number;
  dependsOnKeys: string[];
  status: WorkflowGraphNodeStatus;
  progressPercent: number;
  isRequired: boolean;
  isSkipped: boolean;
  level?: number;
  lane?: number;
  displayX?: number | null;
  displayY?: number | null;
};

/** Dealer-safe workflow graph node (no factory internals). */
export type WorkflowGraphNodeDealerDTO = WorkflowGraphNodeBaseDTO;

export type WorkflowGraphAssigneeDTO = {
  id: string;
  name: string;
  elapsedMinutes: number;
  actualMinutes: number;
  actualSeconds: number;
  running: boolean;
  openStartedAt: string | null;
  estimatedMinutes: number | null;
  plannedCompletion: string | null;
};

export type WorkflowGraphBlockerDTO = {
  id: string;
  category: string;
  reason: string;
};

/** Admin-enriched workflow graph node. */
export type WorkflowGraphNodeAdminDTO = WorkflowGraphNodeDealerDTO & {
  estimatedMinutes: number | null;
  estimateReviewRequired: boolean;
  responsibleDepartmentCode: string | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  actualStart: string | null;
  actualEnd: string | null;
  plannedEnd: string | null;
  notes: string | null;
  isOverdue: boolean;
  assignees: WorkflowGraphAssigneeDTO[];
  blockers: WorkflowGraphBlockerDTO[];
  attachmentCount: number;
};

export type WorkflowGraphDTOBase = {
  edges: WorkflowGraphEdgeDTO[];
  levelCount: number;
  maxLanes: number;
  progressPercent: number;
  sourceWorkflowCode: string | null;
  sourceVersionNumber: number | null;
  isCustomized: boolean;
  isLegacyBackfill: boolean;
};

export type WorkflowGraphDealerDTO = WorkflowGraphDTOBase & {
  nodes: WorkflowGraphNodeDealerDTO[];
};

export type WorkflowGraphAdminDTO = WorkflowGraphDTOBase & {
  nodes: WorkflowGraphNodeAdminDTO[];
};

export type WorkflowGraphDTO = WorkflowGraphDealerDTO | WorkflowGraphAdminDTO;

export function isWorkflowGraphAdminDTO(
  graph: WorkflowGraphDTO,
): graph is WorkflowGraphAdminDTO {
  const first = graph.nodes[0];
  if (!first) return false;
  return 'assignees' in first;
}
