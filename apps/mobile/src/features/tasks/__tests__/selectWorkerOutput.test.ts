import {
  buildWorkerOutputKits,
  extraPieceSortOrder,
  fallbackPiecePlan,
  nextExtraSortOrder,
  piecePlanFromOutput,
} from '../selectWorkerOutput';

describe('selectWorkerOutput', () => {
  it('synthesizes a piece plan when setup omitted names', () => {
    expect(fallbackPiecePlan(2)).toEqual([
      { index: 0, label: 'Piece 1', nameEn: 'Piece 1' },
      { index: 1, label: 'Piece 2', nameEn: 'Piece 2' },
    ]);
    expect(
      piecePlanFromOutput(
        {
          producesSemiFinished: true,
          expectedPieceCount: 1,
          requiresPhotos: true,
          kitId: null,
          qrCode: null,
          status: null,
          pieces: [],
          expectedPieces: [],
        },
        1,
      ),
    ).toHaveLength(1);
  });

  it('keeps only assigned kits and lists planned pieces under each', () => {
    const { kits, leftover } = buildWorkerOutputKits({
      expectedKitCount: 2,
      piecePlan: [
        { index: 0, label: 'Left rail', nameEn: 'Left rail' },
        { index: 1, label: 'Right rail', nameEn: 'Right rail' },
        { index: 2, label: 'Seat', nameEn: 'Seat' },
      ],
      pieces: [
        {
          id: 'p1',
          sortOrder: 0,
          label: 'Left rail',
          qrCode: null,
          photoDocumentId: 'd1',
        },
      ],
    });
    expect(kits).toHaveLength(2);
    expect(kits.every((kit) => kit.assigned)).toBe(true);
    expect(kits[0]?.pieces.map((s) => s.plan.label)).toEqual([
      'Left rail',
      'Right rail',
      'Seat',
    ]);
    expect(kits[0]?.pieces[0]?.existing?.id).toBe('p1');
    expect(kits[1]?.pieces[0]?.expectedIndex).toBe(3);
    expect(leftover).toEqual([]);
  });

  it('attaches worker-named extras to the kit they were added on', () => {
    const extra = extraPieceSortOrder(1, 0);
    const { kits } = buildWorkerOutputKits({
      expectedKitCount: 2,
      piecePlan: [{ index: 0, label: 'Frame', nameEn: 'Frame' }],
      pieces: [
        {
          id: 'extra-1',
          sortOrder: extra,
          label: 'Corner block',
          qrCode: null,
          photoDocumentId: 'd2',
        },
      ],
    });
    expect(kits[0]?.extras).toEqual([]);
    expect(kits[1]?.extras[0]?.existing?.label).toBe('Corner block');
    expect(nextExtraSortOrder(1, [{ id: 'extra-1', sortOrder: extra, label: 'Corner block', qrCode: null, photoDocumentId: 'd2' }])).toBe(
      extraPieceSortOrder(1, 1),
    );
  });
});
