import type {
  FloorTaskHint,
  FloorTaskPhase,
  FloorTaskPrimaryAction,
  WipIncomingStatusKey,
} from '@/api/modules/tasks';

/**
 * Client-side mirror of API `classifyFloorTaskPhase` so the dock can use
 * live task status even when `/wip-incoming` hardcodes a READY status.
 */
export function classifyFloorTaskPhase(args: {
  taskStatus: string;
  openBlockerCount?: number;
  consumesSemi?: boolean;
  incomingRequired?: boolean;
  allReceived?: boolean;
  anyWaitingProduction?: boolean;
  anyReadyToCollect?: boolean;
  anyPartial?: boolean;
}): FloorTaskHint {
  const status = String(args.taskStatus ?? '').toUpperCase();
  if (args.openBlockerCount && args.openBlockerCount > 0) {
    return {
      phase: 'ATTENTION',
      labelKey: 'mobile.tasks.phaseAttention',
      primaryAction: 'NONE',
    };
  }
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return {
      phase: 'COMPLETED',
      labelKey: 'mobile.tasks.phaseCompleted',
      primaryAction: 'NONE',
    };
  }
  if (status === 'IN_PROGRESS' || status === 'PAUSED') {
    return {
      phase: 'IN_PROGRESS',
      labelKey: 'mobile.tasks.phaseInProgress',
      primaryAction: 'COMPLETE',
    };
  }

  const needsSemi = Boolean(args.consumesSemi || args.incomingRequired);
  if (needsSemi && !args.allReceived) {
    if (args.anyWaitingProduction && !args.anyReadyToCollect && !args.anyPartial) {
      return {
        phase: 'WAITING_PREVIOUS',
        labelKey: 'mobile.tasks.phaseWaitingPrevious',
        primaryAction: 'NONE',
      };
    }
    return {
      phase: 'READY_TO_RECEIVE',
      labelKey: 'mobile.tasks.phaseReadyToReceive',
      primaryAction: 'RECEIVE_SEMI',
    };
  }

  return {
    phase: 'READY_TO_START',
    labelKey: 'mobile.tasks.phaseReadyToStart',
    primaryAction: 'START',
  };
}

export function floorHintFromIncoming(args: {
  taskStatus: string;
  openBlockerCount?: number;
  required: boolean;
  allReceived: boolean;
  lines: Array<{ statusKey: WipIncomingStatusKey }>;
  apiHint?: FloorTaskHint | null;
}): FloorTaskHint {
  // Prefer live task status over API hint (incoming endpoint may pin READY).
  return classifyFloorTaskPhase({
    taskStatus: args.taskStatus,
    openBlockerCount: args.openBlockerCount,
    consumesSemi: args.required,
    incomingRequired: args.required,
    allReceived: args.allReceived,
    anyWaitingProduction: args.lines.some((l) => l.statusKey === 'WAITING_PRODUCTION'),
    anyReadyToCollect: args.lines.some((l) => l.statusKey === 'READY_TO_COLLECT'),
    anyPartial: args.lines.some((l) => l.statusKey === 'PARTIALLY_RECEIVED'),
  });
}

export type TodayFloorBucket =
  | 'DO_NOW'
  | 'READY_AFTER_RECEIVING'
  | 'WAITING'
  | 'COMPLETED_TODAY';

/**
 * Bucket open tasks for Worker Today using floor phase when known,
 * else status / waiting heuristics.
 */
export function bucketOpenTaskForToday(args: {
  status: string;
  phase?: FloorTaskPhase | null;
  needsReceive?: boolean | null;
  waitingPrevious?: boolean | null;
}): Exclude<TodayFloorBucket, 'COMPLETED_TODAY'> {
  if (args.phase === 'IN_PROGRESS' || args.phase === 'READY_TO_START') return 'DO_NOW';
  if (args.phase === 'READY_TO_RECEIVE') return 'READY_AFTER_RECEIVING';
  if (args.phase === 'WAITING_PREVIOUS' || args.phase === 'ATTENTION') return 'WAITING';

  const status = String(args.status ?? '').toUpperCase();
  if (status === 'IN_PROGRESS' || status === 'PAUSED') return 'DO_NOW';
  if (args.needsReceive) return 'READY_AFTER_RECEIVING';
  if (args.waitingPrevious || status === 'BLOCKED' || status === 'NOT_STARTED') {
    // NOT_STARTED without receive need is often waiting on prior stage.
    if (args.waitingPrevious || status === 'BLOCKED') return 'WAITING';
    if (status === 'NOT_STARTED' && args.needsReceive == null) return 'WAITING';
  }
  if (status === 'READY' || status === 'NOT_STARTED') return 'DO_NOW';
  return 'WAITING';
}

export function primaryActionLabelKey(action: FloorTaskPrimaryAction): string | null {
  switch (action) {
    case 'RECEIVE_SEMI':
      return 'mobile.tasks.dockReceiveSemi';
    case 'START':
      return 'mobile.tasks.startTask';
    case 'COMPLETE':
      return 'mobile.tasks.markFinished';
    default:
      return null;
  }
}

/** Piece 9 — human stamp on Today / floor cards (never raw enums). */
export type TodayQualityStamp = 'INSPECTION' | 'REWORK' | 'PACKAGING' | null;

export function classifyTodayQualityStamp(args: {
  stageCode?: string | null;
  executionKind?: string | null;
  isRework?: boolean | null;
}): TodayQualityStamp {
  if (args.isRework) return 'REWORK';
  const code = String(args.stageCode ?? '').toUpperCase();
  const kind = String(args.executionKind ?? '').toUpperCase();
  if (code === 'PACKAGING' || code === 'PACK') return 'PACKAGING';
  if (kind === 'QUALITY' || code === 'INSPECTION') return 'INSPECTION';
  return null;
}

export function todayQualityStampLabelKey(stamp: TodayQualityStamp): string | null {
  switch (stamp) {
    case 'INSPECTION':
      return 'mobile.quality.stampInspection';
    case 'REWORK':
      return 'mobile.quality.stampRework';
    case 'PACKAGING':
      return 'mobile.quality.stampPackaging';
    default:
      return null;
  }
}
