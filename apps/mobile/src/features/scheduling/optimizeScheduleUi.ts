import type { ReplanRun, ReplanRunResult } from '@/api/modules/scheduling';

export const CAPACITY_OPTIMIZE_POLL_TIMEOUT_MS = 5 * 60_000;

export type OptimizeScheduleSheetPhase =
  | 'confirm'
  | 'previewing'
  | 'preview'
  | 'applying'
  | 'upToDate'
  | 'changed'
  | 'partial'
  | 'failed'
  | 'inProgress';

export type OptimizeScheduleStats = {
  scanned: number;
  wouldMove: number;
  moved: number;
  alreadyValid: number;
  stillAttention: number;
  emptyDays: Array<{ ymd: string; causeKey: string }>;
  blockedItems: Array<{ number: string; blockerKind?: string | null }>;
  previewMoves: Array<{ productionOrderId: string; number: string; daysEarlier: number }>;
};

export function optimizeBlockerI18nKey(kind?: string | null): string {
  switch (kind) {
    case 'NOT_READY_MATERIAL':
    case 'MATERIAL_NOT_READY':
      return 'mobile.adminScheduling.optimize.blockedMaterials';
    case 'NOT_READY_WIP':
    case 'WIP_NOT_READY':
      return 'mobile.adminScheduling.optimize.blockedWip';
    case 'NO_WORKER_CAPACITY':
    case 'NO_ELIGIBLE_WORKER':
      return 'mobile.adminScheduling.optimize.blockedWorkers';
    case 'PINNED':
    case 'IN_PROGRESS':
    case 'COMPLETED':
      return 'mobile.adminScheduling.optimize.blockedPinned';
    default:
      return 'mobile.adminScheduling.optimize.stillAttention';
  }
}

export function optimizeStatsFromResult(result?: ReplanRunResult | null): OptimizeScheduleStats {
  const blockedItems = result?.blockedItems ?? [];
  const emptyDays = (result?.emptyDays ?? [])
    .filter((d) => d.causeKey)
    .slice(0, 8)
    .map((d) => ({ ymd: d.ymd, causeKey: d.causeKey as string }));
  const previewMoves = (result?.previewMoves ?? []).slice(0, 8).map((m) => ({
    productionOrderId: m.productionOrderId,
    number: m.number ?? m.productionOrderId,
    daysEarlier: m.daysEarlier ?? 0,
  }));
  return {
    scanned: result?.scannedOrders ?? 0,
    wouldMove: result?.wouldMove ?? result?.candidateOrders ?? 0,
    moved: result?.moved ?? result?.movedEarlier ?? result?.replanned ?? 0,
    alreadyValid: result?.alreadyValid ?? 0,
    stillAttention: result?.stillNeedsAttention ?? blockedItems.length + (result?.failures?.length ?? 0),
    emptyDays,
    blockedItems,
    previewMoves,
  };
}

export function selectOptimizeSheetPhase(args: {
  run?: Pick<ReplanRun, 'status' | 'result'> | null;
  alreadyInProgress?: boolean;
  conflictInProgress?: boolean;
  httpFailed?: boolean;
  awaitingApply?: boolean;
}): OptimizeScheduleSheetPhase {
  if (args.httpFailed) return 'failed';
  if (args.conflictInProgress && (!args.run || args.run.status === 'QUEUED' || args.run.status === 'RUNNING')) {
    return 'inProgress';
  }
  const run = args.run;
  if (!run) {
    if (args.alreadyInProgress) return 'inProgress';
    return 'confirm';
  }
  if (run.status === 'QUEUED' || run.status === 'RUNNING') {
    return run.result?.mode === 'apply' || args.awaitingApply ? 'applying' : 'previewing';
  }
  if (run.status === 'FAILED') return 'failed';
  const outcome = run.result?.outcome;
  const mode = run.result?.mode;
  if (mode !== 'apply' && args.awaitingApply !== false) {
    if (outcome === 'UP_TO_DATE') return 'upToDate';
    if (outcome === 'FAILED') return 'failed';
    if (outcome === 'CHANGED' || outcome === 'PARTIAL') return 'preview';
  }
  if (outcome === 'UP_TO_DATE') return 'upToDate';
  if (outcome === 'PARTIAL') return 'partial';
  if (outcome === 'FAILED') return 'failed';
  if (outcome === 'CHANGED') return 'changed';
  const stats = optimizeStatsFromResult(run.result);
  if (mode !== 'apply') {
    if (stats.wouldMove === 0 && stats.stillAttention === 0) return 'upToDate';
    return 'preview';
  }
  if (stats.moved === 0 && stats.stillAttention === 0) return 'upToDate';
  if (stats.stillAttention > 0) return 'partial';
  return 'changed';
}

export function shouldToastOptimizeCompletion(phase: OptimizeScheduleSheetPhase): boolean {
  return phase === 'failed';
}
