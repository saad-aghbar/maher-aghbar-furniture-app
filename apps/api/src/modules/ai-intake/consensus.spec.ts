import {
  constrainItemToLibrary,
  mergeExtractionConsensus,
  type ExtractedLineItem,
  type ExtractionResult,
  type SpecExtractionContext,
} from '@maher/integrations';

const ctx: SpecExtractionContext = {
  optionGroups: [
    {
      code: 'FOAM_DENSITY',
      values: [{ code: 'D35', nameEn: 'D35', nameAr: 'D35' }],
    },
    {
      code: 'WOOD_TYPE',
      values: [{ code: 'BEECH', nameEn: 'Beech', nameAr: 'زان' }],
    },
  ],
};

function result(items: ExtractedLineItem[]): ExtractionResult {
  return {
    originalText: 'sheet',
    translatedText: items.map((row) => row.productName).join(' + '),
    detectedLanguage: 'ar',
    fields: [{ fieldName: 'product', fieldValue: items[0]?.productName ?? null, confidence: 0.9 }],
    items,
    provider: 'mock',
  };
}

describe('handwritten extraction consensus', () => {
  it('marks disagreed dimensions as low confidence', () => {
    const merged = mergeExtractionConsensus(
      result([{ productName: 'كرينا', width: '250', quantity: '1', confidence: 0.9 }]),
      result([{ productName: 'كرينا', width: '240', quantity: '1', confidence: 0.9 }]),
      ctx,
    );
    expect(merged.items?.[0]?.lowConfidenceFields).toContain('width');
    expect((merged.items?.[0]?.confidence ?? 1) < 0.7).toBe(true);
  });

  it('does not keep unrecognized foam as free text', () => {
    const next = constrainItemToLibrary(
      { productName: 'ميلانو', foamDensity: 'soft pink foam' },
      ctx,
    );
    expect(next.foamDensity).toBeNull();
    expect(next.unrecognizedOptions?.[0]).toContain('FOAM_DENSITY');
  });
});
