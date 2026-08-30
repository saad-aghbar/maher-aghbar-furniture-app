import { apiGet, apiPatch, apiPost, apiDelete, apiPut } from '../client';

export type WorkflowListItem = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  status: string;
  activeVersion?: {
    id: string;
    versionNumber: number;
    status: string;
    _count?: { nodes: number; edges: number };
  } | null;
  _count?: { versions: number };
};

export type StageDefinition = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  isActive: boolean;
  estimatedHours?: number | null;
  requiresInspection?: boolean;
  requiresPhotos?: boolean;
  responsibleDepartment?: string | null;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
  resourceSlots?: number | null;
};

export type WorkflowNode = {
  id: string;
  nodeKey: string;
  sortOrder: number;
  isRequiredByDefault: boolean;
  canBeSkipped: boolean;
  /** Present when the API includes the relation; may be missing on lean payloads. */
  stageDefinition?: StageDefinition | null;
};

export type WorkflowEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
};

export type WorkflowVersion = {
  id: string;
  versionNumber: number;
  status: string;
  revision: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type WorkflowDetail = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  status: string;
  activeVersion?: WorkflowVersion | null;
  versions: Array<{ id: string; versionNumber: number; status: string }>;
};

export type OrderWorkflowStage = {
  id: string;
  code: string;
  nodeKey?: string;
  stageDefinitionId?: string | null;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  status: string;
  progressPercent: number;
  isOptional?: boolean;
  isSkipped?: boolean;
  estimateReviewRequired?: boolean;
  assignedEmployee?: { id: string; name: string } | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualMinutes?: number | null;
  estimatedMinutes?: number | null;
  notes?: string | null;
  blockers?: Array<{ id: string; category: string; reason: string }>;
};

export type OrderWorkflowGraph = {
  productionOrderId: string;
  progressPercent: number;
  sourceVersionNumber: number | null;
  isLegacy: boolean;
  needsWorkflow?: boolean;
  stages: OrderWorkflowStage[];
  edges: Array<{ from: string; to: string }>;
};

export type AssignableWorker = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  username?: string | null;
};

export type ProductWorkflowConfig = {
  id: string;
  productId: string;
  workflowId: string;
  workflow: WorkflowListItem;
};

export function listWorkflows() {
  return apiGet<WorkflowListItem[]>('/production-workflows');
}

export function getWorkflow(id: string) {
  return apiGet<WorkflowDetail>(`/production-workflows/${id}`);
}

export function createWorkflow(body: {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string;
}) {
  return apiPost<WorkflowDetail>('/production-workflows', body);
}

export function archiveWorkflow(id: string) {
  return apiDelete<{ archived: boolean; id: string }>(`/production-workflows/${id}`);
}

export function createDraftVersion(workflowId: string, fromVersionId?: string) {
  return apiPost<WorkflowVersion>(`/production-workflows/${workflowId}/versions`, {
    fromVersionId,
  });
}

export function getWorkflowVersion(workflowId: string, versionId: string) {
  return apiGet<WorkflowVersion>(`/production-workflows/${workflowId}/versions/${versionId}`);
}

export function listStageLibrary() {
  return apiGet<StageDefinition[]>('/production-stage-library');
}

export function createStageDefinition(body: {
  code?: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string;
  workerIds?: string[];
  estimatedHours?: number;
  requiresInspection?: boolean;
  requiresPhotos?: boolean;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
  resourceSlots?: number;
}) {
  return apiPost<StageDefinition>('/production-stage-library', body);
}

export function updateStageDefinition(
  stageId: string,
  body: {
    nameEn?: string;
    nameAr?: string;
    nameHe?: string | null;
    responsibleDepartment?: string | null;
    estimatedHours?: number | null;
    requiresInspection?: boolean;
    requiresPhotos?: boolean;
    schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED';
    resourceSlots?: number;
  },
) {
  return apiPatch<StageDefinition>(`/production-stage-library/${stageId}`, body);
}

