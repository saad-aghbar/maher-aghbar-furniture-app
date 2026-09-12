import {
  classifyManufacturingComplexity,
  optionValueDiffers,
  buildOrderLineSpecSnapshot,
} from './manufacturing-complexity';
import { catalogDimRefFromEffective, resolveEffectiveVariant } from './product-variant';

const karinaProduct = {
  id: 'p-karina',
  sku: 'KARINA',
  nameAr: 'كرينا',
  nameEn: 'Karina',
  width: 220,
  height: 85,
  depth: 95,
  seatHeight: 45,
};

const karina250 = {
  id: 'v-250',
  productId: 'p-karina',
  sku: 'KARINA-250',
  code: '250',
  nameAr: 'أوكرانيه',
  nameEn: 'Ukrainian',
  isDefault: false,
  width: 250,
  height: 85,
  depth: 95,
  seatHeight: 45,
  composition: [
    { labelAr: '2', labelEn: '2-seater', qty: 1 },
    { labelAr: '1', labelEn: '1-seater', qty: 1 },
    { labelAr: 'بف', labelEn: 'Puff', qty: 1 },
  ],
  includedItems: [{ nameAr: 'قرن', nameEn: 'Cushion', qty: 7, unit: 'pcs' }],
  options: [
    { groupCode: 'FOAM_DENSITY', code: 'D35', nameEn: 'Foam 35' },
    { groupCode: 'PAINT_COLOR', code: 'GOLD', nameEn: 'Gold' },
    { groupCode: 'PIPING_STYLE', code: 'BACK_MATCH', nameEn: 'Piping around back' },
    { groupCode: 'CUSHION_SIZE', code: '47x47', nameEn: '47×47', qty: 4 },
  ],
};

describe('classifyManufacturingComplexity vs effective variant', () => {
  const catalog = catalogDimRefFromEffective(
    resolveEffectiveVariant({ product: karinaProduct, variant: karina250 }),
  );

  it('keeps a variant carrying foam, paint, piping and cushions as STANDARD', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p-karina',
        variantId: 'v-250',
        width: 250,
        height: 85,
        depth: 95,
        foamDensity: 'D35',
        finish: 'GOLD',
        accessories: 'BACK_MATCH',
        options: [
          { groupCode: 'FOAM_DENSITY', code: 'D35' },
          { groupCode: 'PAINT_COLOR', code: 'GOLD' },
          { groupCode: 'PIPING_STYLE', code: 'BACK_MATCH' },
        ],
        catalog,
      }),
    ).toBe('STANDARD');
  });

  it('treats a 250cm line on the 250cm variant as STANDARD', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p-karina',
        variantId: 'v-250',
        width: 250,
        height: 85,
        depth: 95,
        catalog,
      }),
    ).toBe('STANDARD');
  });

  it('treats a 250cm line on the default 220cm product as MODIFIED', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p-karina',
        width: 250,
        height: 85,
        depth: 95,
        catalog: {
          width: 220,
          height: 85,
          depth: 95,
        },
      }),
    ).toBe('MODIFIED');
  });

  it('marks a foam change against the variant as MODIFIED', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p-karina',
        variantId: 'v-250',
        width: 250,
        foamDensity: 'D40',
        catalog,
      }),
    ).toBe('MODIFIED');
  });

  it('marks a line with no productId as CUSTOM', () => {
    expect(classifyManufacturingComplexity({ productId: null, width: 300 })).toBe('CUSTOM');
  });
});

describe('optionValueDiffers', () => {
  it('does not treat an empty order value as a change', () => {
    expect(optionValueDiffers(null, 'D35')).toBe(false);
  });

  it('treats a matching code as unchanged', () => {
    expect(optionValueDiffers('D35', 'd35')).toBe(false);
  });

  it('treats an ordered value with no catalog standard as a change', () => {
    expect(optionValueDiffers('D35', null)).toBe(true);
  });
});

describe('buildOrderLineSpecSnapshot', () => {
  it('carries variant identity, composition, options and included items', () => {
    const catalog = catalogDimRefFromEffective(
      resolveEffectiveVariant({ product: karinaProduct, variant: karina250 }),
    );
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p-karina',
      variantId: 'v-250',
      variantSku: 'KARINA-250',
      variantLabel: 'أوكرانيه',
      productName: 'كرينا',
      quantity: 1,
      width: 250,
      height: 85,
      depth: 95,
      foamDensity: 'D35',
      orientation: 'LEFT',
      catalog,
    });
    expect(snap.manufacturingComplexity).toBe('STANDARD');
    expect(snap.variantId).toBe('v-250');
    expect(snap.variantSku).toBe('KARINA-250');
    expect(snap.orientation).toBe('LEFT');
    expect(snap.composition).toEqual(karina250.composition);
    expect(snap.includedItems).toEqual(karina250.includedItems);
    expect(snap.options).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'D35' })]));
  });
});
