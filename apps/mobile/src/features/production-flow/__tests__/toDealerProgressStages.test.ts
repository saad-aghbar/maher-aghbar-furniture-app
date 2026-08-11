import { toDealerProgressStages } from '../toDealerProgressStages';
import type { ProductionFlowStage } from '../selectProductionFlow';

function stage(
  partial: Partial<ProductionFlowStage> & Pick<ProductionFlowStage, 'code' | 'name' | 'status'>,
): ProductionFlowStage {
  return {
    progressPercent: 0,
    dependsOnCodes: [],
    sortOrder: 0,
    photos: [],
    assignees: [],
    blockers: [],
    actualStart: null,
    actualEnd: null,
    plannedEnd: null,
    isOverdue: false,
    notes: null,
    attachmentCount: 0,
    ...partial,
  };
}

describe('toDealerProgressStages', () => {
  it('maps plain-language states without leaking admin fields', () => {
    const stages = toDealerProgressStages([
      stage({ code: 'CUT', name: 'Cutting', status: 'COMPLETED' }),
      stage({ code: 'UPH', name: 'Upholstery', status: 'IN_PROGRESS' }),
      stage({ code: 'FIN', name: 'Finishing', status: 'PENDING' }),
      stage({ code: 'HOLD', name: 'On hold', status: 'ON_HOLD' }),
    ]);
    expect(stages.map((s) => s.state)).toEqual(['done', 'active', 'upcoming', 'branch']);
    expect(stages[0]?.label).toBe('Cutting');
  });
});
