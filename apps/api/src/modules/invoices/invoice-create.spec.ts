import { InvoiceStatus } from '@maher/database';
import { InvoicesService } from './invoices.service';

describe('InvoicesService create paths', () => {
  function makeService() {
    const created = {
      id: 'inv-new',
      number: 'INV-2026-00099',
      total: 116,
      customerId: 'c1',
    };
    const prisma = {
      salesOrder: { findFirst: jest.fn() },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ ...created, lines: [], customer: { id: 'c1' } }),
      },
      customer: { findFirst: jest.fn() },
      returnRequest: { update: jest.fn().mockResolvedValue({}) },
      auditEvent: { findFirst: jest.fn(), create: jest.fn() },
    };
    const sequences = { next: jest.fn().mockResolvedValue('INV-2026-00099') };
    const notifications = { notifyCustomerUsers: jest.fn().mockResolvedValue(undefined) };
    const service = new InvoicesService(prisma as never, sequences as never, notifications as never);
    return { service, prisma, sequences, notifications, created };
  }

  it('creates from a sales order without JoFotara fields or config', async () => {
    const { service, prisma } = makeService();
    prisma.salesOrder.findFirst.mockResolvedValue({
      id: 'so-1',
      customerId: 'c1',
      currency: 'ILS',
      subtotal: 100,
      taxTotal: 16,
      total: 116,
      customer: { paymentTermsDays: 30, nameEn: 'Oasis', taxNumber: null },
      lines: [
        {
          description: 'Sofa',
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.16,
          lineTotal: 116,
          commercialPriceStatus: 'CATALOG',
        },
      ],
    });

    const invoice = await service.createFromSalesOrder('so-1', 'u1');
    expect(invoice.id).toBe('inv-new');
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
    const data = prisma.invoice.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.salesOrderId).toBe('so-1');
    expect(data.customerId).toBe('c1');
    expect(data.status).toBe(InvoiceStatus.ISSUED);
    expect(data.total).toBe(116);
    expect(data.paidAmount).toBe(0);
    expect(data.outstandingAmount).toBe(116);
    expect(data.lines).toEqual({
      create: [
        expect.objectContaining({
          description: 'Sofa',
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.16,
          lineTotal: 116,
        }),
      ],
    });
    expect(JSON.stringify(data)).not.toMatch(/jofotara|JoFotara|JOFOTARA/i);
  });

  it('creates a standalone return charge without a sales order or JoFotara', async () => {
    const { service, prisma } = makeService();
    prisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      paymentTermsDays: 14,
      nameEn: 'Oasis',
    });

    const invoice = await service.createFromReturn({
      returnId: 'ret-1',
      customerId: 'c1',
      amount: 250,
      description: 'Return charge',
      userId: 'u1',
    });
    expect(invoice.id).toBe('inv-new');
    const data = prisma.invoice.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.salesOrderId).toBeNull();
    expect(data.returnRequestId).toBe('ret-1');
    expect(data.total).toBe('250.000');
    expect(data.outstandingAmount).toBe('250.000');
    expect(JSON.stringify(data)).not.toMatch(/jofotara|JoFotara|JOFOTARA/i);
  });
});
