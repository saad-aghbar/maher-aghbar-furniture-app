import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@maher/database';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryLoadService } from './delivery-load.service';

function makeLoadService(overrides: Partial<DeliveryLoadService> = {}) {
  return {
    isDriverScoped: jest.fn().mockReturnValue(false),
    canBypassLoadChecklist: jest.fn().mockReturnValue(true),
    listMine: jest.fn(),
    getLoadSheet: jest.fn(),
    setPieceLoaded: jest.fn(),
    depart: jest.fn(),
    assertDriverAccess: jest.fn(),
    materializeLoadPieces: jest.fn(),
    ...overrides,
  } as unknown as DeliveryLoadService;
}

function makeController(overrides: Record<string, unknown> = {}) {
  const prisma: {
    delivery: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    salesOrder: { update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock };
    productionOrder: { findMany: jest.Mock };
    auditEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  } = {
    delivery: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    salesOrder: {
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    productionOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'po-1' }]) },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
      if (typeof fn === 'function') return fn(prisma);
      return Promise.all(fn as unknown as Promise<unknown>[]);
    }),
    ...((overrides.prisma as object) ?? {}),
  };
  const pipeline = { rollupProgress: jest.fn().mockResolvedValue(undefined) };
  const invoices = { ensureFromSalesOrder: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
  };
  const inventory = {
    issueForDelivery: jest.fn().mockResolvedValue(undefined),
    restoreForDelivery: jest.fn().mockResolvedValue(undefined),
  };
  const sequences = { next: jest.fn() };
  const loadSheet = makeLoadService(overrides.loadSheet as Partial<DeliveryLoadService>);
  const controller = new DeliveriesController(
    prisma as never,
    sequences as never,
    invoices as never,
    notifications as never,
    inventory as never,
    pipeline as never,
    loadSheet,
  );
  return { controller, prisma, pipeline, inventory, loadSheet, notifications };
}

describe('GET /deliveries/:id isolation', () => {
  it('404s when Dealer A requests Dealer B delivery', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'del-b',
      customerId: 'customer-b',
      driver: { id: 'drv-1', firstName: 'Sam' },
    });
    await expect(
      controller.get('del-b', {
        id: 'user-a',
        customerId: 'customer-a',
        permissions: ['delivery.read'],
        roles: [],
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('strips driver for customer users on their own delivery', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'del-a',
      customerId: 'customer-a',
      number: 'DEL-1',
      driver: { id: 'drv-1', firstName: 'Sam' },
      items: [],
    });
    const result = (await controller.get('del-a', {
      id: 'user-a',
      customerId: 'customer-a',
      permissions: ['delivery.read'],
      roles: [],
    } as any)) as Record<string, unknown>;
    expect(result.id).toBe('del-a');
    expect(result.driver).toBeUndefined();
  });

  it('404s when driver2 requests driver1 delivery', async () => {
    const { controller, prisma, loadSheet } = makeController({
      loadSheet: {
        isDriverScoped: jest.fn().mockReturnValue(true),
      } as any,
    });
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'del-1',
      customerId: 'cust-1',
      driverId: 'driver-1',
      driver: { id: 'driver-1' },
      items: [],
    });
    await expect(
      controller.get('del-1', {
        id: 'driver-2',
        permissions: ['delivery.read'],
        roles: ['PRODUCTION_WORKER'],
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(loadSheet.isDriverScoped).toHaveBeenCalled();
  });
});

describe('DeliveriesController confirm-receipt', () => {
  const dealer = {
    id: 'u-dealer',
    customerId: 'cust-1',
    permissions: ['delivery.confirm-own-receipt'],
    roles: [],
  };

  it('rejects staff impersonation (no customerId)', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      customerId: 'cust-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
    });
    await expect(
      controller.confirmReceipt('d1', { id: 'staff', permissions: [], roles: [] } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when not OUT_FOR_DELIVERY', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      customerId: 'cust-1',
      status: DeliveryStatus.READY,
    });
    await expect(controller.confirmReceipt('d1', dealer as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('confirms without inventory issue and rolls up production', async () => {
    const { controller, prisma, pipeline, inventory } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      customerId: 'cust-1',
      salesOrderId: 'so-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
    });
    prisma.delivery.update.mockResolvedValue({
      id: 'd1',
      number: 'DEL-1',
      status: DeliveryStatus.DELIVERED,
    });
    await controller.confirmReceipt('d1', dealer as never);
    expect(inventory.issueForDelivery).not.toHaveBeenCalled();
    expect(pipeline.rollupProgress).toHaveBeenCalledWith('po-1');
  });
});