export function deleteStageDefinition(stageId: string) {
  return apiDelete<{ id: string; deleted?: boolean; isActive?: boolean }>(
    `/production-stage-library/${stageId}`,
  );
}

export function listStageWorkers(stageId: string) {
  return apiGet<AssignableWorker[]>(`/production-stage-library/${stageId}/workers`);
}

export function setStageWorkers(stageId: string, userIds: string[]) {
  return apiPut<AssignableWorker[]>(`/production-stage-library/${stageId}/workers`, { userIds });
}

export function listAssignableWorkers(q?: string, stageDefinitionId?: string) {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  if (stageDefinitionId?.trim()) params.set('stageDefinitionId', stageDefinitionId.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<AssignableWorker[]>(`/production-orders/assignable-workers${qs}`);
}

export function addWorkflowNode(
  workflowId: string,
  versionId: string,
  body: {
    stageDefinitionId: string;
    nodeKey?: string;
    sortOrder?: number;
    isRequiredByDefault?: boolean;
    canBeSkipped?: boolean;
    runsAfterNodeIds?: string[];
    expectedRevision?: number;
  },
) {
  return apiPost(`/production-workflows/${workflowId}/versions/${versionId}/nodes`, body);
}

export function updateWorkflowNode(
  workflowId: string,
  versionId: string,
  nodeId: string,
  body: {
    isRequiredByDefault?: boolean;
    canBeSkipped?: boolean;
    runsAfterNodeIds?: string[];
    expectedRevision?: number;
  },
) {
  return apiPatch(`/production-workflows/${workflowId}/versions/${versionId}/nodes/${nodeId}`, body);
}

export function removeWorkflowNode(
  workflowId: string,
  versionId: string,
  nodeId: string,
  expectedRevision: number,
  options?: { reconnect?: boolean },
) {
  const reconnect = options?.reconnect === false ? 'false' : 'true';
  return apiDelete(
    `/production-workflows/${workflowId}/versions/${versionId}/nodes/${nodeId}?reconnect=${reconnect}&expectedRevision=${expectedRevision}`,
  );
}

export function validateWorkflowVersion(workflowId: string, versionId: string) {
  return apiPost<{ ok: boolean; issues?: Array<{ code: string; message: string }> }>(
    `/production-workflows/${workflowId}/versions/${versionId}/validate`,
    {},
  );
}

export function publishWorkflowVersion(
  workflowId: string,
  versionId: string,
  expectedRevision: number,
) {
  return apiPost(`/production-workflows/${workflowId}/versions/${versionId}/publish`, {
    expectedRevision,
  });
}

export function ensureTerminalChain(
  workflowId: string,
  versionId: string,
  expectedRevision: number,
) {
  return apiPost<{ applied: boolean; revision: number }>(
    `/production-workflows/${workflowId}/versions/${versionId}/ensure-terminal-chain`,
    { expectedRevision },
  );
}

export function ensureOpeningChain(
  workflowId: string,
  versionId: string,
  expectedRevision: number,
) {
  return apiPost<{ applied: boolean; revision: number }>(
    `/production-workflows/${workflowId}/versions/${versionId}/ensure-opening-chain`,
    { expectedRevision },
  );
}

export function discardWorkflowDraft(workflowId: string, versionId: string) {
  return apiDelete<{ discarded: boolean; mode: 'delete' | 'reset' }>(
    `/production-workflows/${workflowId}/versions/${versionId}`,
  );
}

export function getProductionOrderWorkflow(productionOrderId: string) {
  return apiGet<OrderWorkflowGraph>(`/production-orders/${productionOrderId}/workflow`);
}

export function assignProductionOrderWorkflow(productionOrderId: string, workflowId: string) {
  return apiPost<OrderWorkflowGraph>(`/production-orders/${productionOrderId}/workflow/assign`, {
    workflowId,
  });
}

export function getProductWorkflowConfiguration(productId: string) {
  return apiGet<ProductWorkflowConfig | null>(`/products/${productId}/workflow-configuration`);
}

export function upsertProductWorkflowConfiguration(
  productId: string,
  body: { workflowId: string },
) {
  return apiPatch<ProductWorkflowConfig>(`/products/${productId}/workflow-configuration`, body);
}

export type ProductionSetupBehavior =
  | 'NONE'
  | 'USES_MATERIALS'
  | 'PRODUCES_SEMI_FINISHED'
  | 'USES_SEMI_FINISHED'
  | 'USES_AND_PRODUCES'
  | 'PRODUCES_FINISHED';

export type ProductionSetupPieceLabel = {
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
};

export type ProductionSetupStage = {
  workflowNodeId: string;
  nodeKey: string;
  stageDefinitionId: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  behavior: ProductionSetupBehavior;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  consumeOutputIds: string[];
  consumeWorkflowNodeIds?: string[];
  materialInputs?: Array<{
    sku: string;
    qtyPerUnit: number;
    unit?: string;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
  }>;
  output: {
    id: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe?: string | null;
    qtyPerUnit: number | null;
    expectedPieceCount?: number | null;
    pieceLabels?: ProductionSetupPieceLabel[] | null;
    defaultWarehouseId: string | null;
  } | null;
  /** SEMI outputs from DAG predecessor stages only (empty for first stage). */
  upstreamOutputs?: Array<{
    id: string;
    workflowNodeId: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
  }>;
  /** Longest-path depth in the workflow DAG (parallels share a level). */
  flowLevel?: number;
  /** 1-based step shown in setup list (parallels share a step). */
  flowStep?: number;
  stageCode?: string;
};

export type ProductionSetupResponse = {
  status: 'READY' | 'NEEDS_SETUP' | 'INVALID';
  issues: Array<{ code: string; message: string }>;
  product?: {
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    sku?: string | null;
  } | null;
  workflow: { id: string; nameEn: string; nameAr: string; nameHe?: string | null } | null;
  bomLines?: Array<{
    sku: string;
    qty: number;
    exists: boolean;
    imageUrl?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    unit?: string | null;
  }>;
  stages: ProductionSetupStage[];
  warehouses: Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    type: string;
    isDefault: boolean;
  }>;
  outputs: Array<{
    id: string;
    workflowNodeId: string | null;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    itemClass?: string | null;
  }>;
};

