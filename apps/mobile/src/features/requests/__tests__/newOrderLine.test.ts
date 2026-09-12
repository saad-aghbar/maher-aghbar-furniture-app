import { applyOptionToLine, emptyOrderLine, lineToRequestItem } from '../newOrderLine';

describe('newOrderLine', () => {
  it('emits every structured field a dealer can set', () => {
    const line = emptyOrderLine({
      productId: 'p1',
      customProductName: 'Karina',
      variantId: 'v-250',
      variantSku: 'KARINA-250',
      variantLabel: 'أوكرانيه',
      quantity: '2',
      dimWidth: '250',
      dimHeight: '90',
      dimDepth: '95',
      dimSeat: '45',
      woodType: 'BEECH',
      foamDensity: 'D35',
      finish: 'GOLD',
      fabrics: [
        {
          key: 'fab-1',
          type: 'Velvet',
          color: 'Gold',
          role: 'Body',
          code: 'VEL-1',
          quantity: '8',
          notes: '',
        },
      ],
      options: [
        { specOptionValueId: 'opt-foam', groupCode: 'FOAM_DENSITY', code: 'D35' },
      ],
      notes: 'Dealer: gold piping on the back',
    });
    const item = lineToRequestItem(line, 'Untitled', 'Seat');
    expect(item).toEqual(
      expect.objectContaining({
        productId: 'p1',
        productName: 'Karina',
        variantId: 'v-250',
        quantity: 2,
        width: 250,
        height: 90,
        depth: 95,
        woodType: 'BEECH',
        foamDensity: 'D35',
        finish: 'GOLD',
        fabric: 'Velvet',
        color: 'Gold',
        notes: 'Dealer: gold piping on the back',
      }),
    );
    expect(item.options).toEqual([
      expect.objectContaining({ specOptionValueId: 'opt-foam', code: 'D35' }),
    ]);
    expect(item.customMeasurements).toEqual([expect.objectContaining({ value: '45' })]);
  });

  it('maps a foam pick onto foamDensity so the RFQ column is not empty', () => {
    const next = applyOptionToLine(
      emptyOrderLine(),
      { id: 'g-foam', code: 'FOAM_DENSITY' },
      { id: 'opt-1', code: 'D35', nameEn: 'Foam 35' },
    );
    expect(next.foamDensity).toBe('D35');
    expect(next.options[0]?.specOptionValueId).toBe('opt-1');
  });
});
