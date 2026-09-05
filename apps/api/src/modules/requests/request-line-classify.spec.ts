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
});

describe('mapRequestItemCreate', () => {
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
