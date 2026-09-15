export type NewlyReadyTask = {
  id: string;
  assignedEmployeeId: string | null;
  statusFrom: string;
  stageCode: string;
  stageNameEn: string;
  executionKind: string | null;
  isRework: boolean;
};

export type CompletedStageFact = {
  code: string;
  nameEn: string;
};

export type RollupNotifyFacts = {
  poBecameReadyForDelivery: boolean;
  soBecameReadyForDelivery: boolean;
  salesOrderId: string | null;
  deliveryId: string | null;
};

export type PipelineHandoffFacts = RollupNotifyFacts & {
  productionOrderId: string;
  newlyReadyTasks: NewlyReadyTask[];
  completedStage: CompletedStageFact | null;
  packagingStageCompleted: boolean;
};

export const EMPTY_ROLLUP_FACTS: RollupNotifyFacts = {
  poBecameReadyForDelivery: false,
  soBecameReadyForDelivery: false,
  salesOrderId: null,
  deliveryId: null,
};

export function emptyPipelineFacts(productionOrderId: string): PipelineHandoffFacts {
  return {
    productionOrderId,
    newlyReadyTasks: [],
    completedStage: null,
    packagingStageCompleted: false,
    ...EMPTY_ROLLUP_FACTS,
  };
}

type UnlockStageInput = {
  status: string;
  prereqsMet: boolean;
  stageDefinition: { code: string; nameEn: string; executionKind: string | null };
  tasks: Array<{
    id: string;
    status: string;
    assignedEmployeeId: string | null;
    isRework?: boolean;
  }>;
};

/**
 * Tasks that newly become READY from a PENDING stage whose DAG prerequisites are met.
 * Already-READY rows are not collected (no duplicate handoff).
 */
export function collectNewlyReadyTasks(stages: UnlockStageInput[]): NewlyReadyTask[] {
  const newly: NewlyReadyTask[] = [];
  for (const stage of stages) {
    if (stage.status !== 'PENDING' || !stage.prereqsMet) continue;
    for (const task of stage.tasks) {
      if (task.status !== 'NOT_STARTED') continue;
      newly.push({
        id: task.id,
        assignedEmployeeId: task.assignedEmployeeId,
        statusFrom: task.status,
        stageCode: stage.stageDefinition.code,
        stageNameEn: stage.stageDefinition.nameEn,
        executionKind: stage.stageDefinition.executionKind,
        isRework: Boolean(task.isRework),
      });
    }
  }
  return newly;
}
