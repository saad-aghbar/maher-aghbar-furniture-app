import { InvoiceStatus } from '@maher/database';
import { SupplierInvoicesService } from './supplier-invoices.service';

describe('SupplierInvoicesService.update taxRate', () => {
  function makeService(invoice: Record<string, unknown>) {
    const tx = {
      supplierInvoiceLine: { deleteMany: jest.fn(), createMany: jest.fn() },
      supplierInvoice: { update: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      supplierInvoice: {
        findFirst: jest.fn().mockResolvedValue({ lines: [], ...invoice }),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };
    const service = new SupplierInvoicesService(prisma as never, {} as never);
    jest.spyOn(service, 'get').mockResolvedValue({ id: invoice.id } as never);
    return { service, tx };
  }

  it('stores a percent taxRate as a fraction that fits Decimal(5,4)', async () => {
    const { service, tx } = makeService({
      id: 'sinv-1',
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      subtotal: 100,
      taxTotal: 0,
      total: 100,
      dueDate: null,
    });
    await service.update(
      'sinv-1',
      { lines: [{ description: 'Walnut', quantity: 1, unitPrice: 100, taxRate: 16 }] },
      'u1',
    );
    expect(tx.supplierInvoiceLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ taxRate: 0.16, lineTotal: 116 })],
      }),
    );
  });

  it('keeps a stored fraction taxRate', async () => {
    const { service, tx } = makeService({
      id: 'sinv-1',
      status: InvoiceStatus.ISSUED,
      paidAmount: 0,
      subtotal: 100,
      taxTotal: 0,
      total: 100,
      dueDate: null,
    });
    await service.update(
      'sinv-1',
      { lines: [{ description: 'Walnut', quantity: 1, unitPrice: 100, taxRate: 0.16 }] },
      'u1',
    );
    expect(tx.supplierInvoiceLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ taxRate: 0.16, lineTotal: 116 })],
      }),
    );
  });
});
