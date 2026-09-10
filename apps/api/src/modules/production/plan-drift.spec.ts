import { detectPlanDrift } from './plan-drift';

describe('detectPlanDrift', () => {
  it('flags tracking and piece-label drift against catalog setup', () => {
    const issues = detectPlanDrift(
      [
        {
          snapshotNodeId: 'snap-1',
          stageCode: 'CARPENTRY',
          stageDefinitionId: 'stage-carpentry',
          sourceWorkflowNodeId: 'node-v2',
          inventoryTracking: 'NONE',
          consumesSemiFinished: false,
          expectedPieceCount: 1,
          pieceLabels: [],
        },
      ],
      [
        {
          workflowNodeId: 'node-v1',
          stageDefinitionId: 'stage-carpentry',
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesSemiFinished: false,
          expectedPieceCount: 3,
          pieceLabels: [{ nameEn: 'Couch' }, { nameEn: 'Chair 1' }, { nameEn: 'Chair 2' }],
        },
      ],
    );
    expect(issues.map((i) => i.field).sort()).toEqual(
      expect.arrayContaining(['inventoryTracking', 'expectedPieceCount', 'pieceLabels']),
    );
  });

  it('is quiet when snapshot matches catalog', () => {
    const issues = detectPlanDrift(
      [
        {
          snapshotNodeId: 'snap-1',
          stageCode: 'CARPENTRY',
          stageDefinitionId: 'stage-carpentry',
          sourceWorkflowNodeId: 'node-1',
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesSemiFinished: false,
          expectedPieceCount: 2,
          pieceLabels: [{ nameEn: 'Rail' }, { nameEn: 'Seat' }],
        },
      ],
      [
        {
          workflowNodeId: 'node-1',
          stageDefinitionId: 'stage-carpentry',
          inventoryTracking: 'PRODUCES_SEMI_FINISHED',
          consumesSemiFinished: false,
          expectedPieceCount: 2,
          pieceLabels: [{ nameEn: 'Rail' }, { nameEn: 'Seat' }],
        },
      ],
    );
    expect(issues).toEqual([]);
  });
});
