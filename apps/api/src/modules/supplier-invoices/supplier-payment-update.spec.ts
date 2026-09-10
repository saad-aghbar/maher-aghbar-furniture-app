import { SupplierInvoicesService } from './supplier-invoices.service';

describe('SupplierInvoicesService payment recompute', () => {
  it('recomputes paid and outstanding after a payment amount change', async () => {
    const invoiceUpdate = jest.fn();
    const tx = {
      supplierInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sinv-1',
          total: 100,
          archivedAt: null,
        }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'sinv-1', total: 100 }),
        update: invoiceUpdate,
      },
      supplierPayment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amount: 20 } })
          .mockResolvedValueOnce({ _sum: { amount: 40 } }),
        update: jest.fn(),
      },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      supplierPayment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'spay-1',
          amount: 20,
          supplierInvoiceId: 'sinv-1',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'spay-1', amount: 40 }),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new SupplierInvoicesService(prisma as never, {} as never);
    await service.updatePayment('spay-1', { amount: 40 }, 'u1');
    expect(invoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: expect.anything(),
          outstandingAmount: expect.anything(),
          status: 'PARTIALLY_PAID',
        }),
      }),
    );
  });
});
