import { BadRequestException } from '@nestjs/common';
import { ReturnResolution } from '@maher/database';
import { ReturnsController } from './returns.controller';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';

describe('Piece 11 returns receive-gate', () => {
  const admin = {
    id: 'admin-1',
    username: 'admin',
    email: 'a@x.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMIN'],
    permissions: ['sales-order.update'],
    preferredLanguage: 'en' as const,
  };

  function makeController(overrides: Record<string, unknown> = {}) {
    let returnRow = {
      id: 'ret-1',
      number: 'RET-1',
      customerId: 'cust-1',
      salesOrderId: 'so-1',
      deliveryId: null as string | null,
      productDesc: 'Sofa',
      quantity: 1,
      reason: 'MANUFACTURING_DEFECT',
      description: null,
      reasonPhotoKey: null,
      issuePhotoKey: null,
      approvalStatus: 'PENDING',
      physicalStatus: 'NONE',
      receivedAt: null as Date | null,
      receivedById: null as string | null,
      needInfoNote: null as string | null,
      resolution: null as ReturnResolution | null,
      inventoryFate: 'PENDING',
      ...(overrides.returnRow as object),
    };

    const prisma: any = {
      returnRequest: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          returnRow = { ...returnRow, ...data } as typeof returnRow;
          return { ...returnRow, customer: { id: 'cust-1', name: 'Balqis' }, salesOrder: null, delivery: null };
        }),
        findUnique: jest.fn().mockImplementation(async () => ({ ...returnRow })),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => ({
          ...returnRow,
          customer: { id: 'cust-1', name: 'Balqis' },
          salesOrder: null,
          delivery: null,
        })),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          returnRow = { ...returnRow, ...data } as typeof returnRow;
          return {
            ...returnRow,
            customer: { id: 'cust-1', name: 'Balqis' },
            salesOrder: null,
            delivery: null,
          };
        }),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      salesOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'so-1' }),
      },
      delivery: { findFirst: jest.fn() },
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'po-rep',
          number: 'PO-REP',
          productDescription: 'REPLACEMENT — RET-1 — Sofa',
        }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (args: unknown) => {
        if (Array.isArray(args)) return Promise.all(args);
        return (args as (tx: unknown) => unknown)(prisma);
      }),
      ...((overrides.prisma as object) ?? {}),
    };

    const sequences = { next: jest.fn().mockResolvedValue('RET-1') };
    const storage = { createAccessToken: jest.fn(() => 'tok') };
    const notifications = {
      notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    };
    const inventory = {
      quarantineReturn: jest.fn().mockResolvedValue({ id: 'lot-q' }),
      resolveReturnFate: jest.fn().mockResolvedValue({}),
    };
    const rework = {
      createForReturn: jest.fn(),
      startRework: jest.fn(),
    };

    const controller = new ReturnsController(
      prisma as never,
      sequences as never,
      storage as never,
      notifications as never,
      inventory as never,
      rework as never,
    );

    return { controller, prisma, inventory, notifications, getRow: () => returnRow, setRow: (r: Partial<typeof returnRow>) => { Object.assign(returnRow, r); } };
  }

  it('create sets PENDING + physical NONE with 0 inventory (no quarantine)', async () => {
    const { controller, inventory, prisma } = makeController();
    const created = await controller.create(
      {
        customerId: 'cust-1',
        salesOrderId: 'so-1',
        productDesc: 'Sofa',
        quantity: 1,
        reason: 'CUSTOMER_REQUEST' as never,
      },
      admin as never,
    );
    expect(created.approvalStatus).toBe('PENDING');
    expect(created.physicalStatus).toBe('NONE');
    expect(inventory.quarantineReturn).not.toHaveBeenCalled();
    expect(prisma.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          physicalStatus: 'NONE',
          approvalStatus: 'PENDING',
        }),
      }),
    );
  });

  it('approve sets WAITING_RETURN without quarantine', async () => {
    const { controller, inventory, notifications, getRow } = makeController();
    const updated = await controller.resolve(
      'ret-1',
      { approvalStatus: 'APPROVED', resolution: 'REPAIR' },
      admin as never,
    );
    expect(updated.approvalStatus).toBe('APPROVED');
    expect(updated.physicalStatus).toBe('WAITING_RETURN');
    expect(updated.resolution).toBe(ReturnResolution.REPAIR);
    expect(inventory.quarantineReturn).not.toHaveBeenCalled();
    expect(notifications.notifyCustomerUsers).toHaveBeenCalled();
    expect(getRow().physicalStatus).toBe('WAITING_RETURN');
  });

  it('receive quarantines once; double receive is idempotent', async () => {
    const { controller, inventory, setRow, getRow } = makeController();
    setRow({
      approvalStatus: 'APPROVED',
      physicalStatus: 'WAITING_RETURN',
      resolution: ReturnResolution.REPLACEMENT,
    });

    const first = await controller.receive('ret-1', admin as never);
    expect(first.physicalStatus).toBe('RETURNED');
    expect(first.receivedAt).toBeTruthy();
    expect(inventory.quarantineReturn).toHaveBeenCalledTimes(1);

    setRow({
      receivedAt: first.receivedAt as Date,
      receivedById: admin.id,
      physicalStatus: 'RETURNED',
    });
    const second = await controller.receive('ret-1', admin as never);
    expect(second.physicalStatus).toBe('RETURNED');
    expect(inventory.quarantineReturn).toHaveBeenCalledTimes(1);
    expect(getRow().physicalStatus).toBe('RETURNED');
  });

  it('receive before approve throws RETURN_NOT_APPROVED', async () => {
    const { controller } = makeController();
    await expect(controller.receive('ret-1', admin as never)).rejects.toMatchObject({
      response: { code: 'RETURN_NOT_APPROVED' },
    });
  });

  it('receive with no stock basis surfaces RETURN_NO_STOCK_BASIS', async () => {
    const { controller, inventory, setRow } = makeController();
    setRow({ approvalStatus: 'APPROVED', physicalStatus: 'WAITING_RETURN' });
    inventory.quarantineReturn.mockRejectedValue(
      new BadRequestException({
        code: 'RETURN_NO_STOCK_BASIS',
        message: 'No finished-goods lot found',
      }),
    );
    await expect(controller.receive('ret-1', admin as never)).rejects.toMatchObject({
      response: { code: 'RETURN_NO_STOCK_BASIS' },
    });
  });

  it('need-info sets approvalStatus without stock movement', async () => {
    const { controller, inventory, notifications } = makeController();
    const updated = await controller.needInfo(
      'ret-1',
      { needInfoNote: 'Please add damage photos' },
      admin as never,
    );
    expect(updated.approvalStatus).toBe('NEED_INFO');
    expect(updated.needInfoNote).toBe('Please add damage photos');
    expect(inventory.quarantineReturn).not.toHaveBeenCalled();
    expect(notifications.notifyCustomerUsers).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ templateCode: 'RETURN_NEED_INFO' }),
    );
  });

  it('fate before receive is rejected', async () => {
    const { controller, setRow } = makeController();
    setRow({ approvalStatus: 'APPROVED', physicalStatus: 'WAITING_RETURN' });
    await expect(
      controller.setInventoryFate(
        'ret-1',
        { inventoryFate: 'SCRAP' },
        admin as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'RETURN_NOT_RECEIVED' } });
  });
});

