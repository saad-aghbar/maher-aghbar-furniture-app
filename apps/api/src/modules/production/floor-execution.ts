/**
 * Piece 8 — factory floor execution presentation helpers.
 * Frontends must not invent phases; API enriches via these classifiers.
 */
import {
  custodyFilterForKit,
  incomingWorkStatus,
  type IncomingWorkStatusKey,
  type WipCustodyFilter,
} from './workflow/domain/wip-handoff';

export type FloorTaskPhase =
  | 'WAITING_PREVIOUS'
  | 'READY_TO_RECEIVE'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'OUTPUT_READY'
  | 'COMPLETED'
  | 'ATTENTION';

export type FloorTaskPresentation = {
  phase: FloorTaskPhase;
  labelKey: string;
  /** Single primary CTA hint for worker dock */
  primaryAction: 'RECEIVE_SEMI' | 'START' | 'COMPLETE' | 'NONE';
};

/**
 * Human task phase from task status + SEMI incoming + open blockers.
 * No raw enum leakage intended for UI — use labelKey + i18n.
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
}): FloorTaskPresentation {
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

export type IncomingLane = {
  fromStageCode: string;
  fromStageNameEn: string;
  fromStageNameAr: string | null;
  fromStageNameHe: string | null;
  lines: Array<{
    statusKey: IncomingWorkStatusKey;
    expected: number;
    received: number;
    produced: number;
    outstanding: number;
  }>;
  /** Aggregate for the lane */
  statusKey: IncomingWorkStatusKey;
  expected: number;
  received: number;
  produced: number;
};

/** Group incoming lines by predecessor stage (parallel lanes stay independent). */
export function groupIncomingByPredecessorStage<
  T extends {
    fromStageCode: string;
    fromStageNameEn: string;
    fromStageNameAr: string | null;
    fromStageNameHe: string | null;
    statusKey: IncomingWorkStatusKey;
    expected: number;
    received: number;
    produced: number;
    outstanding: number;
  },
>(lines: T[]): Array<IncomingLane & { lines: T[] }> {
  const map = new Map<string, IncomingLane & { lines: T[] }>();
  for (const line of lines) {
    const key = line.fromStageCode || 'UNKNOWN';
    let lane = map.get(key);
    if (!lane) {
      lane = {
        fromStageCode: key,
        fromStageNameEn: line.fromStageNameEn,
        fromStageNameAr: line.fromStageNameAr,
        fromStageNameHe: line.fromStageNameHe,
        lines: [],
        statusKey: 'WAITING_PRODUCTION',
        expected: 0,
        received: 0,
        produced: 0,
      };
      map.set(key, lane);
    }
    lane.lines.push(line);
    lane.expected += line.expected;
    lane.received += line.received;
    lane.produced += line.produced;
  }
  for (const lane of map.values()) {
    lane.statusKey = incomingWorkStatus({
      produced: lane.produced,
      received: lane.received,
      expected: lane.expected,
    });
  }
  return [...map.values()];
}

export type CustodyPresentation = {
  filter: WipCustodyFilter | null;
  labelKey: string;
  /** Short floor language */
  phase:
    | 'PRODUCED_WAITING'
    | 'AT_STATION'
    | 'RECEIVED'
    | 'IN_WORK'
    | 'UNKNOWN';
};

export function presentCustody(params: {
  status: string;
  handoffCount: number;
}): CustodyPresentation {
  const filter = custodyFilterForKit({
    status: params.status,
    handoffCount: params.handoffCount,
  });
  switch (filter) {
    case 'WAITING_PICKUP':
      return {
        filter,
        labelKey: 'mobile.inventory.custodyWaitingPickup',
        phase: 'PRODUCED_WAITING',
      };
    case 'AT_STATION':
      return {
        filter,
        labelKey: 'mobile.inventory.custodyAtStation',
        phase: 'AT_STATION',
      };
    case 'RECEIVED':
      return {
        filter,
        labelKey: 'mobile.inventory.custodyReceived',
        phase: 'RECEIVED',
      };
    case 'IN_USE':
      return {
        filter,
        labelKey: 'mobile.inventory.custodyInWork',
        phase: 'IN_WORK',
      };
    default:
      return {
        filter: null,
        labelKey: 'mobile.inventory.custodyUnknown',
        phase: 'UNKNOWN',
      };
  }
}

export const WIP_DISCREPANCY_CATEGORIES = [
  'MISSING_COMPONENT',
  'WRONG_COMPONENT',
  'DAMAGED',
  'QUANTITY_MISMATCH',
  'OTHER',
] as const;

export type WipDiscrepancyCategory = (typeof WIP_DISCREPANCY_CATEGORIES)[number];

export function isWipDiscrepancyCategory(v: string): v is WipDiscrepancyCategory {
  return (WIP_DISCREPANCY_CATEGORIES as readonly string[]).includes(v);
}
