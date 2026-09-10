import {
  checklistProgressPercent,
  inspectionItemsNeedResync,
  isPieceChecklistCode,
  pieceChecklistCode,
  piecesFromWipKits,
  selectKitsForInspection,
  wipPieceIdFromChecklistCode,
} from './inspection-pieces';

describe('inspection pieces', () => {
  it('builds one checklist row per named WIP piece', () => {
    const pieces = piecesFromWipKits([
      {
        id: 'kit-1',
        outputNameEn: 'Assembly kit',
        pieces: [
          { id: 'p1', label: 'Couch', sortOrder: 0 },
          { id: 'p2', label: 'Chair 1', sortOrder: 1 },
          { id: 'p3', label: 'Chair 2', sortOrder: 2 },
        ],
      },
    ]);
    expect(pieces.map((p) => p.label)).toEqual(['Couch', 'Chair 1', 'Chair 2']);
    expect(pieces[0]?.checklistCode).toBe(pieceChecklistCode('p1', 0));
    expect(wipPieceIdFromChecklistCode(pieces[0]?.checklistCode)).toBe('p1');
    expect(isPieceChecklistCode(pieces[0]?.checklistCode)).toBe(true);
  });

  it('computes checklist progress from passed items', () => {
    expect(
      checklistProgressPercent([{ result: 'PASS' }, { result: 'FAIL' }, { result: null }]),
    ).toBe(33);
    expect(checklistProgressPercent([])).toBe(0);
    expect(checklistProgressPercent([{ result: 'PASS' }, { result: 'PASS' }])).toBe(100);
  });

  it('keeps only kits that feed the inspection stage', () => {
    const edges = [{ fromSnapshotNodeId: 'uph', toSnapshotNodeId: 'insp' }];
    const kits = [
      { id: 'k-uph', snapshotNodeId: 'uph', nextSnapshotNodeIds: ['insp'] },
      { id: 'k-carp', snapshotNodeId: 'carp', nextSnapshotNodeIds: ['uph'] },
    ];
    expect(selectKitsForInspection(kits, 'insp', edges, ['uph']).map((k) => k.id)).toEqual(['k-uph']);
  });

  it('resyncs generic FINAL_QC rows onto piece codes', () => {
    expect(
      inspectionItemsNeedResync(
        [{ checklistCode: 'DIM' }, { checklistCode: 'FABRIC' }],
        [{ checklistCode: 'PIECE:p1' }],
      ),
    ).toBe(true);
    expect(
      inspectionItemsNeedResync(
        [{ checklistCode: 'PIECE:p1' }],
        [{ checklistCode: 'PIECE:p1' }],
      ),
    ).toBe(false);
  });
});
