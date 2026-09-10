import { FabricProcurementState, InventoryTxType } from '@maher/database';
import { FabricReceivingService } from './fabric-receiving.service';

describe('FabricReceivingService', () => {
  const user = { id: 'user-1', permissions: ['inventory.receive'] } as never;

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'fp-1',
      requirementId: 'req-1',
      salesOrderId: 'so-1',
      salesOrderLineId: 'sol-1',
      supplierId: 'sup-1',
      purchaseOrderId: null,
      purchaseRequestId: null,
      state: 'NEEDS_ORDERING',
      requirement: { inventoryItemId: 'inv-vel', category: 'FABRIC', expectedQty: 12 },
      salesOrder: { number: 'SO-FB1042' },
      lots: [],
      ...overrides,
    };
  }

  function makeService(opts: {
    row?: Record<string, unknown>;
    balances?: Array<Record<string, unknown>>;
    existingTx?: { id: string } | null;
    existingGrn?: { id: string; purchaseOrderId: string } | null;
    po?: Record<string, unknown> | null;
    standardCost?: number;
  }) {
    const movements: Array<Record<string, unknown>> = [];
    const lots: Array<Record<string, unknown>> = [];
    const events: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const prCreates: unknown[] = [];
    const grnCreates: unknown[] = [];

    const row = opts.row ?? baseRow();
    const prisma = {
      fabricProcurement: {
        findUnique: jest.fn(async () => row),
        findUniqueOrThrow: jest.fn(async () => ({ requirementId: row.requirementId })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          updates.push(data);
          Object.assign(row, data);
          return row;
        }),
      },
      warehouseLocation: {
        findUnique: jest.fn(async () => ({
          id: 'loc-1',
          warehouseId: 'wh-1',
          warehouse: { id: 'wh-1', type: 'RAW_MATERIALS' },
        })),
      },
      warehouse: {
        findUnique: jest.fn(async () => ({ id: 'wh-1', type: 'RAW_MATERIALS' })),
      },
      inventoryItem: {
        findUnique: jest.fn(async () => ({
          id: 'inv-vel',
          category: 'FABRIC',
          standardCost: opts.standardCost ?? 18,
          sku: 'VEL-302',
          nameEn: 'Velvet 302',
        })),
      },
      inventoryBalance: {
        findMany: jest.fn(async () => opts.balances ?? [
          {
            id: 'bal-1',
            inventoryItemId: 'inv-vel',
            warehouseId: 'wh-1',
            locationId: 'loc-1',
            availableQty: 20,
            reservedQty: 0,
          },
        ]),
      },
      inventoryTransaction: {
        findUnique: jest.fn(async () => opts.existingTx ?? null),
      },
      inventoryLot: {
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => null),
        count: jest.fn(async () => lots.length),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const created = { id: `lot-${lots.length + 1}`, qrCode: data.qrCode };
          lots.push(data);
          return created;
        }),
      },
      goodsReceipt: {
        findUnique: jest.fn(async () => opts.existingGrn ?? null),
        findMany: jest.fn(async () => []),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const created = { id: 'grn-1', ...data };
          grnCreates.push(data);
          return created;
        }),
      },
      purchaseOrder: {
        findUniqueOrThrow: jest.fn(async () => opts.po),
        update: jest.fn(),
      },
      fabricProcurementEvent: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return data;
        }),
      },
      salesOrderLineMaterialRequirement: { update: jest.fn() },
      salesOrder: { findFirst: jest.fn() },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const inventory = {
      applyMovement: jest.fn(async (m: Record<string, unknown>) => {
        movements.push(m);
        return { id: `tx-${movements.length}` };
      }),
      retryWaitingMaterialOrders: jest.fn(async () => undefined),
    };
    const sequences = { next: jest.fn(async () => 'GRN-1') };
    const fabrics = { getById: jest.fn(async () => ({ id: 'fp-1', lots, events })) };
    const supplierInvoices = { ensureFromPurchaseOrder: jest.fn(async () => undefined) };

    const svc = new FabricReceivingService(
      prisma as never,
      sequences as never,
      inventory as never,
      fabrics as never,
      supplierInvoices as never,
    );
    return { svc, movements, lots, events, prisma, inventory, fabrics, prCreates, grnCreates, updates };
  }

  it('receives without a PO via PURCHASE_RECEIPT and creates an FB- lot', async () => {
    const { svc, movements, lots, events } = makeService({});
    await svc.receive(
      'fp-1',
      { qty: 8, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:1' },
      user,
    );
    expect(movements[0]?.type).toBe(InventoryTxType.PURCHASE_RECEIPT);
    expect(movements[0]?.quantity).toBe(8);
    expect(lots).toHaveLength(1);
    expect(String(lots[0]?.qrCode)).toMatch(/^FB-/);
    expect(lots[0]?.allocationMode).toBe('ORDER_ALLOCATED');
    expect(events.some((e) => e.kind === 'RECEIVED')).toBe(true);
  });

  it('is idempotent when the receive movement already exists', async () => {
    const { svc, movements, lots, inventory } = makeService({
      existingTx: { id: 'tx-existing' },
    });
    await svc.receive(
      'fp-1',
      { qty: 8, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:1' },
      user,
    );
    expect(inventory.applyMovement).not.toHaveBeenCalled();
    expect(movements).toHaveLength(0);
    expect(lots).toHaveLength(0);
  });

  it('receives against a PO by creating a GoodsReceipt', async () => {
    const { svc, grnCreates, movements } = makeService({
      row: baseRow({ purchaseOrderId: 'po-1' }),
      po: {
        id: 'po-1',
        supplierId: 'sup-1',
        status: 'SENT',
        lines: [
          {
            id: 'pol-1',
            inventoryItemId: 'inv-vel',
            fabricProcurementId: 'fp-1',
            quantity: 12,
            unitPrice: 10,
          },
        ],
        goodsReceipts: [],
      },
    });
    await svc.receive(
      'fp-1',
      { qty: 8, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:po' },
      user,
    );
    expect(grnCreates).toHaveLength(1);
    expect(movements[0]?.type).toBe(InventoryTxType.PURCHASE_RECEIPT);
    expect(movements[0]?.referenceType).toBe('GoodsReceipt');
  });

  it('stores READY_FOR_PICKUP on a short receive so derivation can stay PARTIAL', async () => {
    const { svc, updates } = makeService({
      row: baseRow({ requirement: { inventoryItemId: 'inv-vel', category: 'FABRIC', expectedQty: 12 } }),
    });
    await svc.receive(
      'fp-1',
      { qty: 4, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:short' },
      user,
    );
    expect(updates.some((u) => u.state === FabricProcurementState.READY_FOR_PICKUP)).toBe(true);
    expect(updates.some((u) => u.state === 'PARTIAL')).toBe(false);
  });

  it('allocates from stock by reserving without inflating on-hand', async () => {
    const { svc, movements, lots } = makeService({});
    await svc.allocateFromStock(
      'fp-1',
      { inventoryItemId: 'inv-vel', qty: 6 },
      user,
    );
    expect(movements[0]?.reservedDelta).toBe(6);
    expect(movements[0]?.quantity).toBe(0);
    expect(lots).toHaveLength(1);
    expect(lots[0]?.allocationMode).toBe('ORDER_ALLOCATED');
    expect(Number(lots[0]?.unitCost)).toBe(18);
  });

  it('falls back to the fabric standard cost when no price is typed', async () => {
    const { svc, movements, lots } = makeService({ standardCost: 24 });
    await svc.receive(
      'fp-1',
      { qty: 8, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:std' },
      user,
    );
    expect(movements[0]?.unitCost).toBe(24);
    expect(Number(lots[0]?.unitCost)).toBe(24);
  });

  it('refuses receive when no cost is on file', async () => {
    const { svc } = makeService({ standardCost: 0 });
    await expect(
      svc.receive(
        'fp-1',
        { qty: 8, locationId: 'loc-1', idempotencyKey: 'fabric-receive:fp-1:nocost' },
        user,
      ),
    ).rejects.toMatchObject({ response: { code: 'FABRIC_COST_REQUIRED' } });
  });
});
