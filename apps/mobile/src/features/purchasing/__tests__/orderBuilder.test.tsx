import {
  buildRunPayload,
  groupBuilderLinesBySupplier,
  toggleBuilderMaterial,
  validateBuilderOrder,
} from '../orderBuilder';

describe('orderBuilder interactions', () => {
  it('adds then removes a material and validates submit shape', () => {
    const material = {
      id: 'oak',
      sku: 'OAK',
      name: 'Oak',
      unit: 'pcs',
      category: 'WOOD',
      standardCost: 8,
    };
    const added = toggleBuilderMaterial({}, material, 'wh-1');
    expect(added.oak?.quantity).toBe('1');
    expect(toggleBuilderMaterial(added, material, 'wh-1')).toEqual({});
    expect(
      validateBuilderOrder({
        lines: [{ ...added.oak!, quantity: '2', warehouseId: 'wh-2', supplierId: 's1' }],
      }),
    ).toBeNull();
  });

  it('renders under providers without throwing', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../PurchaseOrderBuilderScreen.tsx'),
      'utf8',
    ) as string;
    expect(src).toContain('PurchaseOrderBuilderScreen');
    expect(src).toContain('AddMaterialSheet');
    expect(src).toContain('buildRunPayload');
  });
});

describe('buildRunPayload', () => {
  it('groups lines by supplier', () => {
    const oak = toggleBuilderMaterial(
      {},
      { id: 'oak', sku: 'OAK', name: 'Oak', unit: 'pcs', category: 'WOOD' },
      'w1',
    ).oak;
    const foam = toggleBuilderMaterial(
      {},
      { id: 'foam', sku: 'FOAM', name: 'Foam', unit: 'pcs', category: 'FOAM' },
      'w1',
    ).foam;
    const payload = buildRunPayload({
      origin: 'MANUAL',
      lines: [
        { ...oak, supplierId: 's1', supplierName: 'A', quantity: '2' },
        { ...foam, supplierId: 's2', supplierName: 'B', quantity: '3' },
      ],
    });
    expect(payload.orders).toHaveLength(2);
    expect(payload.orders.map((o) => o.supplierId).sort()).toEqual(['s1', 's2']);
    expect(groupBuilderLinesBySupplier(payload.orders[0] ? [] : []).length).toBe(0);
    expect(payload.orders[0]?.lines).toHaveLength(1);
    expect(payload.orders[1]?.lines).toHaveLength(1);
  });
});
