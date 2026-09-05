import { createFabricLotsForGoodsReceipt } from './goods-receipt-fabric-lots';

describe('createFabricLotsForGoodsReceipt', () => {
  it('creates an ORDER_ALLOCATED fabric lot with cost and is idempotent', async () => {
    const created: unknown[] = [];
    const existing = new Map<string, { id: string; qrCode: string }>();
    const tx = {
      inventoryLot: {
        findUnique: jest.fn(async ({ where }: { where: { qrCode?: string } }) => {
          if (where.qrCode && [...existing.values()].some((r) => r.qrCode === where.qrCode)) {
            return { id: 'x' };
          }
          return null;
        }),
        findFirst: jest.fn(async ({ where }: { where: { sourceKey?: string } }) => {
          const hit = where.sourceKey ? existing.get(where.sourceKey) : null;
          return hit ?? null;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `lot-${created.length + 1}`, qrCode: String(data.qrCode) };
          existing.set(String(data.sourceKey), row);
          created.push(data);
          return row;
        }),
      },
    };

    const input = {
      tx,
      goodsReceiptId: 'grn-1',
      purchaseOrderId: 'po-1',
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      locationId: 'loc-hold',
      salesOrderNumber: 'SO-1042',
      lines: [
        {
          inventoryItemId: 'inv-vel',
          acceptedQty: 12,
          unitCost: 18.5,
          category: 'FABRIC',
          fabricProcurementId: 'fp-1',
          salesOrderId: 'so-1',
          salesOrderLineId: 'sol-1',
        },
        {
          inventoryItemId: 'inv-wood',
          acceptedQty: 4,
          unitCost: 10,
          category: 'WOOD',
        },
      ],
    };

    const first = await createFabricLotsForGoodsReceipt(input);
    expect(first).toHaveLength(1);
    expect(created).toHaveLength(1);
    const data = created[0] as Record<string, unknown>;
    expect(data.allocationMode).toBe('ORDER_ALLOCATED');
    expect(data.fabricProcurementId).toBe('fp-1');
    expect(data.locationId).toBe('loc-hold');
    expect(String(data.qrCode)).toMatch(/^FB-SO1042-/);

    const second = await createFabricLotsForGoodsReceipt(input);
    expect(second).toHaveLength(1);
    expect(created).toHaveLength(1);
  });

  it('leaves non-fabric receipts unchanged', async () => {
    const tx = {
      inventoryLot: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const result = await createFabricLotsForGoodsReceipt({
      tx,
      goodsReceiptId: 'grn-2',
      purchaseOrderId: 'po-2',
      supplierId: 'sup-1',
      warehouseId: 'wh-1',
      lines: [
        {
          inventoryItemId: 'inv-wood',
          acceptedQty: 4,
          unitCost: 10,
          category: 'WOOD',
        },
      ],
    });
    expect(result).toEqual([]);
    expect(tx.inventoryLot.create).not.toHaveBeenCalled();
  });
});
