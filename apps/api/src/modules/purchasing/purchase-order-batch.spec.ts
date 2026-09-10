import { BadRequestException } from '@nestjs/common';
import { normalizeBatchOrders, preparePurchaseOrderLines } from './purchase-order-lines';

describe('purchase-order batch helpers', () => {
  it('applies the header warehouse when a line omits one', () => {
    const { lines, total } = preparePurchaseOrderLines(
      [
        { description: 'Oak', quantity: 2, unitPrice: 10, warehouseId: 'wh-a' },
        { description: 'Foam', quantity: 1, unitPrice: 5 },
      ],
      { headerWarehouseId: 'wh-default' },
    );
    expect(lines[0]?.warehouseId).toBe('wh-a');
    expect(lines[1]?.warehouseId).toBe('wh-default');
    expect(total).toBeCloseTo(25 * 1.16);
  });

  it('rejects a zero-qty line so a bad batch rolls back before write', () => {
    expect(() =>
      preparePurchaseOrderLines([{ description: 'Oak', quantity: 0, unitPrice: 10 }]),
    ).toThrow(BadRequestException);
  });

  it('requires a supplier on every batch order', () => {
    expect(() =>
      normalizeBatchOrders([{ supplierId: '', lines: [] }]),
    ).toThrow(BadRequestException);
    const [first, second] = normalizeBatchOrders([
      { supplierId: 'sup-a', origin: 'LOW_STOCK', lines: [] },
      { supplierId: 'sup-b', lines: [] },
    ]);
    expect(first?.origin).toBe('LOW_STOCK');
    expect(second?.origin).toBe('MANUAL');
  });
});
