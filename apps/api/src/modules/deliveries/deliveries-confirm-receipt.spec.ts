import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus } from '@maher/database';
import { DeliveriesController } from './deliveries.controller';

describe('DeliveriesController confirm-receipt', () => {
  function makeController(overrides: Record<string, unknown> = {}) {
    const prisma: {
      delivery: {
        findUnique: jest.Mock;
        findUniqueOrThrow?: jest.Mock;
        update: jest.Mock;
      };
      salesOrder: { update: jest.Mock };
      productionOrder: { findMany: jest.Mock };
      auditEvent: { create: jest.Mock };
      $transaction: jest.Mock;
    } = {
      delivery: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      salesOrder: { update: jest.fn() },
      productionOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'po-1' }]) },
      auditEvent: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
      ...((overrides.prisma as object) ?? {}),
    };
    const pipeline = { rollupProgress: jest.fn().mockResolvedValue(undefined) };
    const invoices = { ensureFromSalesOrder: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
      notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    };
    const inventory = { issueForDelivery: jest.fn(), restoreForDelivery: jest.fn() };
    const sequences = { next: jest.fn() };
    const loadSheet = {
      isDriverScoped: jest.fn().mockReturnValue(false),
      canBypassLoadChecklist: jest.fn().mockReturnValue(true),
      depart: jest.fn(),
    };
    const controller = new DeliveriesController(
      prisma as never,
      sequences as never,
      invoices as never,
      notifications as never,
      inventory as never,
      pipeline as never,
      loadSheet as never,
    );
    return { controller, prisma, pipeline, inventory, invoices, notifications };
  }

  const dealer = { id: 'u-dealer', customerId: 'cust-1', permissions: ['delivery.confirm-own-receipt'] };

  it('rejects staff impersonation (no customerId)', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUnique.mockResolvedValue({
      id: 'd1',
      customerId: 'cust-1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
    });
    await expect(
      controller.confirmReceipt('d1', { id: 'staff', permissions: [] } as never),
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
    const { controller, prisma, pipeline, inventory, invoices } = makeController();
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

    const result = await controller.confirmReceipt('d1', dealer as never);
    expect(result.status).toBe(DeliveryStatus.DELIVERED);
    expect(inventory.issueForDelivery).not.toHaveBeenCalled();
    expect(pipeline.rollupProgress).toHaveBeenCalledWith('po-1');
    // Piece 7: confirm ≠ paid — may ensure invoice, never records payment / apply credit.
    expect(invoices.ensureFromSalesOrder).toHaveBeenCalledWith('so-1', 'u-dealer');
    expect(Object.keys(invoices)).toEqual(['ensureFromSalesOrder']);
    expect(prisma.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DeliveryStatus.DELIVERED,
          customerConfirmedById: 'u-dealer',
        }),
      }),
    );
  });

  it('notifies dealer and admin on confirm-receipt', async () => {
    const { controller, prisma, notifications } = makeController();
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
    expect(notifications.notifyCustomerUsers).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ templateCode: 'DELIVERY_COMPLETED' }),
    );
    expect(notifications.notifyAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: 'DELIVERY_COMPLETED',
        linkUrl: '/deliveries/d1',
      }),
    );
  });

  it('blocks staff status transition to DELIVERED', async () => {
    const { controller, prisma } = makeController();
    prisma.delivery.findUniqueOrThrow = jest.fn().mockResolvedValue({
      id: 'd1',
      status: DeliveryStatus.OUT_FOR_DELIVERY,
    });
    await expect(
      controller.updateStatus(
        'd1',
        { status: DeliveryStatus.DELIVERED, recipientName: 'x' } as never,
        { id: 'staff' } as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'DELIVERY_DEALER_CONFIRM_REQUIRED' } });
  });
});
