import {
  classifyInspectionItems,
  inspectionSubmitGate,
  mergeChecklistPatches,
  pieceReworkPlans,
} from './quality-inspection-submit';

describe('quality inspection submit helpers', () => {
  it('confirms inspection without piece checklist items', () => {
    expect(inspectionSubmitGate('PASSED')).toEqual({
      wantsPass: true,
      wantsFail: false,
      allPass: true,
      skipPiecePlans: true,
    });
    expect(inspectionSubmitGate('FAILED_REWORK_REQUIRED').skipPiecePlans).toBe(true);
    expect(inspectionSubmitGate(null).allPass).toBe(false);
  });

  it('classifies mixed pass/fail as partial', () => {
    const c = classifyInspectionItems([
      { result: 'PASS' },
      { result: 'FAIL' },
      { result: null },
    ]);
    expect(c).toMatchObject({
      total: 3,
      passed: 1,
      failed: 1,
      pending: 1,
      allPass: false,
      hasFail: true,
      complete: false,
      isPartial: true,
    });
  });

  it('classifies all pass', () => {
    expect(classifyInspectionItems([{ result: 'PASS' }, { result: 'PASS' }]).allPass).toBe(
      true,
    );
  });

  it('builds one rework plan per failed piece with multi-stage re-entry', () => {
    const plans = pieceReworkPlans(
      [
        {
          id: 'item-1',
          checklistCode: 'PIECE:p1',
          result: 'FAIL',
          note: 'Loose joint',
          wipPieceId: 'p1',
          reentryStageInstanceIds: ['carp', 'uph'],
        },
        {
          id: 'item-2',
          checklistCode: 'PIECE:p2',
          result: 'PASS',
          wipPieceId: 'p2',
          reentryStageInstanceIds: [],
        },
      ],
      'fallback',
    );
    expect(plans).toEqual([
      {
        inspectionItemId: 'item-1',
        wipPieceId: 'p1',
        checklistCode: 'PIECE:p1',
        description: 'Loose joint',
        stageInstanceIds: ['carp', 'uph'],
      },
    ]);
  });

  it('merges per-piece fail patches onto existing items', () => {
    const merged = mergeChecklistPatches(
      [
        {
          id: 'i1',
          checklistCode: 'PIECE:p1',
          result: null,
          wipPieceId: 'p1',
          reentryStageInstanceIds: [],
          photoDocumentIds: [],
        },
      ],
      [
        {
          checklistCode: 'PIECE:p1',
          result: 'FAIL',
          note: 'Tear',
          reentryStageInstanceIds: ['uph-1'],
          voiceDocumentId: 'v1',
          photoDocumentIds: ['ph1'],
        },
      ],
    );
    expect(merged[0]).toMatchObject({
      result: 'FAIL',
      note: 'Tear',
      reentryStageInstanceIds: ['uph-1'],
      voiceDocumentId: 'v1',
      photoDocumentIds: ['ph1'],
    });
  });
});
