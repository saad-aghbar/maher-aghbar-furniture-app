import { FabricProcurementEventKind } from '@maher/database';
import { FabricProcurementController } from './fabric-procurement.controller';
import { FabricReceivingService } from './fabric-receiving.service';

describe('allocate-from-stock fabric replace', () => {
  const manager = { id: 'user-1', permissions: ['fabric.procurement.manage'] } as never;
  const overrider = {
    id: 'user-2',
    permissions: ['fabric.procurement.manage', 'production.fabric.override'],
  } as never;

  function makeService(opts: { boundItemId?: string } = {}) {
    const events: Array<Record<string, unknown>> = [];
    const reqUpdates: Array<Record<string, unknown>> = [];
    const row = {
      id: 'fp-1',
      requirementId: 'req-1',
      salesOrderId: 'so-1',
      salesOrderLineId: 'sol-1',
      supplierId: 'sup-1',
      purchaseOrderId: null,
      state: 'NEEDS_ORDERING',
      requirement: {
        inventoryItemId: opts.boundItemId ?? 'inv-vel',
        sku: 'VEL-OLD',
        displayName: 'Old velvet',
      },
      salesOrder: { number: 'SO-FB1042' },
    };
    const prisma = {
      fabricProcurement: {
        findUnique: jest.fn(async () => row),
        findUniqueOrThrow: jest.fn(async () => ({ requirementId: row.requirementId })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return row;
        }),
      },
      warehouse: {
        findUnique: jest.fn(async () => ({ id: 'wh-1', type: 'RAW_MATERIALS' })),
      },
      inventoryItem: {
        findUnique: jest.fn(async () => ({
          id: 'inv-vel',
          category: 'FABRIC',
          standardCost: 18,
          sku: 'VEL-302',
          nameEn: 'Velvet 302',
        })),
      },
      inventoryBalance: {
        findMany: jest.fn(async () => [
          {
            id: 'bal-1',
            inventoryItemId: 'inv-vel',
            warehouseId: 'wh-1',
            locationId: null,
            availableQty: 20,
            reservedQty: 0,
          },
        ]),
      },
      inventoryLot: {
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          return { id: 'lot-1', qrCode: data.qrCode };
        }),
      },
      fabricProcurementEvent: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return data;
        }),
      },
      salesOrderLineMaterialRequirement: {
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          reqUpdates.push(data);
          return data;
        }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    const inventory = {
      applyMovement: jest.fn(async () => ({ id: 'tx-1' })),
      retryWaitingMaterialOrders: jest.fn(async () => undefined),
    };
    const svc = new FabricReceivingService(
      prisma as never,
      { next: jest.fn(async () => 'GRN-1') } as never,
      inventory as never,
      { getById: jest.fn(async () => ({ id: 'fp-1' })) } as never,
      { ensureFromPurchaseOrder: jest.fn() } as never,
    );
    return { svc, events, reqUpdates, prisma };
  }

  it('allocates the same fabric without a replace flag', async () => {
    const { svc, events, reqUpdates } = makeService({ boundItemId: 'inv-vel' });
    await svc.allocateFromStock('fp-1', { inventoryItemId: 'inv-vel', qty: 6 }, manager);
    expect(reqUpdates).toHaveLength(0);
    expect(events.some((e) => e.kind === FabricProcurementEventKind.FABRIC_CHANGED)).toBe(false);
    expect(events.some((e) => e.kind === FabricProcurementEventKind.RECEIVED)).toBe(true);
  });

  it('refuses a different fabric without the replace flag', async () => {
    const { svc } = makeService({ boundItemId: 'inv-old' });
    await expect(
      svc.allocateFromStock('fp-1', { inventoryItemId: 'inv-vel', qty: 6 }, manager),
    ).rejects.toMatchObject({ response: { code: 'FABRIC_WRONG_RECEIVED' } });
  });

  it('refuses replace without production.fabric.override', async () => {
    const receiving = { allocateFromStock: jest.fn() };
    const ctrl = new FabricProcurementController({} as never, receiving as never);
    await expect(
      Promise.resolve().then(() =>
        ctrl.allocateFromStock(
          'fp-1',
          { inventoryItemId: 'inv-vel', qty: 6, replaceFabric: true, reason: 'Same look' } as never,
          manager,
        ),
      ),
    ).rejects.toMatchObject({ response: { code: 'FABRIC_REPLACE_FORBIDDEN' } });
    expect(receiving.allocateFromStock).not.toHaveBeenCalled();
  });

  it('repoints the requirement and emits FABRIC_CHANGED when replacing', async () => {
    const { svc, events, reqUpdates } = makeService({ boundItemId: 'inv-old' });
    await svc.allocateFromStock(
      'fp-1',
      { inventoryItemId: 'inv-vel', qty: 6, replaceFabric: true, reason: 'Same look in stock' },
      overrider,
    );
    expect(reqUpdates[0]).toMatchObject({
      inventoryItemId: 'inv-vel',
      sku: 'VEL-302',
      displayName: 'Velvet 302',
    });
    expect(events.some((e) => e.kind === FabricProcurementEventKind.FABRIC_CHANGED)).toBe(true);
    const changed = events.find((e) => e.kind === FabricProcurementEventKind.FABRIC_CHANGED);
    expect(changed?.payload).toMatchObject({
      fromInventoryItemId: 'inv-old',
      toInventoryItemId: 'inv-vel',
      reason: 'Same look in stock',
      qty: 6,
    });
  });
});
