import {
  allInspectionPiecesPassed,
  buildInspectionSpecRows,
  buildPartialFailChecklistResults,
  buildPassChecklistResults,
  dealerDetailRows,
  formatSpecRecord,
  groupChecklistByKit,
  paperCustomNotes,
  pieceInspectionResult,
  splitCatalogHint,
} from '../inspectionChecklist';

describe('inspectionChecklist', () => {
  const items = [
    { id: '1', checklistCode: 'PIECE:a', label: 'Couch' },
    { id: '2', checklistCode: 'PIECE:b', label: 'Chair 1', result: 'PASS' },
    { id: '3', checklistCode: 'PIECE:c', label: 'Chair 2', result: 'FAIL' },
  ];

  it('treats local pass as passed and stored fail as failed', () => {
    expect(pieceInspectionResult(items[0]!, { 'PIECE:a': true })).toBe('PASS');
    expect(pieceInspectionResult(items[1]!, {})).toBe('PASS');
    expect(pieceInspectionResult(items[2]!, { 'PIECE:c': true })).toBe('FAIL');
  });

  it('requires every piece to pass', () => {
    expect(allInspectionPiecesPassed(items, { 'PIECE:a': true })).toBe(false);
    expect(
      allInspectionPiecesPassed(
        items.filter((i) => i.result !== 'FAIL'),
        { 'PIECE:a': true },
      ),
    ).toBe(true);
  });

  it('builds pass checklist for the whole kit', () => {
    expect(buildPassChecklistResults(items)).toEqual([
      { checklistCode: 'PIECE:a', result: 'PASS' },
      { checklistCode: 'PIECE:b', result: 'PASS' },
      { checklistCode: 'PIECE:c', result: 'PASS' },
    ]);
  });

  it('sends only decided pieces on a partial fail', () => {
    const rows = buildPartialFailChecklistResults({
      items,
      localPass: { 'PIECE:a': true },
      failedCode: 'PIECE:c',
      defectDescription: 'Loose arm',
      reentryStageInstanceIds: ['st-1', 'st-2'],
    });
    expect(rows).toEqual([
      { checklistCode: 'PIECE:a', result: 'PASS' },
      { checklistCode: 'PIECE:b', result: 'PASS' },
      {
        checklistCode: 'PIECE:c',
        result: 'FAIL',
        note: 'Loose arm',
        defectDescription: 'Loose arm',
        reentryStageInstanceIds: ['st-1', 'st-2'],
        voiceDocumentId: undefined,
        photoDocumentIds: undefined,
      },
    ]);
  });

  it('formats width/depth/height records', () => {
    expect(formatSpecRecord({ width: 200, depth: 90, height: 80 })).toBe('200 × 90 × 80');
  });

  it('builds labeled inspect rows for fabric, height, and color', () => {
    const rows = buildInspectionSpecRows({
      locale: 'en',
      identity: {
        productName: 'Luna sofa',
        productionOrderNumber: 'PO-1',
        salesOrderNumber: 'SO-1',
        dealerName: 'Oasis',
        quantity: 1,
      },
      spec: {
        complexity: 'MODIFIED',
        orderDimensions: { width: 200, height: 80, depth: 90, seatHeight: 45 },
        catalogDimensions: { width: 180, height: 80, depth: 90, seatHeight: 45 },
        fabric: { nameEn: 'Velvet', sku: 'V-1', color: 'Sand' },
        color: 'Sand',
        wood: { nameEn: 'Oak', sku: 'WD-1' },
        factoryNotes: 'Match sample',
        lineSpec: 'Wider arms',
      },
    });
    expect(rows.find((r) => r.key === 'product')?.value).toBe('Luna sofa');
    expect(rows.find((r) => r.key === 'height')?.value).toBe('80');
    expect(rows.find((r) => r.key === 'width')?.value).toBe('200|||180');
    expect(splitCatalogHint('200|||180')).toEqual({ value: '200', catalog: '180' });
    expect(rows.find((r) => r.key === 'fabric')?.value).toBe('Velvet');
    expect(rows.find((r) => r.key === 'color')?.value).toBe('Sand');
    expect(rows.find((r) => r.key === 'wood')?.value).toContain('Oak');
    expect(rows.find((r) => r.key === 'seatHeight')?.value).toBe('45');
  });

  it('groups checklist rows by previous-stage kit', () => {
    const groups = groupChecklistByKit([
      { checklistCode: 'PIECE:a', kitId: 'k1', kitLabel: 'Upholstery kit', label: 'Seat' },
      { checklistCode: 'PIECE:b', kitId: 'k1', kitLabel: 'Upholstery kit', label: 'Back' },
      { checklistCode: 'PIECE:c', kitId: 'k2', kitLabel: 'Frame kit', label: 'Frame' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map((i) => i.label)).toEqual(['Seat', 'Back']);
    expect(groups[1]?.kitLabel).toBe('Frame kit');
  });

  it('lists dealer fabric and foam on the inspect rows', () => {
    const rows = dealerDetailRows({
      fabricType: 'Velvet',
      fabricColor: 'Navy',
      foamDensity: '35kg',
      width: '220',
      height: '85',
    });
    expect(rows.find((r) => r.key === 'fabric')?.value).toBe('Velvet · Navy');
    expect(rows.find((r) => r.key === 'foam')?.value).toBe('35kg');
    expect(rows.find((r) => r.key === 'height')?.value).toBe('85');
  });

  it('collects custom notes without duplicates', () => {
    expect(
      paperCustomNotes({
        factoryNotes: 'Length +5, left side without armrest',
        lineNotes: 'Length +5, left side without armrest',
        description: 'Matte gold frame',
      }),
    ).toEqual(['Length +5, left side without armrest', 'Matte gold frame']);
  });
});
