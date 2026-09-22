/**
 * Which floor a task belongs to (shared logic with mobile `features/quality/taskQualityKind.ts`).
 * Inspection / packaging are QC work with their own panels; DISMANTLE_RECOVER is the
 * returns recovery floor; rework tasks show the reported problem.
 */
export type TaskQualityKind = 'production' | 'inspection' | 'reinspection' | 'packaging' | 'rework' | 'recovery';

function normalize(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

const QC_FAIL_RESULTS = ['FAILED_REWORK_REQUIRED', 'BLOCKED'];

export function isQcFailResult(result: string | null | undefined): boolean {
  return Boolean(result && QC_FAIL_RESULTS.includes(result));
}

export function countPriorFails(inspections?: Array<{ result?: string | null }> | null): number {
  return (inspections ?? []).filter((row) => isQcFailResult(row.result)).length;
}

export function classifyTaskQualityKind(input: { stageCode?: string | null; executionKind?: string | null; isRework?: boolean | null; priorFailCount?: number | null }): TaskQualityKind {
  if (input.isRework) return 'rework';
  const stageCode = normalize(input.stageCode);
  if (stageCode === 'DISMANTLE_RECOVER') return 'recovery';
  const executionKind = normalize(input.executionKind);
  if (executionKind === 'PACKAGING' || stageCode === 'PACKAGING' || stageCode === 'PACK') return 'packaging';
  if (executionKind === 'QUALITY' || stageCode === 'INSPECTION' || stageCode === 'QC') return (input.priorFailCount ?? 0) > 0 ? 'reinspection' : 'inspection';
  return 'production';
}

export function isRecoveryFinishBlocked(lines?: Array<{ postedAt?: string | null }> | null): boolean {
  return !lines?.length || lines.some((line) => !line.postedAt);
}

export function allPackagesConfirmed(expected: Array<{ code: string }>, checked: Record<string, boolean>): boolean {
  if (!expected.length) return true;
  return expected.every((p) => checked[p.code]);
}
