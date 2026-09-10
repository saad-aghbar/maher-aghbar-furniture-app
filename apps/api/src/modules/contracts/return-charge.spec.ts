import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import type { AuthUser } from '@maher/types';

describe('ReturnsService charge flow', () => {
  const staff: AuthUser = {
    id: 'fin-1',
    username: 'finance',
    email: 'f@x.com',
    name: 'Finance',
    roles: ['FINANCE'],
    permissions: ['invoice.create', 'return.inspect', 'sales-order.update'],
    preferredLanguage: 'en',
  };

  const dealer: AuthUser = {
    id: 'dealer-1',
    username: 'dealer',
    email: 'd@x.com',
    name: 'Dealer',
    roles: ['CUSTOMER'],
    permissions: ['return.read', 'sales-order.read'],
    preferredLanguage: 'en',
    customerId: 'c1',
  };

  function makeService(row: Record<string, unknown>, extras?: { update?: jest.Mock }) {
    const update = extras?.update ?? jest.fn().mockImplementation(async ({ data }) => ({ ...row, ...data }));
    const prisma = {
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue(row),
        update,
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const invoices = {
      createFromReturn: jest.fn().mockResolvedValue({
        id: 'inv-1',
        number: 'INV-1',
        total: 80,
      }),
    };
    const service = new ReturnsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      invoices as never,
    );
    return { service, invoices, update, prisma };
  }

  it('refuses to charge until the dealer amount is confirmed', async () => {
    const { service } = makeService({
      id: 'ret-1',
      number: 'RET-1',
      customerId: 'c1',
      productDesc: 'Sofa',
      responsibility: 'DEALER_RESPONSIBILITY',
      chargeAmount: 80,
      chargeStatus: 'DRAFT',
      chargeInvoices: [],
    });
    await expect(service.chargeDealer('ret-1', staff, { amount: 80 })).rejects.toMatchObject({
      response: { code: 'RETURN_NOT_CHARGEABLE' },
    });
  });

  it('charges the confirmed amount, never inventing a cost', async () => {
    const { service, invoices } = makeService({
      id: 'ret-1',
      number: 'RET-1',
      customerId: 'c1',
      productDesc: 'Sofa',
      responsibility: 'DEALER_RESPONSIBILITY',
      chargeAmount: 80,
      chargeStatus: 'CONFIRMED',
      chargeInvoices: [],
    });
    const result = await service.chargeDealer('ret-1', staff, { amount: 80 });
    expect(invoices.createFromReturn).toHaveBeenCalledWith(
      expect.objectContaining({ returnId: 'ret-1', amount: 80 }),
    );
    expect(result.created).toBe(true);
  });

  it('rejects a zero charge amount even when confirmed', async () => {
    const { service } = makeService({
      id: 'ret-1',
      number: 'RET-1',
      customerId: 'c1',
      productDesc: 'Sofa',
      responsibility: 'DEALER_RESPONSIBILITY',
      chargeAmount: 0,
      chargeStatus: 'CONFIRMED',
      chargeInvoices: [],
    });
    await expect(service.chargeDealer('ret-1', staff, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears a stale dealer amount when switching to factory warranty', async () => {
    const { service, update } = makeService({
      id: 'ret-1',
      responsibility: 'DEALER_RESPONSIBILITY',
      chargeAmount: 80,
      factoryShareAmount: null,
      chargeStatus: 'DRAFT',
    });
    await service.setResponsibility('ret-1', staff, { responsibility: 'FACTORY_WARRANTY' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsibility: 'FACTORY_WARRANTY',
          chargeAmount: null,
          factoryShareAmount: null,
          chargeStatus: 'NOT_REQUIRED',
        }),
      }),
    );
  });

  it('resets a confirmed charge back to draft when the amount changes', async () => {
    const { service, update } = makeService({
      id: 'ret-1',
      responsibility: 'DEALER_RESPONSIBILITY',
      chargeAmount: 80,
      factoryShareAmount: null,
      chargeStatus: 'CONFIRMED',
    });
    await service.setResponsibility('ret-1', staff, {
      responsibility: 'DEALER_RESPONSIBILITY',
      dealerAmount: 120,
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chargeAmount: '120.000',
          chargeStatus: 'DRAFT',
          chargeConfirmedAt: null,
        }),
      }),
    );
  });

  it('sends a draft charge to the dealer', async () => {
    const { service, update } = makeService({
      id: 'ret-1',
      customerId: 'c1',
      number: 'RET-1',
      chargeAmount: 80,
      chargeStatus: 'DRAFT',
    });
    await service.sendCharge('ret-1', staff);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeStatus: 'AWAITING_DEALER' }),
      }),
    );
  });

  it('lets the matching dealer accept a proposed charge', async () => {
    const { service, update } = makeService({
      id: 'ret-1',
      customerId: 'c1',
      chargeStatus: 'AWAITING_DEALER',
    });
    await service.respondCharge('ret-1', dealer, { accept: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeStatus: 'CONFIRMED' }),
      }),
    );
  });

  it('rejects with a note and blocks a foreign dealer', async () => {
    const { service } = makeService({
      id: 'ret-1',
      customerId: 'c1',
      chargeStatus: 'AWAITING_DEALER',
    });
    await expect(
      service.respondCharge('ret-1', dealer, { accept: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.respondCharge(
        'ret-1',
        { ...dealer, customerId: 'other' },
        { accept: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
