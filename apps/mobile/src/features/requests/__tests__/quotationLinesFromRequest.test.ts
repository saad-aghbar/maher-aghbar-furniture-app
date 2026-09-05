import { quotationLinesFromRequestItems } from '../quotationLinesFromRequest';

describe('quotationLinesFromRequestItems', () => {
  it('omits notes and invalid productId so Nest whitelist validation passes', () => {
    const lines = quotationLinesFromRequestItems([
      {
        productName: 'Armchair Club',
        productId: 'not-a-uuid',
        quantity: '4.00',
        notes: 'Gate code 12',
        description: 'Custom arms',
        fabricType: 'Velvet',
        fabricColor: 'Navy',
        unit: 'pcs',
      },
    ]);
    expect(lines).toEqual([
      {
        description: 'Armchair Club',
        quantity: 4,
        unitPrice: 0,
        unit: 'pcs',
        taxRate: 0.16,
        fabric: 'Velvet',
        color: 'Navy',
      },
    ]);
    expect(lines[0]).not.toHaveProperty('notes');
    expect(lines[0]).not.toHaveProperty('productId');
  });

  it('keeps a real product UUID and defaults empty quantity to 1', () => {
    const id = '38006b1f-1ea5-4b83-bfa0-477741560fc0';
    const [line] = quotationLinesFromRequestItems([
      { productName: 'Dining', productId: id, quantity: 0 },
    ]);
    expect(line?.productId).toBe(id);
    expect(line?.quantity).toBe(1);
  });

  it('passes manufacturing complexity and does not invent a selling price', async () => {
    const [line] = quotationLinesFromRequestItems([
      {
        productName: 'Milano Sofa',
        quantity: 1,
        manufacturingComplexity: 'CUSTOM',
      },
    ]);
    expect(line?.manufacturingComplexity).toBe('CUSTOM');
    expect(line?.unitPrice).toBe(0);
  });

  it('copies customMeasurements onto the quotation line', () => {
    const [line] = quotationLinesFromRequestItems([
      {
        productName: 'Milano Sofa',
        productId: '38006b1f-1ea5-4b83-bfa0-477741560fc0',
        quantity: 1,
        manufacturingComplexity: 'MODIFIED',
        customMeasurements: [{ label: 'Arm', value: '70' }],
      },
    ]);
    expect(line?.customMeasurements).toEqual([{ label: 'Arm', value: '70' }]);
    expect(line?.manufacturingComplexity).toBe('MODIFIED');
  });

  it('copies a multi-fabric list onto the quotation line', () => {
    const fabrics = [
      { key: 'a', type: 'Velvet 302', color: 'Beige', role: 'Main body' },
      { key: 'b', type: 'Bouclé', color: 'Cream', role: 'Cushions' },
    ];
    const [line] = quotationLinesFromRequestItems([
      {
        productName: 'Milano Sofa',
        quantity: 1,
        fabricType: 'Velvet 302',
        fabricColor: 'Beige',
        fabrics,
      },
    ]);
    expect(line?.fabrics).toEqual(fabrics);
    expect(line?.fabric).toBe('Velvet 302');
  });
});
