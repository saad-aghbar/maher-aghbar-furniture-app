import { BadRequestException } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';
import {
  cancelPhaseCurrentState,
  formatCancellationReason,
  isCancelReasonCode,
  normalizeCancelReasonCode,
  resolveSalesOrderCancelPhase,
} from './sales-order-cancel-phase';

describe('sales-order-cancel-phase', () => {
  it('maps statuses to phases 1–5', () => {
    expect(resolveSalesOrderCancelPhase({ status: 'DRAFT', deliveryStatuses: [] })).toBe(1);
    expect(
      resolveSalesOrderCancelPhase({ status: 'WAITING_FOR_MATERIALS', deliveryStatuses: [] }),
    ).toBe(1);
    expect(resolveSalesOrderCancelPhase({ status: 'CONFIRMED', deliveryStatuses: [] })).toBe(2);
    expect(
      resolveSalesOrderCancelPhase({ status: 'READY_FOR_PRODUCTION', deliveryStatuses: [] }),
    ).toBe(2);
    expect(resolveSalesOrderCancelPhase({ status: 'IN_PRODUCTION', deliveryStatuses: [] })).toBe(3);
    expect(
      resolveSalesOrderCancelPhase({ status: 'READY_FOR_DELIVERY', deliveryStatuses: [] }),
    ).toBe(4);
    expect(resolveSalesOrderCancelPhase({ status: 'DELIVERED', deliveryStatuses: [] })).toBe(5);
    expect(
      resolveSalesOrderCancelPhase({
        status: 'IN_PRODUCTION',
        deliveryStatuses: ['OUT_FOR_DELIVERY'],
      }),
    ).toBe(5);
    expect(
      resolveSalesOrderCancelPhase({
        status: 'READY_FOR_DELIVERY',
        deliveryStatuses: ['DELIVERED'],
      }),
    ).toBe(5);
  });

  it('formats reason + validates codes', () => {
    expect(isCancelReasonCode('Dealer requested')).toBe(true);
    expect(isCancelReasonCode('Nope')).toBe(false);
    expect(formatCancellationReason('Duplicate')).toBe('Duplicate');
    expect(formatCancellationReason('Other', 'typo')).toBe('Other: typo');
    expect(normalizeCancelReasonCode('DEALER_REQUESTED')).toBe('Dealer requested');
    expect(normalizeCancelReasonCode('Spec error')).toBe('Spec error');
  });

  it('describes current state', () => {
    expect(cancelPhaseCurrentState(5, 'DELIVERED')).toContain('Return');
  });
});

