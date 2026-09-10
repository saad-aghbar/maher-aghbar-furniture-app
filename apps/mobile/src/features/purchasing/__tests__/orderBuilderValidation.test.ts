import {
  buildCreateOrderPayload,
  toggleBuilderMaterial,
  validateBuilderOrder,
} from '../orderBuilder';

const oak = {
  id: 'oak',
  sku: 'OAK-1',
  name: 'Oak',
  unit: 'pcs',
  category: 'WOOD',
  standardCost: 10,
};

describe('orderBuilder', () => {
  it('toggles a material in and out', () => {
    const added = toggleBuilderMaterial({}, oak, 'w1');
    expect(added.oak.warehouseId).toBe('w1');
    expect(toggleBuilderMaterial(added, oak, 'w1')).toEqual({});
  });

  it('blocks submit without supplier, warehouse, zero qty, or fabric location', () => {
    expect(validateBuilderOrder({ supplierId: null, lines: [] })).toBe('materialsRequired');
    expect(
      validateBuilderOrder({
        lines: [{ ...toggleBuilderMaterial({}, oak, 'w1').oak, quantity: '0' }],
      }),
    ).toBe('materialsRequired');
    expect(
      validateBuilderOrder({
        lines: [{ ...toggleBuilderMaterial({}, oak, 'w1').oak, quantity: '2', supplierId: '' }],
      }),
    ).toBe('supplierRequired');
    expect(
      validateBuilderOrder({
        lines: [
          {
            ...toggleBuilderMaterial({}, oak, '').oak,
            quantity: '2',
            supplierId: 's1',
            warehouseId: '',
          },
        ],
      }),
    ).toBe('warehouseRequired');
    expect(
      validateBuilderOrder({
        supplierId: 's1',
        lines: [
          {
            inventoryItemId: 'f1',
            sku: 'VEL',
            description: 'Velvet',
            unit: 'm',
            category: 'FABRIC',
            quantity: '2',
            unitCost: '10',
            warehouseId: 'w1',
            locationId: '',
            supplierId: 's1',
            supplierName: 'A',
          },
        ],
      }),
    ).toBe('holdingRequired');
  });

  it('builds one-supplier payload with per-line warehouse', () => {
    const line = toggleBuilderMaterial({}, oak, 'w-a').oak;
    const payload = buildCreateOrderPayload({
      supplierId: 's1',
      lines: [{ ...line, quantity: '3' }],
    });
    expect(payload.supplierId).toBe('s1');
    expect(payload.lines[0]).toMatchObject({ warehouseId: 'w-a', quantity: 3 });
  });
});