describe('Delivery load sheet routes', () => {
  const driver = {
    id: 'driver-1',
    permissions: ['delivery.read', 'delivery.update'],
    roles: ['PRODUCTION_WORKER'],
  };

  it('scopes list to mine for floor drivers', async () => {
    const { controller, loadSheet } = makeController({
      loadSheet: {
        isDriverScoped: jest.fn().mockReturnValue(true),
        listMine: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } }),
      } as any,
    });
    await controller.list({ page: 1, pageSize: 20 } as any, driver as never);
    expect(loadSheet.listMine).toHaveBeenCalled();
  });

  it('routes driver OUT_FOR_DELIVERY status patch through depart (checklist)', async () => {
    const { controller, prisma, loadSheet } = makeController({
      loadSheet: {
        isDriverScoped: jest.fn().mockReturnValue(true),
        depart: jest.fn().mockResolvedValue({ status: DeliveryStatus.OUT_FOR_DELIVERY }),
      } as any,
    });
    prisma.delivery.findUniqueOrThrow.mockResolvedValue({
      id: 'd1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
    });
    await controller.updateStatus(
      'd1',
      { status: DeliveryStatus.OUT_FOR_DELIVERY } as any,
      driver as never,
    );
    expect(loadSheet.depart).toHaveBeenCalledWith('d1', driver);
  });

  it('routes staff OUT_FOR_DELIVERY status patch through depart (checklist required)', async () => {
    const { controller, inventory, loadSheet } = makeController({
      loadSheet: {
        isDriverScoped: jest.fn().mockReturnValue(false),
        depart: jest.fn().mockResolvedValue({ status: DeliveryStatus.OUT_FOR_DELIVERY }),
      } as any,
    });
    const prisma = (controller as any).prisma;
    prisma.delivery.findUniqueOrThrow.mockResolvedValue({
      id: 'd1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      notes: null,
    });
    await controller.updateStatus(
      'd1',
      { status: DeliveryStatus.OUT_FOR_DELIVERY } as any,
      {
        id: 'admin',
        permissions: ['delivery.update'],
        roles: ['SYSTEM_ADMINISTRATOR'],
      } as never,
    );
    expect(loadSheet.depart).toHaveBeenCalledWith('d1', expect.objectContaining({ id: 'admin' }));
    expect(inventory.issueForDelivery).not.toHaveBeenCalled();
  });
});

