/**
 * Read-only breakdown of why a conflict list looks large.
 * Does not change allocations. Used for audit + fixture 55-count tests.
 */
import {
  conflictPairId,
  intervalsOverlap,
  latestVersionByProductionOrder,
  selectActiveAllocations,
  type ConflictAllocationInput,
} from './conflict-detector';

export type ConflictCategoryCounts = {
  rawPairCount: number;
  uniquePairCount: number;
  duplicateSymmetricPairs: number;
  combinatorialExtraPairs: number;
  staleDualVersionPairs: number;
  completedHistoricalPairs: number;
  pastEndedPairs: number;
  zeroDurationOrInvalidWindow: number;
  boundaryTouchingPairs: number;
  departmentOrResourceAsWorker: number;
  duplicateAllocationRows: number;
  sameTaskRepresentedTwice: number;
  manuallyAdjustedPairs: number;
  pinnedForceReservePairs: number;
  realActiveWorkerOverlaps: number;
  realActiveResourceOverlaps: number;
  chipDoubleCountExample: number;
  activeOperationalCount: number;
  affectedOrderCount: number;
};

function allPairs(list: ConflictAllocationInput[]): Array<[ConflictAllocationInput, ConflictAllocationInput]> {
  const out: Array<[ConflictAllocationInput, ConflictAllocationInput]> = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      out.push([list[i]!, list[j]!]);
    }
  }
  return out;
}

function sameResource(a: ConflictAllocationInput, b: ConflictAllocationInput): boolean {
  if (a.employeeId && b.employeeId && a.employeeId === b.employeeId) return true;
  if (
    !a.employeeId &&
    !b.employeeId &&
    a.stageDefinitionId &&
    a.stageDefinitionId === b.stageDefinitionId &&
    a.resourceSlot != null &&
    a.resourceSlot === b.resourceSlot
  ) {
    return true;
  }
  return false;
}

