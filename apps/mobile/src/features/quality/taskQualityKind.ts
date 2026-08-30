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
