import { mergeQuotationDraftLines } from './merge-quotation-draft-lines';

describe('mergeQuotationDraftLines', () => {
  const existing = [
    {
      id: 'ql-1',
      productId: 'prod-1',
      variantId: 'var-1',
      variantSku: 'KAR-UK',
      variantLabel: 'Ukrainian',
      description: 'Karina',
      quantity: 2,
      fabrics: [{ type: 'Linen', color: 'Sand' }],
      customMeasurements: [{ label: 'Seat', value: '45' }],
      lineSpec: { woodType: 'Oak', notes: 'Match showroom', options: [{ nameEn: 'Piping' }] },
      photoDocumentIds: ['doc-a'],
      primaryImageDocumentId: 'doc-a',
      manufacturingComplexity: 'MODIFIED',
    },
  ];

  it('keeps lineSpec, photos, fabrics, and measurements when the client sends prices only', () => {
    const merged = mergeQuotationDraftLines(existing, [
      {
        id: 'ql-1',
        description: 'Karina',
        quantity: 2,
        unitPrice: 1200,
      },
    ]);
    expect(merged[0]?.lineSpec).toEqual(existing[0]?.lineSpec);
    expect(merged[0]?.photoDocumentIds).toEqual(['doc-a']);
    expect(merged[0]?.primaryImageDocumentId).toBe('doc-a');
    expect(merged[0]?.fabrics).toEqual([{ type: 'Linen', color: 'Sand' }]);
    expect(merged[0]?.customMeasurements).toEqual([{ label: 'Seat', value: '45' }]);
    expect(merged[0]?.variantId).toBe('var-1');
    expect(merged[0]?.unitPrice).toBe(1200);
  });

  it('matches by line id even when array order changes', () => {
    const two = [
      existing[0]!,
      { ...existing[0]!, id: 'ql-2', description: 'Custom chair', variantId: null, photoDocumentIds: ['doc-b'] },
    ];
    const merged = mergeQuotationDraftLines(two, [
      { id: 'ql-2', description: 'Custom chair', quantity: 1, unitPrice: 800 },
      { id: 'ql-1', description: 'Karina', quantity: 2, unitPrice: 900 },
    ]);
    expect(merged[0]?.photoDocumentIds).toEqual(['doc-b']);
    expect(merged[1]?.photoDocumentIds).toEqual(['doc-a']);
    expect(merged[1]?.lineSpec).toEqual(existing[0]?.lineSpec);
  });
});
