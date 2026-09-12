import { classifyRequestItemDto, mapRequestItemCreate } from './request-line-classify';

describe('classifyRequestItemDto', () => {
  const catalog = {
    id: 'p1',
    width: 220,
    height: 85,
    depth: 95,
    seatHeight: 45,
    customMeasurements: [{ nameEn: 'Arm', nameAr: 'ذراع', value: 60 }],
  };

  it('keeps catalog-seeded measurements and fabric as STANDARD', () => {
    expect(
      classifyRequestItemDto(
        {
          productName: 'Milano Sofa',
          productId: 'p1',
          quantity: 1,
          width: 220,
          height: 85,
          depth: 95,
          fabric: 'Linen',
          color: 'Sand',
          notes: 'Please use customer fabric',
          customMeasurements: [
            { label: 'Seat height (cm)', value: '45' },
            { label: 'Arm', value: '60' },
          ],
        },
        catalog,
      ),
    ).toBe('STANDARD');
  });

  it('marks a real dimension change as MODIFIED', () => {
    expect(
      classifyRequestItemDto(
        {
          productName: 'Milano Sofa',
          productId: 'p1',
          quantity: 1,
          width: 240,
          height: 85,
          depth: 95,
        },
        catalog,
      ),
    ).toBe('MODIFIED');
  });

  it('marks a line with no productId as CUSTOM', () => {
    expect(
      classifyRequestItemDto({
        productName: 'Custom corner',
        quantity: 1,
        width: 300,
      }),
    ).toBe('CUSTOM');
  });

  it('keeps a variant with foam, paint, piping and cushions as STANDARD', () => {
    expect(
      classifyRequestItemDto(
        {
          productName: 'Karina',
          productId: 'p1',
          variantId: 'v-250',
          quantity: 1,
          width: 250,
          height: 85,
          depth: 95,
          foamDensity: 'D35',
          finish: 'GOLD',
        },
        {
          id: 'p1',
          width: 250,
          height: 85,
          depth: 95,
          catalog: {
            width: 250,
            height: 85,
            depth: 95,
            standardOptions: {
              foamDensity: 'D35',
              finish: 'GOLD',
              accessories: 'BACK_MATCH',
            },
            options: [
              { groupCode: 'FOAM_DENSITY', code: 'D35' },
              { groupCode: 'PAINT_COLOR', code: 'GOLD' },
              { groupCode: 'PIPING_STYLE', code: 'BACK_MATCH' },
            ],
          },
        },
      ),
    ).toBe('STANDARD');
  });
});

describe('mapRequestItemCreate', () => {
  it('writes variantId, variant sku, and wood/foam fields', () => {
    const row = mapRequestItemCreate(
      {
        productName: 'Karina',
        productId: 'p1',
        variantId: 'v-250',
        quantity: 1,
        woodType: 'BEECH',
        foamDensity: 'D35',
        orientation: 'LEFT',
        options: [{ specOptionValueId: 'opt-1', groupCode: 'FOAM_DENSITY', code: 'D35' }],
      },
      0,
      {
        id: 'p1',
        variantSku: 'KARINA-250',
        variantLabel: 'أوكرانيه',
      },
    );
    expect(row.variantId).toBe('v-250');
    expect(row.variantSku).toBe('KARINA-250');
    expect(row.woodType).toBe('BEECH');
    expect(row.foamDensity).toBe('D35');
    expect(row.orientation).toBe('LEFT');
    expect(row.options).toEqual([
      expect.objectContaining({ specOptionValueId: 'opt-1', code: 'D35' }),
    ]);
  });

  it('writes fabrics JSON and still fills singular type/color', () => {
    const row = mapRequestItemCreate(
      {
        productName: 'Milano Sofa',
        quantity: 1,
        fabric: 'Velvet',
        color: 'Beige',
        fabrics: [
          { key: 'a', type: 'Velvet', color: 'Beige', role: 'Main body' },
          { key: 'b', type: 'Bouclé', color: 'Cream', role: 'Cushions' },
        ],
      },
      0,
    );
    expect(row.fabricType).toBe('Velvet');
    expect(row.fabricColor).toBe('Beige');
    expect(row.fabrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'Velvet', role: 'Main body' }),
        expect.objectContaining({ type: 'Bouclé', role: 'Cushions' }),
      ]),
    );
  });
});
