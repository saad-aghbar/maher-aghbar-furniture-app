import { describe, expect, it } from 'vitest';
import {
  buildPurchaseOrderPayload,
  buildReceivePayload,
  validatePurchaseBuilder,
} from './purchase-order-payload';

describe('purchase-order-payload', () => {
  it('requires a supplier and positive qty', () => {
    expect(validatePurchaseBuilder({ supplierId: null, lines: [] })).toBe('supplier');
    expect(
      validatePurchaseBuilder({
        supplierId: 's1',
        lines: [{ inventoryItemId: 'i1', description: 'Oak', quantity: '0', unitPrice: '1' }],
      }),
    ).toBe('qty');
  });

  it('blocks fabric without a holding location', () => {
    expect(
      validatePurchaseBuilder({
        supplierId: 's1',
        lines: [
          {
            inventoryItemId: 'f1',
            description: 'Velvet',
            quantity: '2',
            unitPrice: '10',
            category: 'FABRIC',
          },
        ],
      }),
    ).toBe('holding');
  });

  it('builds a create payload with per-line warehouse', () => {
    const body = buildPurchaseOrderPayload({
      supplierId: 's1',
      lines: [
        {
          inventoryItemId: 'i1',
          description: 'Oak',
          quantity: '3',
          unitPrice: '12',
          warehouseId: 'w-a',
        },
      ],
    });
    expect(body.lines[0]).toBeDefined();
    expect(body.lines[0]).toMatchObject({ warehouseId: 'w-a', quantity: 3 });
  });

  it('builds a receive payload dropping zero qty lines', () => {
    const body = buildReceivePayload([
      {
        inventoryItemId: 'i1',
        orderedQty: 4,
        receiveNow: '2',
        rejectedQty: '0',
        warehouseId: 'w1',
      },
      {
        inventoryItemId: 'i2',
        orderedQty: 1,
        receiveNow: '0',
        rejectedQty: '0',
      },
    ]);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.receivedQty).toBe(2);
    expect(body.lines[0]).not.toHaveProperty('unitCost');
  });
});
