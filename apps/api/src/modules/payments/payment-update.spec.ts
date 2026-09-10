import { PaymentsService } from './payments.service';

describe('PaymentsService.update allocation trim', () => {
  it('trims oldest allocations first when the amount drops', async () => {
    const allocDelete = jest.fn();
    const allocUpdate = jest.fn();
    const invoiceUpdate = jest.fn();
    const tx = {
      paymentAllocation: {
        delete: allocDelete,
        update: allocUpdate,
        findMany: jest.fn().mockResolvedValue([{ amount: 30 }]),
      },
      payment: { update: jest.fn() },
      invoice: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'inv-1',
          total: 100,
          dueDate: null,
        }),
        update: invoiceUpdate,
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          amount: 80,
          method: 'CASH',
          invoiceId: 'inv-1',
          allocations: [
            { id: 'a1', invoiceId: 'inv-1', amount: 50, createdAt: new Date('2026-01-01') },
            { id: 'a2', invoiceId: 'inv-1', amount: 30, createdAt: new Date('2026-01-02') },
          ],
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'pay-1',
          amount: 20,
          allocations: [{ amount: 20 }],
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      { sendFromTemplate: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
    );

    await service.update('pay-1', { amount: 20 }, 'u1');

    expect(allocDelete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(allocUpdate).toHaveBeenCalledWith({
      where: { id: 'a2' },
      data: { amount: expect.anything() },
    });
    expect(invoiceUpdate).toHaveBeenCalled();
  });

  it('grows this invoice allocation when the payment amount rises', async () => {
    const allocUpdate = jest.fn();
    const allocCreate = jest.fn();
    const invoiceUpdate = jest.fn();
    const tx = {
      paymentAllocation: {
        delete: jest.fn(),
        update: allocUpdate,
        create: allocCreate,
        findMany: jest.fn().mockResolvedValue([{ amount: 70 }]),
      },
      payment: { update: jest.fn() },
      invoice: {
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'inv-1',
            outstandingAmount: 40,
            total: 100,
            dueDate: null,
          })
          .mockResolvedValueOnce({
            id: 'inv-1',
            total: 100,
            dueDate: null,
          }),
        update: invoiceUpdate,
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay-1',
          amount: 50,
          method: 'CASH',
          invoiceId: 'inv-1',
          allocations: [
            { id: 'a1', invoiceId: 'inv-1', amount: 50, createdAt: new Date('2026-01-01') },
          ],
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'pay-1',
          amount: 80,
          allocations: [{ amount: 70 }],
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      { sendFromTemplate: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
    );

    await service.update('pay-1', { amount: 80 }, 'u1');

    expect(allocUpdate).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { amount: '80.000' },
    });
    expect(allocCreate).not.toHaveBeenCalled();
    expect(invoiceUpdate).toHaveBeenCalled();
  });

  it('edits a credit allocation without deleting the source payment', async () => {
    const allocUpdate = jest.fn();
    const paymentDelete = jest.fn();
    const invoiceUpdate = jest.fn();
    const tx = {
      paymentAllocation: {
        update: allocUpdate,
        findMany: jest.fn().mockResolvedValue([{ amount: 40 }]),
      },
      payment: { update: jest.fn() },
      invoice: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'inv-1',
          total: 100,
          dueDate: null,
        }),
        update: invoiceUpdate,
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      paymentAllocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'alloc-c',
          amount: 80,
          invoiceId: 'inv-1',
          paymentId: 'pay-src',
          payment: {
            id: 'pay-src',
            amount: 200,
            method: 'CASH',
            allocations: [
              { id: 'alloc-c', amount: 80 },
              { id: 'alloc-other', amount: 100 },
            ],
          },
          invoice: { id: 'inv-1', outstandingAmount: 20 },
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'alloc-c', amount: 40 }),
      },
      payment: { delete: paymentDelete },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      { sendFromTemplate: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
    );

    await service.updateAllocation('alloc-c', { amount: 40 }, 'u1');

    expect(allocUpdate).toHaveBeenCalledWith({
      where: { id: 'alloc-c' },
      data: { amount: '40.000' },
    });
    expect(paymentDelete).not.toHaveBeenCalled();
    expect(invoiceUpdate).toHaveBeenCalled();
  });

  it('removes a credit allocation and leaves the source payment', async () => {
    const allocDelete = jest.fn();
    const paymentDelete = jest.fn();
    const invoiceUpdate = jest.fn();
    const tx = {
      paymentAllocation: {
        delete: allocDelete,
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findFirstOrThrow: jest.fn().mockResolvedValue({
          id: 'inv-1',
          total: 100,
          dueDate: null,
        }),
        update: invoiceUpdate,
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      paymentAllocation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'alloc-c',
          amount: 25,
          invoiceId: 'inv-1',
        }),
      },
      payment: { delete: paymentDelete },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      { sendFromTemplate: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
    );

    await service.removeAllocation('alloc-c', 'u1');

    expect(allocDelete).toHaveBeenCalledWith({ where: { id: 'alloc-c' } });
    expect(paymentDelete).not.toHaveBeenCalled();
    expect(invoiceUpdate).toHaveBeenCalled();
  });
});
