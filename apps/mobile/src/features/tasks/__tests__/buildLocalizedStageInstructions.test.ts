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
});
