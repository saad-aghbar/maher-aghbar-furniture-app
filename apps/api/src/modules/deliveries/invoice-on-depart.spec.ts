import { invoiceOnFactoryExit } from './invoice-on-depart';

describe('invoiceOnFactoryExit', () => {
  it('creates a return invoice when a reship leaves the factory', async () => {
    const invoices = {
      ensureFromReturn: jest.fn().mockResolvedValue({ id: 'inv-ret' }),
      ensureFromSalesOrder: jest.fn(),
    };
    await expect(
      invoiceOnFactoryExit({
        purpose: 'RETURN_RESHIP',
        returnRequestId: 'ret-1',
        salesOrderId: 'so-1',
        userId: 'u1',
        invoices,
      }),
    ).resolves.toBe('RETURN');
    expect(invoices.ensureFromReturn).toHaveBeenCalledWith('ret-1', 'u1');
    expect(invoices.ensureFromSalesOrder).not.toHaveBeenCalled();
  });

  it('creates an order invoice when an outbound delivery leaves the factory', async () => {
    const invoices = {
      ensureFromReturn: jest.fn(),
      ensureFromSalesOrder: jest.fn().mockResolvedValue({ id: 'inv-so' }),
    };
    await expect(
      invoiceOnFactoryExit({
        purpose: 'OUTBOUND_ORDER',
        returnRequestId: null,
        salesOrderId: 'so-1',
        userId: 'u1',
        invoices,
      }),
    ).resolves.toBe('ORDER');
    expect(invoices.ensureFromSalesOrder).toHaveBeenCalledWith('so-1', 'u1');
    expect(invoices.ensureFromReturn).not.toHaveBeenCalled();
  });
});
