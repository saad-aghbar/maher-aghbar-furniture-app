import {
  compositionToPiecePlan,
  persistMeasurementsRoundTrip,
  productAsDefaultVariant,
  renderVariantSpecLine,
  resolveEffectiveVariant,
  resolveVariantStageConfig,
  type ProductLike,
  type ProductVariantLike,
} from './product-variant';

const product: ProductLike = {
  id: 'p-karina',
  sku: 'SOF-KARINA',
  nameAr: 'كرينا',
  nameEn: 'Karina',
  nameHe: 'קרינה',
  basePrice: 1280,
  manufacturingCost: 610,
  width: 200,
  height: 90,
  depth: 90,
  seatHeight: 42,
  bomDefaults: { materials: [{ sku: 'MAT-FOAM-MD', qty: 2 }] },
  adminNotes: 'product admin',
};

const karina: ProductVariantLike = {
  id: 'v-ukr',
  productId: 'p-karina',
  sku: 'SOF-KARINA-UKR',
  code: 'UKR',
  nameAr: 'أوكرانيه',
  nameEn: 'Ukrainian',
  nameHe: 'אוקראינית',
  isDefault: false,
  basePrice: 1420,
  width: null,
  measurements: [
    { key: 'width', labelAr: 'ص', labelEn: 'W', labelHe: 'ר', value: 1.15, unit: 'm' },
    { key: 'length', labelAr: 'م', labelEn: 'L', labelHe: 'א', value: 1.7, unit: 'm' },
    { key: 'depth', labelAr: 'العمق', labelEn: 'Depth', labelHe: 'עומק', value: 85, unit: 'cm' },
  ],
  composition: [
    { labelAr: 'ثنائي', labelEn: '2-seater', labelHe: 'דו', qty: 1 },
    { labelAr: 'أحادي', labelEn: '1-seater', labelHe: 'יחיד', qty: 1 },
    { labelAr: 'بف', labelEn: 'puff', labelHe: 'הדום', qty: 1 },
  ],
  options: [
    { groupCode: 'PAINT_COLOR', code: 'GOLD', nameAr: 'ذهبي', nameEn: 'Gold', nameHe: 'זהב' },
    { groupCode: 'FOAM_DENSITY', code: 'D35', nameAr: 'إسفنج 35', nameEn: 'Foam 35', nameHe: 'ספוג 35' },
    { groupCode: 'FABRIC_FINISH', code: 'MATTE', nameAr: 'مت', nameEn: 'Matte', nameHe: 'מט' },
    { groupCode: 'PIPING_STYLE', code: 'BACK_SAME', nameAr: 'بريم داير الظهر نفس اللون', nameEn: 'piping around the back, same colour' },
    { groupCode: 'LEG_TYPE', code: 'RING_9', nameAr: 'حلق ارتفاع 9 سم', nameEn: 'Ring 9 cm', nameHe: 'טבעת 9 ס״מ' },
  ],
  includedItems: [
    { nameAr: 'قرن 47×47 سم', nameEn: 'Cushion 47×47 cm', qty: 4, width: 47, height: 47, unit: 'cm' },
    { nameAr: 'قرن 55×35 سم', nameEn: 'Cushion 55×35 cm', qty: 2, width: 55, height: 35, unit: 'cm' },
    { nameAr: 'قرنة كرة قدم الحجم الصغير', nameEn: 'Small football cushion', qty: 1 },
  ],
  factoryNotesAr: 'لف بسيط مع بدون كوع',
  factoryNotesEn: 'Simple wrap without elbow',
};

describe('resolveEffectiveVariant', () => {
  it('treats null variant as the default product variant', () => {
    const fromNull = resolveEffectiveVariant({ product, variant: null });
    const fromDefault = resolveEffectiveVariant({
      product,
      variant: productAsDefaultVariant(product),
    });
    expect(fromNull.sku).toBe('SOF-KARINA-STD');
    expect(fromNull.width).toBe(200);
    expect(fromNull.basePrice).toBe(1280);
    expect(fromNull.bomDefaults).toEqual(fromDefault.bomDefaults);
    expect(fromNull.measurements.find((m) => m.key === 'width')?.unit).toBe('cm');
  });

  it('lets variant overrides win and missing fields fall through', () => {
    const effective = resolveEffectiveVariant({ product, variant: karina });
    expect(effective.basePrice).toBe(1420);
    expect(effective.height).toBe(90);
    expect(effective.manufacturingCost).toBe(610);
    expect(effective.width).toBe(200);
    expect(effective.nameAr).toBe('أوكرانيه');
  });
});

