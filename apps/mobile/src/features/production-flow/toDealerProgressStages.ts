import type { DealerProgressStage } from '@/features/dealer-ui/DealerProgressMap';
import type { ProductionFlowStage } from './selectProductionFlow';

/** Map production stages → plain-language dealer progress states (no worker jargon). */
export function toDealerProgressStages(
  stages: ProductionFlowStage[],
): DealerProgressStage[] {
  return stages.map((stage) => {
    const status = stage.status.toUpperCase();
    let state: DealerProgressStage['state'] = 'upcoming';
    if (status === 'COMPLETED' || status === 'DONE') {
      state = 'done';
    } else if (
      status === 'IN_PROGRESS' ||
      status === 'READY' ||
      status === 'QUALITY_CHECK' ||
      status === 'READY_FOR_INSPECTION'
    ) {
      state = 'active';
    } else if (
      status === 'BLOCKED' ||
      status === 'ON_HOLD' ||
      status === 'PAUSED' ||
      status === 'WAITING_FOR_MATERIALS'
    ) {
      state = 'branch';
    }
    return {
      id: stage.code || stage.name,
      label: stage.name,
      state,
    };
  });
}
