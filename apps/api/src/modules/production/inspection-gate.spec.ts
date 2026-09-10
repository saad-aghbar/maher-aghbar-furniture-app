import {
  inspectionProducesInventory,
  inspectionTakesInventory,
  stripInspectionGateStage,
} from './inspection-gate';

describe('inspection-gate', () => {
  it('detects consume flags, ids, and consume behaviors', () => {
    expect(
      inspectionTakesInventory({
        stageCode: 'INSPECTION',
        behavior: 'USES_SEMI_FINISHED',
        consumesSemiFinished: true,
        consumeOutputIds: ['out-1'],
      }),
    ).toBe(true);
    expect(
      inspectionTakesInventory({
        stageCode: 'INSPECTION',
        behavior: 'NONE',
        consumesSemiFinished: false,
        consumeOutputIds: [],
      }),
    ).toBe(false);
    expect(inspectionTakesInventory({ behavior: 'USES_MATERIALS' }, 'CARPENTRY')).toBe(false);
  });

  it('detects producing behaviors', () => {
    expect(
      inspectionProducesInventory({ stageCode: 'INSPECTION', behavior: 'PRODUCES_SEMI_FINISHED' }),
    ).toBe(true);
    expect(inspectionProducesInventory({ stageCode: 'INSPECTION', behavior: 'NONE' })).toBe(false);
  });

  it('strips inspection to NONE with no consume claims', () => {
    const stage = stripInspectionGateStage({
      stageCode: 'INSPECTION',
      behavior: 'USES_SEMI_FINISHED' as const,
      consumesSemiFinished: true,
      consumesRawMaterials: true,
      consumeOutputIds: ['out-1'],
      consumeWorkflowNodeIds: ['n-mix'],
    });
    expect(stage).toEqual({
      stageCode: 'INSPECTION',
      behavior: 'NONE',
      consumesSemiFinished: false,
      consumesRawMaterials: false,
      consumeOutputIds: [],
      consumeWorkflowNodeIds: [],
    });
  });

  it('does not rewrite a producing mix stage', () => {
    const mix = {
      stageCode: 'UPHOLSTERY',
      behavior: 'PRODUCES_SEMI_FINISHED' as const,
      consumesSemiFinished: false,
      consumeOutputIds: [] as string[],
    };
    expect(stripInspectionGateStage(mix)).toBe(mix);
    expect(mix.behavior).toBe('PRODUCES_SEMI_FINISHED');
  });
});
