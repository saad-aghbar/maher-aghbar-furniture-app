import {
  compositionFromIncomingPieces,
  expectedPackageLabelList,
  expectedPackagesFromIncomingPieces,
  fallbackExpectedPackages,
  resolveExpectedPackages,
} from './prior-stage-packages';

describe('prior-stage packages', () => {
  const pieces = [
    {
      wipPieceId: 'a',
      checklistCode: 'PIECE:a',
      label: 'Puff',
      photoDocumentId: null,
      kitId: 'k1',
      kitLabel: 'Upholstery',
      kitLabelAr: 'بف',
    },
    {
      wipPieceId: 'b',
      checklistCode: 'PIECE:b',
      label: '1-seater',
      photoDocumentId: null,
      kitId: 'k1',
      kitLabel: 'Upholstery',
    },
  ];

  it('maps previous-stage pieces to packaging rows', () => {
    expect(expectedPackagesFromIncomingPieces(pieces)).toEqual([
      { code: 'P1', labelEn: 'Puff', labelAr: 'بف' },
      { code: 'P2', labelEn: '1-seater', labelAr: undefined },
    ]);
  });

  it('joins piece labels for the paper composition line', () => {
    expect(compositionFromIncomingPieces(pieces)).toBe('Puff + 1-seater');
    expect(compositionFromIncomingPieces([])).toBeNull();
  });

  it('prefers incoming pieces over the packaging snapshot', () => {
    const resolved = resolveExpectedPackages({
      incoming: pieces,
      snapshotLabels: [{ nameEn: 'Crate A' }],
      snapshotCount: 9,
    });
    expect(expectedPackageLabelList(resolved)).toEqual(['Puff', '1-seater']);
  });

  it('falls back to snapshot labels then a single package', () => {
    expect(
      resolveExpectedPackages({
        incoming: [],
        snapshotLabels: [{ nameEn: 'Crate A', nameAr: 'صندوق' }],
        snapshotCount: 9,
      }),
    ).toEqual([{ code: 'P1', labelEn: 'Crate A', labelAr: 'صندوق' }]);
    expect(fallbackExpectedPackages([], 0)).toEqual([{ code: 'P1', labelEn: 'Package 1' }]);
  });
});
