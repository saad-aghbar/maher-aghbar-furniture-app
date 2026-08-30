export type WorkflowDomainNode = {
  id: string;
  code: string;
  /** Stable sort hint; not a semantic row. */
  sortOrder: number;
};

export type WorkflowDomainEdge = {
  from: string;
  to: string;
};

export type PlacementIntent =
  | { kind: 'START'; successorIds?: string[] }
  | { kind: 'AFTER'; predecessorIds: string[]; successorIds?: string[] }
  | { kind: 'PARALLEL'; referenceNodeIds: string[]; successorIds?: string[] };

export type WorkflowMutation =
  | {
      kind: 'ADD';
      nodeId: string;
      code: string;
      sortOrder?: number;
      placement: PlacementIntent;
    }
  | {
      kind: 'EDIT_PLACEMENT';
      nodeId: string;
      placement: PlacementIntent;
    }
  | {
      kind: 'REMOVE';
      nodeId: string;
    };

export type ParallelBand = {
  id: string;
  nodeIds: string[];
  predecessorIds: string[];
};

export type CanonicalWorkflowGraph = {
  nodes: WorkflowDomainNode[];
  edges: WorkflowDomainEdge[];
  predecessorsByNode: Record<string, string[]>;
  successorsByNode: Record<string, string[]>;
  levels: Record<string, number>;
  parallelBands: ParallelBand[];
  productionNodeIds: string[];
  inspectionNodeId: string | null;
  packagingNodeId: string | null;
  deliveryNodeId: string | null;
  frontierNodeIds: string[];
};

export type WorkflowValidationIssue = {
  code: string;
  message: string;
  nodeId?: string;
};

export type WorkflowValidationResult = {
  ok: boolean;
  issues: WorkflowValidationIssue[];
};

export type PredecessorPatch = {
  nodeId: string;
  runsAfterNodeIds: string[];
};
