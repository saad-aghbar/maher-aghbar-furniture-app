/**
 * Last-stage floor kinds that reuse TaskDetailScreen.
 * Inspection / packaging are QC work, not middle-stage production.
 */

export type TaskQualityKind = 'inspection' | 'reinspection' | 'packaging' | null;

type QualityKindInput = {
  executionKind?: string | null;
  isReinspection?: boolean | null;
  stageCode?: string | null;
  stageDefinition?: { code?: string | null } | null;
};

function normalize(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

/**
 * inspection/reinspection: executionKind QUALITY or stage INSPECTION.
 * packaging: executionKind PACKAGING or stage PACKAGING / PACK.
 */
export function resolveTaskQualityKind(input: QualityKindInput): TaskQualityKind {
  const executionKind = normalize(input.executionKind);
  const stageCode = normalize(input.stageCode ?? input.stageDefinition?.code);

  if (executionKind === 'PACKAGING' || stageCode === 'PACKAGING' || stageCode === 'PACK') {
    return 'packaging';
  }

  if (executionKind === 'QUALITY' || stageCode === 'INSPECTION' || stageCode === 'QC') {
    return input.isReinspection ? 'reinspection' : 'inspection';
  }

  return null;
}

/** Hide leftover production chrome (timer, materials, incoming, empty handoff). */
export function isLastStageQualityFloor(kind: TaskQualityKind): boolean {
  return kind === 'inspection' || kind === 'reinspection' || kind === 'packaging';
}

const QC_FAIL_RESULTS = ['FAILED_REWORK_REQUIRED', 'BLOCKED'] as const;

export type ClassifiedTaskQualityKind =
  | 'production'
  | 'inspection'
  | 'reinspection'
  | 'packaging'
  | 'rework';

export function isQcFailResult(result: string | null | undefined): boolean {
  return Boolean(result && (QC_FAIL_RESULTS as readonly string[]).includes(result));
}

export function countPriorFails(
  inspections?: Array<{ result?: string | null }> | null,
): number {
  return (inspections ?? []).filter((row) => isQcFailResult(row.result)).length;
}

/** Floor classification for task detail — production, QC, packaging, or rework. */
export function classifyTaskQualityKind(input: {
  stageCode?: string | null;
  executionKind?: string | null;
  isRework?: boolean | null;
  priorFailCount?: number | null;
}): ClassifiedTaskQualityKind {
  if (input.isRework) return 'rework';
  const resolved = resolveTaskQualityKind({
    stageCode: input.stageCode,
    executionKind: input.executionKind,
    isReinspection: (input.priorFailCount ?? 0) > 0,
  });
  return resolved ?? 'production';
}