describe('measurements round-trip', () => {
  it('persists 1.15 m and 85 cm exactly as entered', () => {
    const rows = persistMeasurementsRoundTrip(karina.measurements ?? []);
    expect(rows.find((r) => r.key === 'width')).toEqual({
      key: 'width',
      labelAr: 'ص',
      labelEn: 'W',
      labelHe: 'ר',
      value: 1.15,
      unit: 'm',
    });
    expect(rows.find((r) => r.key === 'depth')).toMatchObject({ value: 85, unit: 'cm' });
  });
});

describe('compositionToPiecePlan', () => {
  it('turns 2+1+بف into expectedPieceCount 3 with piece labels', () => {
    const plan = compositionToPiecePlan(karina.composition);
    expect(plan.expectedPieceCount).toBe(3);
    expect(plan.pieceLabels.map((p) => p.nameAr)).toEqual(['ثنائي', 'أحادي', 'بف']);
  });
});

describe('renderVariantSpecLine', () => {
  const effective = resolveEffectiveVariant({ product, variant: karina });

  it('reproduces the sample sheet line in ar / en / he', () => {
    const ar = renderVariantSpecLine(effective, 'ar');
    expect(ar).toContain('أوكرانيه');
    expect(ar).toContain('1.15 m');
    expect(ar).toContain('85 cm');
    expect(ar).toContain('ذهبي');
    expect(ar).toContain('إسفنج 35');
    expect(ar).toContain('حلق ارتفاع 9');
    expect(ar).toContain('4×قرن 47×47');
    expect(ar).toContain('لف بسيط مع بدون كوع');

    const en = renderVariantSpecLine(effective, 'en');
    expect(en).toContain('Ukrainian');
    expect(en).toContain('1.15 m');
    expect(en).toContain('Gold');

    const he = renderVariantSpecLine(effective, 'he');
    expect(he).toContain('אוקראינית');
    expect(he).toContain('1.15 m');
  });
});

describe('default-variant backfill guard', () => {
  it('is idempotent: skip when a default or STD sku exists', () => {
    const shouldCreate = (
      existing: Array<{ isDefault: boolean; sku: string }>,
      productSku: string,
    ) =>
      !existing.some((v) => v.isDefault) &&
      !existing.some((v) => v.sku === `${productSku}-STD`);
    expect(shouldCreate([], 'SOF-3S')).toBe(true);
    expect(shouldCreate([{ isDefault: true, sku: 'SOF-3S-STD' }], 'SOF-3S')).toBe(false);
    expect(shouldCreate([{ isDefault: false, sku: 'SOF-3S-STD' }], 'SOF-3S')).toBe(false);
  });
});

describe('resolveVariantStageConfig', () => {
  it('uses variant rows when present and falls back to product-level rows', () => {
    const productRows = {
      profile: { id: 'prof-p', variantId: null, bufferPercent: 10 },
      estimates: [{ id: 'est-p', variantId: null, minutesPerUnit: 40 }],
      materialInputs: [{ id: 'mat-p', variantId: null, sku: 'MAT-FOAM-MD' }],
      inventoryOutputs: [{ id: 'out-p', variantId: null }],
      inventoryInputs: [],
      stageOverrides: [],
    };
    const variantRows = {
      estimates: [{ id: 'est-v', variantId: 'v-ukr', minutesPerUnit: 55 }],
      materialInputs: [] as Array<{ id: string; variantId: string | null }>,
    };
    const resolved = resolveVariantStageConfig({
      variantId: 'v-ukr',
      productRows,
      variantRows,
    });
    expect(resolved.estimates[0]?.id).toBe('est-v');
    expect(resolved.materialInputs[0]?.id).toBe('mat-p');
    expect(resolved.profile?.id).toBe('prof-p');
  });
});
