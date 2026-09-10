import type { StageInventoryBehavior } from '../../common/helpers/inventory-stage-behavior.util';
import { behaviorProduces } from '../../common/helpers/inventory-stage-behavior.util';
import { isInspectionStageCode } from './piece-labels';

export type InspectionGateStage = {
  stageCode?: string | null;
  behavior?: StageInventoryBehavior;
  consumesSemiFinished?: boolean;
  consumesRawMaterials?: boolean;
  consumeOutputIds?: string[];
  consumeWorkflowNodeIds?: string[];
};

/** Inspection is a quality gate: it must not take kits or materials. */
export function inspectionTakesInventory(stage: InspectionGateStage, stageCode?: string | null): boolean {
  if (!isInspectionStageCode(stageCode ?? stage.stageCode)) return false;
  const consumeIds = stage.consumeOutputIds ?? [];
  const consumeNodes = stage.consumeWorkflowNodeIds ?? [];
  return (
    Boolean(stage.consumesSemiFinished) ||
    Boolean(stage.consumesRawMaterials) ||
    consumeIds.length > 0 ||
    consumeNodes.length > 0 ||
    stage.behavior === 'USES_SEMI_FINISHED' ||
    stage.behavior === 'USES_AND_PRODUCES' ||
    stage.behavior === 'USES_MATERIALS'
  );
}

export function inspectionProducesInventory(
  stage: InspectionGateStage,
  stageCode?: string | null,
): boolean {
  if (!isInspectionStageCode(stageCode ?? stage.stageCode)) return false;
  return Boolean(stage.behavior && behaviorProduces(stage.behavior));
}

/** Persist inspection as NONE with no consume claims. */
export function stripInspectionGateStage<T extends InspectionGateStage>(
  stage: T,
  stageCode?: string | null,
): T {
  if (!isInspectionStageCode(stageCode ?? stage.stageCode)) return stage;
  stage.behavior = 'NONE';
  stage.consumesSemiFinished = false;
  stage.consumesRawMaterials = false;
  stage.consumeOutputIds = [];
  stage.consumeWorkflowNodeIds = [];
  return stage;
}
