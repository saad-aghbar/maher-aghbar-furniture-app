import type { NewOrderStep } from './newOrderSteps';

export const NEW_ORDER_STAGE_COUNT = 3;

/** Progress 0..1 for rising stage fill (step 1 → 1/3, step 3 → 1). */
export function stageProgress(
  step: number,
  total: number = NEW_ORDER_STAGE_COUNT,
): number {
  const s = Math.min(total, Math.max(1, Math.floor(step) || 1));
  return s / total;
}

/**
 * 0-based index of the next incomplete stage to cue toward.
 * Null on the final stage.
 */
export function nextStageIndex(
  step: number,
  total: number = NEW_ORDER_STAGE_COUNT,
): number | null {
  const s = Math.min(total, Math.max(1, Math.floor(step) || 1));
  if (s >= total) return null;
  return s;
}

export type StageNodeState = 'done' | 'active' | 'upcoming';

export function stageNodeState(step: number, index: number): StageNodeState {
  const stage = index + 1;
  if (stage < step) return 'done';
  if (stage === step) return 'active';
  return 'upcoming';
}

export function isFinalWizardStep(step: NewOrderStep | number): boolean {
  return Math.floor(step) >= NEW_ORDER_STAGE_COUNT;
}
