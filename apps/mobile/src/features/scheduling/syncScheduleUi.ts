import type { ReplanRun, ReplanRunResult } from '@/api/modules/scheduling';

/** Factory scan can exceed the calendar-exception 90s poll. */
export const MANUAL_SYNC_POLL_TIMEOUT_MS = 5 * 60_000;

export type SyncScheduleSheetPhase =
  | 'confirm'
  | 'syncing'
  | 'upToDate'
  | 'changed'
  | 'partial'
  | 'failed'
  | 'inProgress';

export type SyncScheduleStats = {
  scanned: number;
  alreadyValid: number;
  generated: number;
  replanned: number;
  pastDueRescheduled: number;
  atRiskRecovered: number;
  stillAttention: number;
  conflictsResolved: number;
  newConflictsIntroduced: number;
  blockedItems: Array<{ number: string; blockerKind?: string | null }>;
  manualAttentionItems: Array<{ number: string }>;
};

export function blockerKindI18nKey(kind?: string | null): string {
  switch (kind) {
    case 'MATERIAL_NOT_READY':
      return 'mobile.adminScheduling.sync.blockedMaterials';
    case 'WIP_NOT_READY':
      return 'mobile.adminScheduling.sync.blockedWip';
    case 'NO_ELIGIBLE_WORKER':
      return 'mobile.adminScheduling.sync.blockedWorkers';
    case 'MISSING_ESTIMATE':
      return 'mobile.adminScheduling.sync.blockedEstimates';
    default:
      return 'mobile.adminScheduling.sync.manualAttention';
  }
}

export function syncStatsFromResult(result?: ReplanRunResult | null): SyncScheduleStats {
  const blockedItems = result?.blockedItems ?? [];
  const manualAttentionItems = result?.manualAttentionItems ?? [];
  return {
    scanned: result?.scannedOrders ?? 0,
    alreadyValid: result?.alreadyValid ?? 0,
    generated: result?.generated ?? 0,
    replanned: result?.replanned ?? result?.replannedOrders ?? 0,
    pastDueRescheduled: result?.pastDueRescheduled ?? 0,
    atRiskRecovered: result?.atRiskRecovered ?? result?.recoveredAtRisk ?? result?.atRiskResolved ?? 0,
    stillAttention:
      result?.stillNeedsAttention ??
      blockedItems.length + manualAttentionItems.length + (result?.failures?.length ?? 0),
    conflictsResolved: result?.conflictsResolved ?? 0,
    newConflictsIntroduced: result?.newConflictsIntroduced ?? result?.newConflictCount ?? 0,
    blockedItems,
    manualAttentionItems,
  };
}

export function selectSyncSheetPhase(args: {
  run?: Pick<ReplanRun, 'status' | 'result'> | null;
  alreadyInProgress?: boolean;
  conflictInProgress?: boolean;
  httpFailed?: boolean;
}): SyncScheduleSheetPhase {
  if (args.httpFailed) return 'failed';
  if (args.conflictInProgress && (!args.run || args.run.status === 'QUEUED' || args.run.status === 'RUNNING')) {
    return 'inProgress';
  }
  const run = args.run;
  if (!run) {
    if (args.alreadyInProgress) return 'inProgress';
    return 'confirm';
  }
  if (run.status === 'QUEUED' || run.status === 'RUNNING') return 'syncing';
  if (run.status === 'FAILED') return 'failed';
  const outcome = run.result?.outcome;
  if (outcome === 'UP_TO_DATE') return 'upToDate';
  if (outcome === 'PARTIAL') return 'partial';
  if (outcome === 'FAILED') return 'failed';
  if (outcome === 'CHANGED') return 'changed';
  const stats = syncStatsFromResult(run.result);
  if (stats.generated + stats.replanned === 0 && stats.stillAttention === 0) return 'upToDate';
  if (stats.stillAttention > 0) return 'partial';
  return 'changed';
}

export function shouldToastSyncCompletion(phase: SyncScheduleSheetPhase): boolean {
  return phase === 'failed';
}
