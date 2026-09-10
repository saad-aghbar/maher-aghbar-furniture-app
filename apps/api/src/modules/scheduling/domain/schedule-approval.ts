import { productionFactoryBucket } from '../../production/factory-release';
import { STARTED_TASK } from './planning-state';

export type ScheduleExecutionFacts = {
  orderStatus: string | null | undefined;
  releasedToFactoryAt?: Date | string | null;
  actualStartDate?: Date | string | null;
  taskStatuses?: string[];
};

/** True once a stage has actually started (or the order is already on the floor). */
export function isScheduleExecutionStarted(input: ScheduleExecutionFacts): boolean {
  if (
    productionFactoryBucket({
      status: input.orderStatus,
      releasedToFactoryAt: input.releasedToFactoryAt,
      actualStartDate: input.actualStartDate,
    }) === 'in_production'
  ) {
    return true;
  }
  return (input.taskStatuses ?? []).some((status) => STARTED_TASK.has(status));
}

export function selectScheduleApprovalActions(input: {
  scheduleStatus: string | null | undefined;
  executionStarted: boolean;
}): { canApprove: boolean; canUnapprove: boolean } {
  const status = input.scheduleStatus ?? '';
  if (input.executionStarted) {
    return { canApprove: false, canUnapprove: false };
  }
  return {
    canApprove: status === 'PROPOSED' || status === 'NEEDS_REVIEW',
    canUnapprove: status === 'APPROVED',
  };
}
