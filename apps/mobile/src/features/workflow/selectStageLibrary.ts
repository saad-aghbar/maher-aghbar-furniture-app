import type { StageDefinition } from '@/api/modules/workflow';

/** Locked opening stage — always first in the library, never invented. */
export const LOCKED_OPENING_STAGE_CODE = 'MATERIAL_PREP';

export function isLockedOpeningStage(stage: Pick<StageDefinition, 'code'>): boolean {
  return stage.code === LOCKED_OPENING_STAGE_CODE;
}

export function stageLibraryListInset(insetsBottom: number, tabBarClearance: number): number {
  return insetsBottom + tabBarClearance;
}

export function groupStageLibrary<T extends Pick<StageDefinition, 'code' | 'sortOrder'>>(
  stages: T[],
): { opening: T[]; production: T[] } {
  const opening: T[] = [];
  const production: T[] = [];
  for (const stage of stages) {
    if (isLockedOpeningStage(stage)) opening.push(stage);
    else production.push(stage);
  }
  const bySort = (a: T, b: T) => a.sortOrder - b.sortOrder;
  opening.sort(bySort);
  production.sort(bySort);
  return { opening, production };
}
