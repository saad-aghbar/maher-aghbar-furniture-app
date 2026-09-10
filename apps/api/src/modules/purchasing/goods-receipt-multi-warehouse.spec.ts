import { InventoryTxType } from '@maher/database';
import { receivePurchaseOrderGoods } from './receive-goods';

function makeDeps() {
  const receipts: Array<Record<string, unknown>> = [];
  const movements: Array<Record<string, unknown>> = [];
  const invoices: string[] = [];
  let poStatus = 'SENT';
  const prisma = {
    purchaseOrder: {
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'po-1',
        supplierId: 'sup-1',
        warehouseId: 'wh-a',
        status: 'SENT',
        lines: [
          { id: 'l1', inventoryItemId: 'oak', quantity: 10, unitPrice: 5, fabricProcurementId: null },
          { id: 'l2', inventoryItemId: 'foam', quantity: 4, unitPrice: 3, fabricProcurementId: null },
        ],
        goodsReceipts: [],
        supplier: { id: 'sup-1' },
      })),
      update: jest.fn(async ({ data }: { data: { status: string } }) => {
        poStatus = data.status;
        return { status: poStatus };
      }),
    },
    warehouse: {
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        type: 'RAW_MATERIALS',
      })),
    },
    goodsReceipt: {
      findUnique: jest.fn(async ({ where }: { where: { idempotencyKey?: string } }) =>
        receipts.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null,
      ),
      findMany: jest.fn(async () => receipts),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `grn-${receipts.length + 1}`,
          purchaseOrderId: data.purchaseOrderId,
          warehouseId: data.warehouseId,
          idempotencyKey: data.idempotencyKey,
          number: data.number,
          lines: (data as { lines: { create: Array<Record<string, unknown>> } }).lines.create.map(
            (l) => ({ ...l, inventoryItem: { id: l.inventoryItemId } }),
          ),
          warehouse: { id: data.warehouseId },
        };
        receipts.push(row);
        return row;
      }),
    },
    $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    salesOrder: { findFirst: jest.fn() },
    inventoryItem: {
      findMany: jest.fn(async () => [
        { id: 'oak', category: 'WOOD' },
        { id: 'foam', category: 'FOAM' },
      ]),
    },
    auditEvent: { create: jest.fn() },
  };
  const sequences = { next: jest.fn(async () => `GRN-${receipts.length + 1}`) };
  const inventory = {
    applyMovement: jest.fn(async (args: Record<string, unknown>) => {
      movements.push(args);
    }),
    retryWaitingMaterialOrders: jest.fn().mockResolvedValue(undefined),
  };
  const fabricReceiving = { attachLotsFromGoodsReceipt: jest.fn() };
  const supplierInvoices = {
    ensureFromPurchaseOrder: jest.fn(async (_po: string, _user: string, receiptId: string) => {
      invoices.push(receiptId);
    }),
  };
  return { prisma, sequences, inventory, fabricReceiving, supplierInvoices, receipts, movements, invoices, getStatus: () => poStatus };
}

describe('multi-warehouse goods receipt', () => {
  it('creates one receipt and one movement per warehouse', async () => {
    const deps = makeDeps();
    const result = await receivePurchaseOrderGoods(deps, 'po-1', {
      warehouseId: 'wh-a',
      lines: [
        { inventoryItemId: 'oak', orderedQty: 10, receivedQty: 4, warehouseId: 'wh-a' },
        { inventoryItemId: 'foam', orderedQty: 4, receivedQty: 2, warehouseId: 'wh-b' },
      ],
    }, 'user-1');
    expect(result.receipts).toHaveLength(2);
    expect(deps.receipts.map((r) => r.warehouseId)).toEqual(['wh-a', 'wh-b']);
    expect(deps.movements).toHaveLength(2);
    expect(deps.movements[0]).toMatchObject({
      type: InventoryTxType.PURCHASE_RECEIPT,
      warehouseId: 'wh-a',
    });
    expect(deps.invoices).toEqual(['grn-1']);
    expect(deps.getStatus()).toBe('PARTIALLY_RECEIVED');
  });

  it('keeps a single-warehouse body as one receipt with receipts[]', async () => {
    const deps = makeDeps();
    const result = await receivePurchaseOrderGoods(deps, 'po-1', {
      warehouseId: 'wh-a',
      lines: [{ inventoryItemId: 'oak', orderedQty: 10, receivedQty: 2 }],
    }, 'user-1');
    expect(result.receipts).toHaveLength(1);
    expect(result.id).toBe(result.receipts[0].id);
    expect(deps.receipts).toHaveLength(1);
  });

  it('replays the same idempotency key without creating another receipt', async () => {
    const deps = makeDeps();
    const body = {
      warehouseId: 'wh-a',
      idempotencyKey: 'recv-1',
      lines: [{ inventoryItemId: 'oak', orderedQty: 10, receivedQty: 2 }],
    };
    const first = await receivePurchaseOrderGoods(deps, 'po-1', body, 'user-1');
    const second = await receivePurchaseOrderGoods(deps, 'po-1', body, 'user-1');
    expect(deps.receipts).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(deps.movements).toHaveLength(1);
  });

  it('rejects receive before the order is sent', async () => {
    const deps = makeDeps();
    deps.prisma.purchaseOrder.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'po-1',
      supplierId: 'sup-1',
      warehouseId: 'wh-a',
      status: 'APPROVED',
      lines: [{ id: 'l1', inventoryItemId: 'oak', quantity: 10, unitPrice: 5, fabricProcurementId: null }],
      goodsReceipts: [],
      supplier: { id: 'sup-1' },
    });
    await expect(
      receivePurchaseOrderGoods(deps, 'po-1', {
        warehouseId: 'wh-a',
        lines: [{ inventoryItemId: 'oak', orderedQty: 10, receivedQty: 2 }],
      }, 'user-1'),
    ).rejects.toMatchObject({ response: { message: 'Purchase order is not receivable in current status.' } });
    expect(deps.receipts).toHaveLength(0);
  });

  it('posts the PO catalog cost and ignores a typed unitCost', async () => {
    const deps = makeDeps();
    await receivePurchaseOrderGoods(
      deps,
      'po-1',
      {
        warehouseId: 'wh-a',
        lines: [{ inventoryItemId: 'oak', orderedQty: 10, receivedQty: 2, unitCost: 99 }],
      },
      'user-1',
    );
    expect(deps.movements[0]?.unitCost).toBe(5);
    const created = deps.receipts[0] as { lines: Array<{ unitCost: unknown }> };
    expect(Number(created.lines[0]?.unitCost)).toBe(5);
  });

  it('rejects over-receipt', async () => {
    const deps = makeDeps();
    await expect(
      receivePurchaseOrderGoods(deps, 'po-1', {
        warehouseId: 'wh-a',
        lines: [{ inventoryItemId: 'oak', orderedQty: 10, receivedQty: 99 }],
      }, 'user-1'),
    ).rejects.toMatchObject({ response: { code: 'OVER_RECEIPT' } });
    expect(deps.receipts).toHaveLength(0);
  });
});
