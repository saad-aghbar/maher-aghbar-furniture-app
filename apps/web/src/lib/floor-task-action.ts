export type WorkerTaskAction = 'RECEIVE_SEMI' | 'START' | 'COMPLETE' | 'NONE';

export type WorkerTaskPhase =
  | 'WAITING_PREVIOUS'
  | 'READY_TO_RECEIVE'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ATTENTION';

/** Same dock rules as the phone floor phase. Waiting never starts. Receive comes before Start. */
export function classifyWorkerTaskAction(args: {
  taskStatus: string;
  openBlockerCount?: number;
  incomingRequired?: boolean;
  allReceived?: boolean;
  anyWaitingProduction?: boolean;
  anyReadyToCollect?: boolean;
  anyPartial?: boolean;
  waitingPrevious?: boolean;
}): { phase: WorkerTaskPhase; primaryAction: WorkerTaskAction } {
  const status = String(args.taskStatus ?? '').toUpperCase();
  if (args.openBlockerCount && args.openBlockerCount > 0) {
    return { phase: 'ATTENTION', primaryAction: 'NONE' };
  }
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return { phase: 'COMPLETED', primaryAction: 'NONE' };
  }
  if (status === 'IN_PROGRESS' || status === 'PAUSED') {
    return { phase: 'IN_PROGRESS', primaryAction: 'COMPLETE' };
  }
  if (args.waitingPrevious || status === 'BLOCKED') {
    return { phase: 'WAITING_PREVIOUS', primaryAction: 'NONE' };
  }
  if (args.incomingRequired && !args.allReceived) {
    if (args.anyWaitingProduction && !args.anyReadyToCollect && !args.anyPartial) {
      return { phase: 'WAITING_PREVIOUS', primaryAction: 'NONE' };
    }
    return { phase: 'READY_TO_RECEIVE', primaryAction: 'RECEIVE_SEMI' };
  }
  return { phase: 'READY_TO_START', primaryAction: 'START' };
}