describe('Piece 11 phase-5 cancel blocked via SalesOrdersService', () => {
  it('blocks cancel when delivery is OUT_FOR_DELIVERY', async () => {
    const order = {
      id: 'so-ship',
      number: 'SO-SHIP',
      status: 'READY_FOR_DELIVERY',
      customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'Balqis', nameEn: 'Balqis', nameAr: null, nameHe: null },
      lines: [],
      deliveries: [{ id: 'd1', status: 'OUT_FOR_DELIVERY' }],
      productionOrders: [],
      invoices: [],
      productionSetup: null,
    };
    const prisma = {
      salesOrder: { findFirst: jest.fn().mockResolvedValue(order) },
      inventoryTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
      productionTask: { groupBy: jest.fn().mockResolvedValue([]) },
      payment: { count: jest.fn().mockResolvedValue(0) },
      purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new SalesOrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { releaseForSalesOrder: jest.fn() } as never,
      { onProductionOrdersCancelled: jest.fn() } as never,
      {} as never,
      {} as never,
    );
    const impact = await service.getCancelImpact('so-ship');
    expect(impact.phase).toBe(5);
    expect(impact.blockReason).toBe('USE_RETURN');
    await expect(
      service.cancel('so-ship', 'admin', { reasonCode: 'Dealer requested' }),
    ).rejects.toMatchObject({ response: { code: 'USE_RETURN' } });
  });
});
