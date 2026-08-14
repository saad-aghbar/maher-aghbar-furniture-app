export type StageDefinition = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  sortOrder: number;
  estimatedHours?: number | null;
  requiresInspection?: boolean;
  requiresPhotos?: boolean;
  responsibleDepartment?: string | null;
  isActive: boolean;
};

export type WorkflowNode = {
  id: string;
  nodeKey: string;
  sortOrder: number;
  isRequiredByDefault: boolean;
  canBeSkipped: boolean;
  defaultEstimatedMinutes?: number | null;
  responsibleDepartmentId?: string | null;
  inventoryTracking?: 'NONE' | 'PRODUCES_SEMI_FINISHED' | 'PRODUCES_FINISHED';
  consumesRawMaterials?: boolean;
  consumesSemiFinished?: boolean;
  stageDefinition: StageDefinition;
};

export type WorkflowEdge = {
  id?: string;
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
