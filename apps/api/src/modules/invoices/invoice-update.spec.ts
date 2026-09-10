import { BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@maher/database';
import { InvoicesService } from './invoices.service';

describe('InvoicesService.update header money', () => {
  function makeService(invoice: Record<string, unknown>) {
    const tx = {
      invoiceLine: { deleteMany: jest.fn(), createMany: jest.fn() },
      invoice: { update: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ lines: [], ...invoice }),
      },
      salesOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'so-1', customerId: 'c1' }) },
      returnRequest: { findFirst: jest.fn() },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new InvoicesService(
      prisma as never,
      {} as never,
      { notifyCustomerUsers: jest.fn() } as never,
    );
    jest.spyOn(service, 'get').mockResolvedValue({ id: invoice.id } as never);
    return { service, prisma, tx };
  }

  it('lets an explicit total win over line-derived totals', async () => {
    const { service, tx } = makeService({
      id: 'inv-1',
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      salesOrderId: 'so-1',
      returnRequestId: null,
      customerId: 'c1',
      dueDate: null,
    });
    await service.update(
      'inv-1',
      {
        lines: [{ description: 'Seat', quantity: 1, unitPrice: 80 }],
        total: 90,
      },
      'u1',
    );
    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 90, outstandingAmount: 90 }),
      }),
    );
  });

  it('rejects a total below the amount already paid', async () => {
    const { service } = makeService({
      id: 'inv-1',
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAmount: 50,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      salesOrderId: null,
      returnRequestId: null,
      customerId: 'c1',
      dueDate: null,
    });
    await expect(service.update('inv-1', { total: 40 }, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores a percent taxRate as a fraction that fits Decimal(5,4)', async () => {
    const { service, tx } = makeService({
      id: 'inv-1',
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      salesOrderId: null,
      returnRequestId: null,
      customerId: 'c1',
      dueDate: null,
    });
    await service.update(
      'inv-1',
      { lines: [{ description: 'Seat', quantity: 1, unitPrice: 100, taxRate: 16 }] },
      'u1',
    );
    expect(tx.invoiceLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            taxRate: 0.16,
            lineTotal: 116,
          }),
        ],
      }),
    );
  });

  it('keeps a stored fraction taxRate', async () => {
    const { service, tx } = makeService({
      id: 'inv-1',
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      salesOrderId: null,
      returnRequestId: null,
      customerId: 'c1',
      dueDate: null,
    });
    await service.update(
      'inv-1',
      { lines: [{ description: 'Seat', quantity: 1, unitPrice: 100, taxRate: 0.16 }] },
      'u1',
    );
    expect(tx.invoiceLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ taxRate: 0.16, lineTotal: 116 })],
      }),
    );
  });
});
