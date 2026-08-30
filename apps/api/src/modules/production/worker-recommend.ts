/**
 * Deterministic worker recommendations for Production Plan assign UX.
 * Helps the admin decide — never silently assigns.
 */

export type RecommendBand = 'recommended' | 'busy' | 'conflict' | 'other';

export type WorkerRecommendInput = {
  id: string;
  firstName: string;
  lastName: string;
  activeTaskCount: number;
  /** True when worker has required stage skill (or no skill catalog for stage). */
  skillMatch: boolean;
  /** True when proposed window overlaps another open task or allocation. */
  hasOverlap: boolean;
  /** Soft capacity hint: open tasks vs a simple threshold. */
  busyThreshold?: number;
};

export type WorkerRecommendResult = WorkerRecommendInput & {
  band: RecommendBand;
  /** Human-readable reason (EN template; i18n keys applied in UI). */
  reason: string;
  reasonCode:
    | 'SKILL_AVAILABLE'
    | 'SKILL_LIGHT_LOAD'
    | 'BUSY_LOAD'
    | 'SCHEDULE_CONFLICT'
    | 'NO_SKILL'
    | 'OTHER';
};

const DEFAULT_BUSY = 3;

export function recommendWorkerBand(input: WorkerRecommendInput): WorkerRecommendResult {
  const busyThreshold = input.busyThreshold ?? DEFAULT_BUSY;
  const name = `${input.firstName} ${input.lastName}`.trim() || 'Worker';

  if (!input.skillMatch) {
    return {
      ...input,
      band: 'other',
      reasonCode: 'NO_SKILL',
      reason: `${name} does not have the required skill for this stage.`,
    };
  }

  if (input.hasOverlap) {
    return {
      ...input,
      band: 'conflict',
      reasonCode: 'SCHEDULE_CONFLICT',
      reason: `${name} already has overlapping work in this time window.`,
    };
  }

  if (input.activeTaskCount >= busyThreshold) {
    return {
      ...input,
      band: 'busy',
      reasonCode: 'BUSY_LOAD',
      reason: `${name} has ${input.activeTaskCount} open tasks — still eligible.`,
    };
  }

  if (input.activeTaskCount === 0) {
    return {
      ...input,
      band: 'recommended',
      reasonCode: 'SKILL_AVAILABLE',
      reason: `${name} has the skill and no open tasks.`,
    };
  }

  return {
    ...input,
    band: 'recommended',
    reasonCode: 'SKILL_LIGHT_LOAD',
    reason: `${name} has the skill and a light load (${input.activeTaskCount} open).`,
  };
}

export function sortRecommendedWorkers<T extends WorkerRecommendResult>(workers: T[]): T[] {
  const order: Record<RecommendBand, number> = {
    recommended: 0,
    busy: 1,
    other: 2,
    conflict: 3,
  };
  return [...workers].sort(
    (a, b) =>
      order[a.band] - order[b.band] ||
      a.activeTaskCount - b.activeTaskCount ||
      a.firstName.localeCompare(b.firstName),
  );
}

/** Half-open overlap: [aStart,aEnd) overlaps [bStart,bEnd). Touching edges are OK. */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
