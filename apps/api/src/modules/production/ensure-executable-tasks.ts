/**
 * Ensure every non-LOGISTICS / non-DELIVERY stage instance on a PO has a ProductionTask.
 * Used when Piece 2 release / demo seeds created snapshots without floor tasks.
 */

export type EnsureTaskStageInput = {
  id: string;
  stageDefinitionId: string;
  stageDefinition?: {
    code?: string | null;
    nameEn?: string | null;
    executionKind?: string | null;
  } | null;
  tasks?: Array<{ id: string }>;
};

export type EnsureTaskCreateSpec = {
  stageInstanceId: string;
  stageDefinitionId: string;
  name: string;
  description: string;
};

export function isLogisticsOrDeliveryStage(stage: {
  code?: string | null;
  executionKind?: string | null;
}): boolean {
  const kind = String(stage.executionKind ?? '').toUpperCase();
  if (kind === 'LOGISTICS') return true;
  const code = String(stage.code ?? '').toUpperCase();
  return code === 'DELIVERY';
}

/** Stages that need a floor ProductionTask but do not have one yet. */
export function listMissingExecutableTaskSpecs(
  stages: EnsureTaskStageInput[],
  productDescription: string,
  quantity: number,
): EnsureTaskCreateSpec[] {
  const out: EnsureTaskCreateSpec[] = [];
  for (const stage of stages) {
    const def = stage.stageDefinition;
    if (
      isLogisticsOrDeliveryStage({
        code: def?.code,
        executionKind: def?.executionKind,
      })
    ) {
      continue;
    }
    if ((stage.tasks?.length ?? 0) > 0) continue;
    const name = def?.nameEn || def?.code || 'Stage';
    out.push({
      stageInstanceId: stage.id,
      stageDefinitionId: stage.stageDefinitionId,
      name,
      description: `${name} for ${productDescription || 'order'} (qty ${quantity})`,
    });
  }
  return out;
}