/** Naive detector: every overlapping same-employee pair on APPROVED/PROPOSED, no latest/completed filter. */
export function naiveWorkerPairs(allocations: ConflictAllocationInput[], now: Date) {
  const naive = allocations.filter(
    (a) =>
      a.employeeId &&
      (a.scheduleStatus === 'APPROVED' || a.scheduleStatus === 'PROPOSED') &&
      a.plannedEnd.getTime() >= now.getTime(),
  );
  const byWorker = new Map<string, ConflictAllocationInput[]>();
  for (const a of naive) {
    const list = byWorker.get(a.employeeId!) ?? [];
    list.push(a);
    byWorker.set(a.employeeId!, list);
  }
  const pairs: Array<[ConflictAllocationInput, ConflictAllocationInput]> = [];
  for (const list of byWorker.values()) {
    for (const [a, b] of allPairs(list)) {
      if (intervalsOverlap(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd)) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

export function categorizeConflictInflators(
  allocations: ConflictAllocationInput[],
  now: Date,
): ConflictCategoryCounts {
  const naive = naiveWorkerPairs(allocations, now);
  const uniqueIds = new Set(naive.map(([a, b]) => conflictPairId(a.id, b.id)));
  const latest = latestVersionByProductionOrder(allocations);
  const active = selectActiveAllocations(allocations, now);

  let staleDualVersionPairs = 0;
  let completedHistoricalPairs = 0;
  let pastEndedPairs = 0;
  let zeroDurationOrInvalidWindow = 0;
  let boundaryTouchingPairs = 0;
  let departmentOrResourceAsWorker = 0;
  let manuallyAdjustedPairs = 0;
  let pinnedForceReservePairs = 0;

  for (const [a, b] of naive) {
    const aLatest = a.scheduleVersion === latest.get(a.productionOrderId);
    const bLatest = b.scheduleVersion === latest.get(b.productionOrderId);
    if (!aLatest || !bLatest) staleDualVersionPairs += 1;
    if (a.taskStatus === 'COMPLETED' || b.taskStatus === 'COMPLETED') completedHistoricalPairs += 1;
    if (a.plannedEnd.getTime() < now.getTime() || b.plannedEnd.getTime() < now.getTime()) {
      pastEndedPairs += 1;
    }
    if (a.manuallyAdjusted || b.manuallyAdjusted) manuallyAdjustedPairs += 1;
    if (a.isPinned && b.isPinned) pinnedForceReservePairs += 1;
  }

  for (const a of allocations) {
    if (a.plannedEnd.getTime() <= a.plannedStart.getTime()) zeroDurationOrInvalidWindow += 1;
  }

  for (const [a, b] of allPairs(allocations)) {
    if (!sameResource(a, b)) continue;
    const aEnd = a.plannedEnd.getTime();
    const bStart = b.plannedStart.getTime();
    const bEnd = b.plannedEnd.getTime();
    const aStart = a.plannedStart.getTime();
    const touches = aEnd === bStart || bEnd === aStart;
    const overlaps = intervalsOverlap(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd);
    if (touches && !overlaps) boundaryTouchingPairs += 1;
  }

  const workerIds = new Set(allocations.map((a) => a.employeeId).filter(Boolean));
  for (const a of allocations) {
    if (a.employeeId && a.employeeId.startsWith('resource:')) departmentOrResourceAsWorker += 1;
    if (a.employeeId && a.resourceSlot != null && workerIds.has(a.employeeId)) {
      /* worker+slot is fine */
    }
  }

  const idCounts = new Map<string, number>();
  const taskCounts = new Map<string, number>();
  for (const a of allocations) {
    idCounts.set(a.id, (idCounts.get(a.id) ?? 0) + 1);
    if (a.productionTaskId) {
      const key = `${a.scheduleId}:${a.productionTaskId}`;
      taskCounts.set(key, (taskCounts.get(key) ?? 0) + 1);
    }
  }
  const duplicateAllocationRows = [...idCounts.values()].filter((n) => n > 1).length;
  const sameTaskRepresentedTwice = [...taskCounts.values()].filter((n) => n > 1).length;

  const byWorkerActive = new Map<string, number>();
  for (const a of active) {
    if (!a.employeeId) continue;
    byWorkerActive.set(a.employeeId, (byWorkerActive.get(a.employeeId) ?? 0) + 1);
  }
  let combinatorialExtraPairs = 0;
  for (const n of byWorkerActive.values()) {
    if (n >= 3) combinatorialExtraPairs += (n * (n - 1)) / 2 - (n - 1);
  }

  let realActiveWorkerOverlaps = 0;
  let realActiveResourceOverlaps = 0;
  const byWorker = new Map<string, ConflictAllocationInput[]>();
  const byResource = new Map<string, ConflictAllocationInput[]>();
  for (const a of active) {
    if (a.employeeId) {
      const list = byWorker.get(a.employeeId) ?? [];
      list.push(a);
      byWorker.set(a.employeeId, list);
    } else if (a.stageDefinitionId != null && a.resourceSlot != null) {
      const key = `${a.stageDefinitionId}:${a.resourceSlot}`;
      const list = byResource.get(key) ?? [];
      list.push(a);
      byResource.set(key, list);
    }
  }
  const countOverlaps = (groups: Map<string, ConflictAllocationInput[]>) => {
    let n = 0;
    for (const list of groups.values()) {
      for (const [a, b] of allPairs(list)) {
        if (intervalsOverlap(a.plannedStart, a.plannedEnd, b.plannedStart, b.plannedEnd)) n += 1;
      }
    }
    return n;
  };
  realActiveWorkerOverlaps = countOverlaps(byWorker);
  realActiveResourceOverlaps = countOverlaps(byResource);

  const affected = new Set<string>();
  for (const a of active) {
    for (const other of active) {
      if (a.id >= other.id) continue;
      if (!sameResource(a, other)) continue;
      if (!intervalsOverlap(a.plannedStart, a.plannedEnd, other.plannedStart, other.plannedEnd)) continue;
      affected.add(a.productionOrderId);
      affected.add(other.productionOrderId);
    }
  }

  const activeOperationalCount = realActiveWorkerOverlaps + realActiveResourceOverlaps;
  return {
    rawPairCount: naive.length,
    uniquePairCount: uniqueIds.size,
    duplicateSymmetricPairs: naive.length - uniqueIds.size,
    combinatorialExtraPairs,
    staleDualVersionPairs,
    completedHistoricalPairs,
    pastEndedPairs,
    zeroDurationOrInvalidWindow,
    boundaryTouchingPairs,
    departmentOrResourceAsWorker,
    duplicateAllocationRows,
    sameTaskRepresentedTwice,
    manuallyAdjustedPairs,
    pinnedForceReservePairs,
    realActiveWorkerOverlaps,
    realActiveResourceOverlaps,
    chipDoubleCountExample: activeOperationalCount + affected.size,
    activeOperationalCount,
    affectedOrderCount: affected.size,
  };
}
