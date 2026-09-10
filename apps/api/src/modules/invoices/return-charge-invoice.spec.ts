import { InvoiceStatus } from '@maher/database';
import { InvoicesService } from './invoices.service';

describe('InvoicesService.ensureFromReturn', () => {
  function makeService(row: Record<string, unknown> | null) {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue(row),
        update,
      },
    };
    const service = new InvoicesService(
      prisma as never,
      {} as never,
      { notifyCustomerUsers: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const createFromReturn = jest.fn().mockResolvedValue({ id: 'inv-1', number: 'INV-1' });
    (service as unknown as { createFromReturn: typeof createFromReturn }).createFromReturn =
      createFromReturn;
    return { service, createFromReturn, update };
  }

  it('does not invoice factory warranty or unconfirmed charges', async () => {
    const warranty = makeService({
      id: 'ret-1',
      chargeStatus: 'NOT_REQUIRED',
      chargeAmount: null,
      chargeInvoices: [],
    });
    await expect(warranty.service.ensureFromReturn('ret-1', 'u1')).resolves.toBeNull();
    expect(warranty.createFromReturn).not.toHaveBeenCalled();

    const draft = makeService({
      id: 'ret-1',
      chargeStatus: 'DRAFT',
      chargeAmount: 80,
      chargeInvoices: [],
    });
    await expect(draft.service.ensureFromReturn('ret-1', 'u1')).resolves.toBeNull();
    expect(draft.createFromReturn).not.toHaveBeenCalled();
  });

  it('creates one invoice after the dealer amount is confirmed', async () => {
    const { service, createFromReturn } = makeService({
      id: 'ret-1',
      number: 'RET-1',
      customerId: 'c1',
      productDesc: 'Sofa',
      chargeStatus: 'CONFIRMED',
      chargeAmount: 80,
      chargeInvoices: [],
    });
    await service.ensureFromReturn('ret-1', 'u1');
    expect(createFromReturn).toHaveBeenCalledWith(
      expect.objectContaining({ returnId: 'ret-1', amount: 80 }),
    );
  });

  it('is idempotent when a return invoice already exists', async () => {
    const existing = { id: 'inv-1', number: 'INV-1', status: InvoiceStatus.ISSUED };
    const { service, createFromReturn, update } = makeService({
      id: 'ret-1',
      chargeStatus: 'CONFIRMED',
      chargeAmount: 80,
      chargeInvoices: [existing],
    });
    const result = await service.ensureFromReturn('ret-1', 'u1');
    expect(result).toEqual(existing);
    expect(createFromReturn).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { chargeStatus: 'INVOICED' } }),
    );
  });
});
