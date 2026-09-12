import {
  previewHasLowConfidence,
  previewItemsToScanLines,
  SCAN_REVIEW_FIELDS,
  scanLineNeedsConfirm,
  scanLinesToBasket,
  scanReviewCanConfirm,
  touchScanField,
} from '../scanReview';

describe('scan review', () => {
  it('reviews fabric, colour and notes on the line', () => {
    expect(SCAN_REVIEW_FIELDS).toEqual(
      expect.arrayContaining(['fabricType', 'woodColor', 'notes']),
    );
  });

  const items = [
    {
      productName: 'كرينا',
      quantity: '1',
      width: '250',
      height: '90',
      depth: '95',
      fabric: 'Velvet',
      material: 'Beech',
      notes: 'Gold piping',
      variantLabel: 'أوكرانيه',
      woodColor: 'Walnut',
      foamDensity: 'D35',
      woodType: 'BEECH',
      finish: 'GOLD',
      optionCodes: ['D35', 'GOLD'],
      confidence: 0.92,
      lowConfidenceFields: [] as string[],
    },
    {
      productName: 'ميلانو',
      quantity: '2',
      width: '160',
      foamDensity: 'D40',
      confidence: 0.42,
      lowConfidenceFields: ['width', 'fabric'],
      unrecognizedOptions: ['FOAM_DENSITY:soft'],
    },
  ];

  it('blocks confirm until low-confidence dimensions and unrecognized options are touched', () => {
    const lines = previewItemsToScanLines(items);
    expect(previewHasLowConfidence(items)).toBe(true);
    expect(scanReviewCanConfirm(lines)).toBe(false);
    expect(scanLineNeedsConfirm(lines[1]!)).toBe(true);
    expect(lines[1]!.lowConfidenceFields).toEqual(expect.arrayContaining(['width', 'fabricType']));
    const touched = touchScanField(touchScanField(touchScanField(lines[1]!, 'width'), 'productName'), 'fabricType');
    expect(scanLineNeedsConfirm({ ...touched, unrecognizedNoted: true })).toBe(false);
    expect(
      scanReviewCanConfirm([
        lines[0]!,
        { ...touched, unrecognizedNoted: true },
      ]),
    ).toBe(true);
  });

  it('maps every extracted field onto the basket line, not the order note', () => {
    const lines = previewItemsToScanLines(items, [
      { id: 'p-karina', nameAr: 'كرينا', nameEn: 'Karina' },
    ]);
    const basket = scanLinesToBasket(lines);
    expect(basket).toHaveLength(2);
    expect(basket[0]).toMatchObject({
      productId: 'p-karina',
      customProductName: 'كرينا',
      quantity: '1',
      dimWidth: '250',
      dimHeight: '90',
      dimDepth: '95',
      foamDensity: 'D35',
      woodType: 'BEECH',
      woodColor: 'Walnut',
      finish: 'GOLD',
      variantLabel: 'أوكرانيه',
    });
    expect(basket[0]?.fabrics[0]?.type).toBe('Velvet');
    expect(basket[0]?.notes).toContain('Gold piping');
    expect(basket[0]?.notes).toContain('Material: Beech');
    expect(basket[0]?.notes).toContain('Options: D35, GOLD');
    expect(basket[1]?.options).toEqual([]);
  });

  it('accepts fabricType from the staff mapper alias', () => {
    const lines = previewItemsToScanLines([
      {
        productName: 'كرينا',
        fabricType: 'Chenille',
        notes: 'Piping',
        confidence: 0.9,
        lowConfidenceFields: [],
      },
    ]);
    const basket = scanLinesToBasket(lines);
    expect(basket[0]?.fabrics[0]?.type).toBe('Chenille');
    expect(basket[0]?.notes).toBe('Piping');
  });
});
