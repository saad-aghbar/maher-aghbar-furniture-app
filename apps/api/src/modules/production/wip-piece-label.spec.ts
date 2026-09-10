import {
  fillPieceLabelsToCount,
  labelForPieceIndex,
  pieceLabelsFromMetadata,
} from './piece-labels';

describe('wip piece labels', () => {
  it('builds expectedPieces from snapshot metadata for the floor cards', () => {
    const labels = pieceLabelsFromMetadata({
      pieceLabels: [
        { nameEn: 'Left rail', nameAr: 'عارضة يسار', nameHe: 'מסילה שמאל' },
        { nameEn: 'Right rail', nameAr: 'عارضة يمين' },
      ],
    });
    const expectedPieces = labels.map((label, index) => ({
      index,
      label: label.nameEn,
      nameEn: label.nameEn,
      nameAr: label.nameAr,
      nameHe: label.nameHe,
    }));
    expect(expectedPieces).toEqual([
      {
        index: 0,
        label: 'Left rail',
        nameEn: 'Left rail',
        nameAr: 'عارضة يسار',
        nameHe: 'מסילה שמאל',
      },
      {
        index: 1,
        label: 'Right rail',
        nameEn: 'Right rail',
        nameAr: 'عارضة يمين',
        nameHe: null,
      },
    ]);
  });

  it('binds an expectedIndex to the plan name when the worker omits a label', () => {
    const labels = pieceLabelsFromMetadata({
      pieceLabels: [{ nameEn: 'Seat frame', nameAr: 'هيكل المقعد' }],
    });
    expect(labelForPieceIndex(labels, 0)).toBe('Seat frame');
  });

  it('fills unnamed slots so the floor never shows an empty assigned kit', () => {
    expect(fillPieceLabelsToCount([], 1)).toEqual([
      { nameEn: 'Piece 1', nameAr: 'قطعة 1', nameHe: 'חלק 1' },
    ]);
    expect(fillPieceLabelsToCount([{ nameEn: 'Seat', nameAr: 'مقعد', nameHe: null }], 2)).toEqual([
      { nameEn: 'Seat', nameAr: 'مقعد', nameHe: null },
      { nameEn: 'Piece 2', nameAr: 'قطعة 2', nameHe: 'חלק 2' },
    ]);
  });

  it('keeps a worker-given ad hoc name for the next-stage incoming kit', () => {
    const incomingPieces = [
      { id: 'p1', sortOrder: 0, label: 'Extra brace', photoDocumentId: 'd1' },
    ];
    expect(incomingPieces[0]?.label).toBe('Extra brace');
  });
});
