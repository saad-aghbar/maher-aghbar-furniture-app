import {
  isPackagingStageCode,
  labelForPieceIndex,
  mergeSnapshotMetadata,
  normalizePieceLabels,
  packLabelForPieceIndex,
  pieceLabelsFromMetadata,
} from './piece-labels';

describe('piece-labels', () => {
  it('parses named pieces and drops blank English names', () => {
    expect(
      normalizePieceLabels([
        { nameEn: ' Left rail ', nameAr: 'عارضة يسار', nameHe: null },
        { nameEn: '', nameAr: 'تجاهل' },
        { nameEn: 'Headboard' },
      ]),
    ).toEqual([
      { nameEn: 'Left rail', nameAr: 'عارضة يسار', nameHe: null },
      { nameEn: 'Headboard', nameAr: 'Headboard', nameHe: null },
    ]);
  });

  it('falls back to Piece N when a label is missing', () => {
    expect(labelForPieceIndex([{ nameEn: 'Rail', nameAr: 'عارضة', nameHe: null }], 0)).toBe(
      'Rail',
    );
    expect(labelForPieceIndex([], 1)).toBe('Piece 2');
  });

  it('reads pieceLabels from snapshot metadata', () => {
    expect(
      pieceLabelsFromMetadata({
        pieceLabels: [{ nameEn: 'Seat', nameAr: 'مقعد' }],
      }),
    ).toEqual([{ nameEn: 'Seat', nameAr: 'مقعد', nameHe: null }]);
    expect(pieceLabelsFromMetadata(null)).toEqual([]);
  });

  it('merges pieceLabels into existing metadata without dropping other keys', () => {
    expect(
      mergeSnapshotMetadata({ color: 'walnut' }, [
        { nameEn: 'Rail', nameAr: 'عارضة', nameHe: null },
      ]),
    ).toEqual({
      color: 'walnut',
      pieceLabels: [{ nameEn: 'Rail', nameAr: 'عارضة', nameHe: null }],
    });
    expect(mergeSnapshotMetadata({ color: 'walnut' }, [])).toEqual({ color: 'walnut' });
  });

  it('identifies packaging stage codes', () => {
    expect(isPackagingStageCode('PACKAGING')).toBe(true);
    expect(isPackagingStageCode('packaging')).toBe(true);
    expect(isPackagingStageCode('ASSEMBLY')).toBe(false);
  });

  it('cycles packaging labels for multi-unit piece indexes', () => {
    const labels = [
      { nameEn: 'A', nameAr: 'أ', nameHe: null },
      { nameEn: 'legs', nameAr: 'أرجل', nameHe: null },
      { nameEn: '3', nameAr: '3', nameHe: null },
    ];
    expect(packLabelForPieceIndex(labels, 1, 3)?.nameEn).toBe('A');
    expect(packLabelForPieceIndex(labels, 2, 3)?.nameEn).toBe('legs');
    expect(packLabelForPieceIndex(labels, 4, 3)?.nameEn).toBe('A');
    expect(packLabelForPieceIndex(labels, 6, 3)?.nameEn).toBe('3');
  });
});