describe('SalesOrdersService cancel-impact + cancel', () => {
  function makeService(overrides: Record<string, unknown> = {}) {
    const order = {
      id: 'so-1',
      number: 'SO-1',
      status: 'IN_PRODUCTION',
      customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'Balqis', nameEn: 'Balqis', nameAr: null, nameHe: null },
      lines: [
        {
          description: 'Sofa',
          quantity: 1,
          product: { sku: 'SOFA-1', nameEn: 'Sofa', nameAr: null },
        },
      ],
      deliveries: [] as Array<{ id: string; status: string }>,
      productionOrders: [{ id: 'po-1', status: 'IN_PROGRESS' }],
      invoices: [] as Array<Record<string, unknown>>,
      productionSetup: null,
      ...(overrides.order as object),
    };

    const prisma: any = {
      salesOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
          ...order,
          ...(data as object),
        })),
      },
      inventoryTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            quantity: -2,
            unitCost: 10,
            inventoryItem: { sku: 'WOOD', nameEn: 'Wood', standardCost: 8 },
          },
        ]),
      },
      inventoryLot: {
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { inventoryItem?: { itemClass?: string } } }) => {
          if (where.inventoryItem?.itemClass === 'SEMI_FINISHED_GOOD') {
            return [
              {
                id: 'semi-1',
                quantity: 1,
                status: 'AVAILABLE',
                inventoryItem: { sku: 'SEMI-1' },
                warehouse: { code: 'SEMI', nameEn: 'Semi' },
              },
            ];
          }
          return [
            {
              id: 'fin-1',
              quantity: 1,
              status: 'AVAILABLE',
              inventoryItem: { sku: 'FIN-1' },
            },
          ];
        }),
      },
      productionTask: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'READY', _count: { _all: 2 } },
          { status: 'IN_PROGRESS', _count: { _all: 1 } },
          { status: 'COMPLETED', _count: { _all: 3 } },
        ]),
        findMany: jest.fn().mockResolvedValue([{ id: 'task-ip' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      productionOrder: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'po-1' }]),
      },
      payment: { count: jest.fn().mockResolvedValue(0) },
      purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
      ...((overrides.prisma as object) ?? {}),
    };

    const inventory = { releaseForSalesOrder: jest.fn().mockResolvedValue(undefined) };
    const productionInventory = {
      onProductionOrdersCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SalesOrdersService(
      prisma as never,
      {} as never,
      { notifyCustomerUsers: jest.fn() } as never,
      { createAccessToken: jest.fn() } as never,
      {} as never,
      {} as never,
      inventory as never,
      productionInventory as never,
      {} as never,
      {} as never,
    );

    return { service, prisma, inventory, productionInventory, order };
  }

  it('GET cancel-impact returns phase 3 impact with materials and SEMI', async () => {
    const { service } = makeService();
    const impact = await service.getCancelImpact('so-1');
    expect(impact.phase).toBe(3);
    expect(impact.canCancel).toBe(true);
    expect(impact.impact.materialsConsumedAmount).toBe(20);
    expect(impact.impact.semiLots).toHaveLength(1);
    expect(impact.impact.openTasks).toBe(2);
    expect(impact.impact.inProgressTasks).toBe(1);
    expect(impact.impact.completedTasksPreserved).toBe(3);
    expect(impact.semiDispositionRequired).toBe(true);
  });

  it('phase 5 blocks cancel with USE_RETURN', async () => {
    const { service } = makeService({
      order: {
        status: 'DELIVERED',
        deliveries: [{ id: 'd1', status: 'DELIVERED' }],
      },
    });
    const impact = await service.getCancelImpact('so-1');
    expect(impact.phase).toBe(5);
    expect(impact.canCancel).toBe(false);
    expect(impact.blockReason).toBe('USE_RETURN');

    await expect(
      service.cancel('so-1', 'admin', { reasonCode: 'Dealer requested' }),
    ).rejects.toMatchObject({ response: { code: 'USE_RETURN' } });
  });

  it('requires reasonCode', async () => {
    const { service } = makeService({ order: { status: 'DRAFT', productionOrders: [] } });
    await expect(service.cancel('so-1', 'admin', { reasonCode: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.cancel('so-1', 'admin', { reasonCode: 'Invalid' }),
    ).rejects.toMatchObject({ response: { code: 'CANCEL_REASON_REQUIRED' } });
  });

  it('cancels phase 1–4 and releases inventory without reversing RAW', async () => {
    const { service, prisma, inventory, productionInventory } = makeService({
      order: {
        status: 'READY_FOR_PRODUCTION',
        productionOrders: [{ id: 'po-1', status: 'PLANNED' }],
        deliveries: [],
      },
    });
    // Remap findFirst for getCancelImpact then cancel's second call
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: 'so-1',
      number: 'SO-1',
      status: 'READY_FOR_PRODUCTION',
      customerId: 'cust-1',
      customer: { id: 'cust-1', name: 'Balqis', nameEn: 'Balqis', nameAr: null, nameHe: null },
      lines: [{ description: 'Sofa', quantity: 1, product: null }],
      deliveries: [],
      productionOrders: [{ id: 'po-1', status: 'PLANNED' }],
      invoices: [],
      productionSetup: null,
    });

    const result = await service.cancel('so-1', 'admin', {
      reasonCode: 'Spec error',
      reason: 'wrong size',
    });
    expect(result.status).toBe('CANCELLED');
    expect(result.cancellationReason).toBe('Spec error: wrong size');
    expect(productionInventory.onProductionOrdersCancelled).toHaveBeenCalled();
    expect(inventory.releaseForSalesOrder).toHaveBeenCalledWith('so-1', prisma);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'sales-order.cancel',
          newValues: expect.objectContaining({ phase: 2 }),
        }),
      }),
    );
  });
});
