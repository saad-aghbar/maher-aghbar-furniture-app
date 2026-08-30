import { buildLocalizedStageInstructions } from '../buildLocalizedStageInstructions';

describe('buildLocalizedStageInstructions', () => {
  it('uses catalog Arabic for carpentry, not hardcoded literals in the caller', () => {
    const text = buildLocalizedStageInstructions({
      locale: 'ar',
      stageCode: 'CARPENTRY',
      stageName: 'النجارة',
      productDescription: 'كنبة',
      quantity: 2,
      specifications: 'قماش أزرق',
    });
    expect(text).toContain('نجارة لـ: كنبة × 2');
    expect(text).toContain('المواصفات: قماش أزرق');
    expect(text).toContain('قصّ وركّب');
  });

  it('falls back to DEFAULT copy for unknown stages', () => {
    const text = buildLocalizedStageInstructions({
      locale: 'en',
      stageCode: 'CUSTOM_STAGE',
      stageName: 'Special',
      productDescription: 'Chair',
      quantity: 1,
    });
    expect(text).toContain('Special for: Chair × 1');
    expect(text).toContain('shop drawing');
  });

  it('uses FOAM floor copy instead of DEFAULT', () => {
    const text = buildLocalizedStageInstructions({
      locale: 'en',
      stageCode: 'FOAM',
      stageName: 'Foam preparation',
      productDescription: 'Armchair',
      quantity: 1,
    });
    expect(text).toContain('Foam for: Armchair × 1');
    expect(text).toContain('approved pattern');
    expect(text).not.toContain('shop drawing');
  });

  it('localizes FOAM instructions in Arabic', () => {
    const text = buildLocalizedStageInstructions({
      locale: 'ar',
      stageCode: 'FOAM',
      stageName: 'تجهيز الإسفنج',
      productDescription: 'كنبة',
      quantity: 1,
    });
    expect(text).toContain('إسفنج لـ: كنبة × 1');
    expect(text).toContain('التنجيد');
  });

  it('localizes FOAM instructions in Hebrew', () => {
    const text = buildLocalizedStageInstructions({
      locale: 'he',
      stageCode: 'FOAM',
      stageName: 'הכנת ספוג',
      productDescription: 'כורסה',
      quantity: 1,
    });
    expect(text).toContain('ספוג עבור: כורסה × 1');
    expect(text).toContain('ריפוד');
  });
});