describe('DeliveryLoadService', () => {
  function makeService() {
    const prisma: any = {
      delivery: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      deliveryLoadPiece: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      inventoryLot: { findMany: jest.fn() },
      productionOrderWorkflowSnapshotNode: { findMany: jest.fn() },
      productionOrder: { findMany: jest.fn().mockResolvedValue([]) },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    const inventory = { issueForDelivery: jest.fn().mockResolvedValue(undefined) };
    const pipeline = { rollupProgress: jest.fn() };
    const notifications = {
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
  };
    const service = new DeliveryLoadService(
      prisma,
      inventory as any,
      pipeline as any,
      notifications as any,
      { ensureFromSalesOrder: jest.fn().mockResolvedValue(undefined) } as any,
    );
    return { service, prisma, inventory };
  }

  it('forbids driver2 from accessing driver1 load sheet', async () => {
    const { service, prisma } = makeService();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
    });
    await expect(
      service.getLoadSheet('d1', {
        id: 'driver-2',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['delivery.read'],
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks depart until all pieces loaded', async () => {
    const { service, prisma } = makeService();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      number: 'DEL-1',
    });
    prisma.inventoryLot.findMany.mockResolvedValue([]);
    prisma.productionOrderWorkflowSnapshotNode.findMany.mockResolvedValue([]);
    prisma.deliveryLoadPiece.findMany.mockResolvedValue([
      { id: 'p1', loadedAt: new Date() },
      { id: 'p2', loadedAt: null },
    ]);
    await expect(
      service.depart('d1', {
        id: 'driver-1',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['delivery.update'],
      } as any),
    ).rejects.toMatchObject({ response: { code: 'DELIVERY_LOAD_INCOMPLETE' } });
  });

  it('marks piece loaded without auto-confirming the truck load', async () => {
    const { service, prisma, inventory } = makeService();
    const departSpy = jest.spyOn(service, 'depart');
    jest.spyOn(service, 'getLoadSheet').mockResolvedValue({
      id: 'd1',
      status: DeliveryStatus.READY,
      canDepart: true,
      allLoaded: true,
      loadProgress: { loaded: 2, total: 2 },
    } as any);
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      number: 'DEL-1',
    });
    prisma.deliveryLoadPiece.findFirst.mockResolvedValue({
      id: 'p2',
      deliveryId: 'd1',
      loadedAt: null,
    });
    prisma.deliveryLoadPiece.update.mockResolvedValue({
      id: 'p2',
      loadedAt: new Date(),
    });

    const result = await service.setPieceLoaded(
      'd1',
      'p2',
      {
        id: 'driver-1',
        roles: ['PRODUCTION_WORKER'],
        permissions: ['delivery.update'],
      } as any,
      true,
    );

    expect(departSpy).not.toHaveBeenCalled();
    expect(inventory.issueForDelivery).not.toHaveBeenCalled();
    expect(result.canDepart).toBe(true);
    expect(result.status).toBe(DeliveryStatus.READY);
  });

  it('double depart is idempotent and does not re-issue FIN', async () => {
    const { service, prisma, inventory } = makeService();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      number: 'DEL-1',
    });
    jest.spyOn(service, 'getLoadSheet').mockResolvedValue({
      id: 'd1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
      canDepart: false,
      allLoaded: true,
      loadProgress: { loaded: 2, total: 2 },
    } as any);

    const result = await service.depart('d1', {
      id: 'driver-1',
      roles: ['PRODUCTION_WORKER'],
      permissions: ['delivery.update'],
    } as any);

    expect(result.status).toBe(DeliveryStatus.OUT_FOR_DELIVERY);
    expect(inventory.issueForDelivery).not.toHaveBeenCalled();
    expect(prisma.delivery.update).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('departs and issues FG when all pieces loaded', async () => {
    const { service, prisma, inventory } = makeService();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      number: 'DEL-1',
    });
    prisma.inventoryLot.findMany.mockResolvedValue([]);
    prisma.productionOrderWorkflowSnapshotNode.findMany.mockResolvedValue([]);
    prisma.deliveryLoadPiece.findMany.mockResolvedValue([
      { id: 'p1', loadedAt: new Date() },
      { id: 'p2', loadedAt: new Date() },
    ]);
    prisma.delivery.update.mockResolvedValue({
      id: 'd1',
      number: 'DEL-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
      driverId: 'driver-1',
    });
    // getLoadSheet after depart
    prisma.delivery.findUniqueOrThrow.mockResolvedValue({
      id: 'd1',
      number: 'DEL-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
      deliveryAddress: 'Addr',
      deliveryDate: null,
      notes: null,
      driverId: 'driver-1',
      customer: { id: 'c1', code: 'C', name: 'Dealer', nameEn: 'Dealer', nameAr: null, nameHe: null },
      salesOrder: { id: 'so-1', number: 'SO-1', status: 'READY_FOR_DELIVERY', projectName: null, externalOrderNumber: null, deliveryAddress: 'Addr' },
      loadPieces: [],
    });
    const result = await service.depart('d1', {
      id: 'driver-1',
      roles: ['PRODUCTION_WORKER'],
      permissions: ['delivery.update'],
    } as any);
    expect(inventory.issueForDelivery).toHaveBeenCalledWith('d1', 'so-1', 'driver-1', prisma);
    expect(result.status).toBe(DeliveryStatus.OUT_FOR_DELIVERY);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'delivery.depart' }),
      }),
    );
  });

  it('materializes packages from lot qty × packaging expectedPieceCount', async () => {
    const { service, prisma } = makeService();
    prisma.inventoryLot.findMany.mockResolvedValue([
      { id: 'lot-1', quantity: 2, productionOrderId: 'po-1', stageInstanceId: 'si-1' },
    ]);
    prisma.productionOrderWorkflowSnapshotNode.findMany
      .mockResolvedValueOnce([{ stageInstanceId: 'si-1', expectedPieceCount: 3 }])
      .mockResolvedValueOnce([]);
    prisma.deliveryLoadPiece.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: '1', inventoryLotId: 'lot-1', pieceIndex: 1 },
        { id: '2', inventoryLotId: 'lot-1', pieceIndex: 2 },
        { id: '3', inventoryLotId: 'lot-1', pieceIndex: 3 },
        { id: '4', inventoryLotId: 'lot-1', pieceIndex: 4 },
        { id: '5', inventoryLotId: 'lot-1', pieceIndex: 5 },
        { id: '6', inventoryLotId: 'lot-1', pieceIndex: 6 },
      ]);
    prisma.deliveryLoadPiece.createMany.mockResolvedValue({ count: 6 });
    const rows = await service.materializeLoadPieces('d1', 'so-1');
    expect(prisma.deliveryLoadPiece.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          { deliveryId: 'd1', inventoryLotId: 'lot-1', pieceIndex: 1 },
          { deliveryId: 'd1', inventoryLotId: 'lot-1', pieceIndex: 6 },
        ]),
      }),
    );
    expect(rows).toHaveLength(6);
  });

  it('returns named package labels from packaging snapshot metadata', async () => {
    const { service, prisma } = makeService();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      driverId: 'driver-1',
      status: DeliveryStatus.READY,
      salesOrderId: 'so-1',
      customerId: 'c1',
      number: 'DEL-1',
    });
    prisma.inventoryLot.findMany.mockResolvedValue([]);
    prisma.deliveryLoadPiece.findMany.mockResolvedValue([]);
    prisma.productionOrderWorkflowSnapshotNode.findMany.mockResolvedValue([
      {
        stageInstanceId: 'si-1',
        expectedPieceCount: 3,
        metadata: {
          pieceLabels: [
            { nameEn: 'A', nameAr: 'أ' },
            { nameEn: 'legs', nameAr: 'أرجل' },
            { nameEn: '3', nameAr: '3' },
          ],
        },
        snapshot: { productionOrderId: 'po-1' },
      },
    ]);
    prisma.delivery.findUniqueOrThrow.mockResolvedValue({
      id: 'd1',
      number: 'DEL-1',
      status: DeliveryStatus.READY,
      deliveryAddress: 'Addr',
      deliveryDate: null,
      notes: null,
      driverId: 'driver-1',
      customer: {
        id: 'c1',
        code: 'C',
        name: 'Dealer',
        nameEn: 'Dealer',
        nameAr: null,
        nameHe: null,
      },
      salesOrder: {
        id: 'so-1',
        number: 'SO-1',
        status: 'READY_FOR_DELIVERY',
        projectName: null,
        externalOrderNumber: null,
        deliveryAddress: 'Addr',
      },
      loadPieces: [
        {
          id: 'p1',
          inventoryLotId: 'lot-1',
          pieceIndex: 1,
          loadedAt: null,
          loadedById: null,
          inventoryLot: {
            id: 'lot-1',
            quantity: 1,
            qrCode: null,
            stageInstanceId: 'si-1',
            inventoryItem: {
              nameEn: 'Sofa',
              nameAr: null,
              nameHe: null,
              sku: 'SOFA-1',
              imageUrl: null,
              product: {
                id: 'prod-1',
                nameEn: '2-Seater Loveseat',
                nameAr: null,
                nameHe: null,
                imageUrl: null,
                sku: 'SOFA-1',
              },
            },
            warehouse: {
              id: 'wh-1',
              code: 'FG',
              nameEn: 'Finished Goods',
              nameAr: null,
              nameHe: null,
            },
            location: null,
            productionOrder: {
              id: 'po-1',
              number: 'PO-1',
              productDescription: null,
              quantity: 1,
            },
          },
        },
        {
          id: 'p2',
          inventoryLotId: 'lot-1',
          pieceIndex: 2,
          loadedAt: null,
          loadedById: null,
          inventoryLot: {
            id: 'lot-1',
            quantity: 1,
            qrCode: null,
            stageInstanceId: 'si-1',
            inventoryItem: {
              nameEn: 'Sofa',
              nameAr: null,
              nameHe: null,
              sku: 'SOFA-1',
              imageUrl: null,
              product: {
                id: 'prod-1',
                nameEn: '2-Seater Loveseat',
                nameAr: null,
                nameHe: null,
                imageUrl: null,
                sku: 'SOFA-1',
              },
            },
            warehouse: {
              id: 'wh-1',
              code: 'FG',
              nameEn: 'Finished Goods',
              nameAr: null,
              nameHe: null,
            },
            location: null,
            productionOrder: {
              id: 'po-1',
              number: 'PO-1',
              productDescription: null,
              quantity: 1,
            },
          },
        },
        {
          id: 'p3',
          inventoryLotId: 'lot-1',
          pieceIndex: 3,
          loadedAt: null,
          loadedById: null,
          inventoryLot: {
            id: 'lot-1',
            quantity: 1,
            qrCode: null,
            stageInstanceId: 'si-1',
            inventoryItem: {
              nameEn: 'Sofa',
              nameAr: null,
              nameHe: null,
              sku: 'SOFA-1',
              imageUrl: null,
              product: {
                id: 'prod-1',
                nameEn: '2-Seater Loveseat',
                nameAr: null,
                nameHe: null,
                imageUrl: null,
                sku: 'SOFA-1',
              },
            },
            warehouse: {
              id: 'wh-1',
              code: 'FG',
              nameEn: 'Finished Goods',
              nameAr: null,
              nameHe: null,
            },
            location: null,
            productionOrder: {
              id: 'po-1',
              number: 'PO-1',
              productDescription: null,
              quantity: 1,
            },
          },
        },
      ],
    });

    const sheet = await service.getLoadSheet('d1', {
      id: 'driver-1',
      roles: ['PRODUCTION_WORKER'],
      permissions: ['delivery.read'],
    } as any);

    expect(sheet.products[0]!.pieces.map((p: { label: string }) => p.label)).toEqual([
      'A',
      'legs',
      '3',
    ]);
  });
});