export function getProductProductionSetup(productId: string) {
  return apiGet<ProductionSetupResponse>(`/products/${productId}/production-setup`);
}

export function putProductProductionSetup(
  productId: string,
  body: {
    stages: Array<{
      workflowNodeId: string;
      stageDefinitionId: string;
      behavior: ProductionSetupBehavior;
      consumesRawMaterials?: boolean;
      consumesSemiFinished?: boolean;
      outputNameEn?: string | null;
      outputNameAr?: string | null;
      outputNameHe?: string | null;
      outputQtyPerUnit?: number | null;
      expectedPieceCount?: number | null;
      pieceLabels?: ProductionSetupPieceLabel[] | null;
      defaultWarehouseId?: string | null;
      consumeOutputIds?: string[];
      consumeWorkflowNodeIds?: string[];
      materialInputs?: Array<{ sku: string; qtyPerUnit: number }>;
    }>;
  },
) {
  return apiPut<ProductionSetupResponse>(`/products/${productId}/production-setup`, body);
}

export function customizeProductionOrderWorkflow(
  productionOrderId: string,
  body: {
    notes?: string;
    nodes: Array<{
      snapshotNodeId: string;
      estimatedMinutes?: number;
      skip?: boolean;
      skipReason?: string | null;
    }>;
  },
) {
  return apiPatch<OrderWorkflowGraph>(
    `/production-orders/${encodeURIComponent(productionOrderId)}/workflow`,
    body,
  );
}
