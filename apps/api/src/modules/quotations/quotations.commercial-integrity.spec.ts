import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { QuotationsService } from './quotations.service';

function dealer(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'dealer-a',
    username: 'nile',
    email: 'nile@example.com',
    name: 'Nile',
    roles: ['CUSTOMER'],
    permissions: ['quotation.read', 'quotation.accept', 'quotation.reject'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
    ...overrides,
  };
}

function staff(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['quotation.read', 'quotation.accept', 'quotation.approve', 'quotation.reject'],
    preferredLanguage: 'en',
    ...overrides,
  };
}

function makeService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'rfq-1' }]),
    quotation: {
      findFirst: jest.fn().mockResolvedValue(null),
      findFirstOrThrow: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    salesOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'so-1', number: 'SO-1', status: 'DRAFT' }),
    },
    requestForQuotation: { update: jest.fn() },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    document: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    quotation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    salesOrder: { findFirst: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn() },
    systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: false }) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return (arg as (t: typeof tx) => Promise<unknown>)(tx);
    }),
  };
  const sequences = { next: jest.fn().mockResolvedValue('SO-UAT-1') };
  const notifications = {
    sendFromTemplate: jest.fn(),
    notifyAdminUsers: jest.fn(),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
  };
  const salesOrders = {
    syncCalculatedCosts: jest.fn().mockResolvedValue(undefined),
    confirm: jest.fn().mockResolvedValue(undefined),
    ensureProductionSetup: jest.fn().mockResolvedValue(undefined),
  };
  const service = new QuotationsService(
    prisma as never,
    sequences as never,
    notifications as never,
    salesOrders as never,
    { send: jest.fn() } as never,
    { send: jest.fn() } as never,
  );
  return { service, prisma, tx, sequences, salesOrders };
}

const sentQuote = {
  id: 'q-a',
  number: 'QT-1',
  version: 1,
  status: 'SENT',
  customerId: 'customer-a',
  requestId: 'rfq-1',
  archivedAt: null,
  total: 100,
  subtotal: 100,
  taxTotal: 0,
  currency: 'ILS',
  paymentTerms: null,
  deliveryTerms: null,
  salesRepId: null,
  lines: [],
  approvals: [],
  salesOrders: [],
  customer: { id: 'customer-a', name: 'Nile' },
  request: { id: 'rfq-1', number: 'RFQ-1', items: [], documents: [] },
  acceptedBy: null,
};

describe('quotations commercial integrity', () => {
  it('forbids accept without a dealer principal even if quotation.accept is granted', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    await expect(service.accept('q-a', staff({ permissions: ['quotation.accept'] }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('404s when dealer B requests dealer A quotation', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    await expect(service.getById('q-a', dealer({ id: 'dealer-b', customerId: 'customer-b' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s unsent quotations for dealers', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, status: 'DRAFT' });
    await expect(service.getById('q-a', dealer())).rejects.toBeInstanceOf(NotFoundException);
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, status: 'APPROVED' });
    await expect(service.getById('q-a', dealer())).rejects.toBeInstanceOf(NotFoundException);
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, status: 'INTERNAL_REVIEW' });
    await expect(service.getById('q-a', dealer())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stamps acceptedById and creates one SO when the dealer CAS wins', async () => {
    const { service, prisma, tx, sequences, salesOrders } = makeService();
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    tx.quotation.findFirstOrThrow.mockResolvedValue({
      ...sentQuote,
      status: 'ACCEPTED',
      acceptedById: 'dealer-a',
      salesOrders: [{ id: 'so-1', number: 'SO-UAT-1', status: 'DRAFT' }],
    });
    const result = await service.accept('q-a', dealer());
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q-a', status: 'SENT', archivedAt: null },
        data: expect.objectContaining({ status: 'ACCEPTED', acceptedById: 'dealer-a' }),
      }),
    );
    expect(sequences.next).toHaveBeenCalledTimes(1);
    expect(tx.salesOrder.create).toHaveBeenCalledTimes(1);
    expect(result.salesOrders?.[0]?.number).toBe('SO-UAT-1');
    expect(salesOrders.confirm).not.toHaveBeenCalled();
  });

  it('ensures production setup (does not confirm/release) when auto_confirm_so_on_accept is true', async () => {
    const { service, prisma, tx, salesOrders } = makeService();
    prisma.systemSetting.findUnique.mockResolvedValue({ value: true });
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    tx.quotation.findFirstOrThrow.mockResolvedValue({
      ...sentQuote,
      status: 'ACCEPTED',
      acceptedById: 'dealer-a',
      salesOrders: [{ id: 'so-1', number: 'SO-UAT-1', status: 'DRAFT' }],
    });
    await service.accept('q-a', dealer());
    expect(salesOrders.confirm).not.toHaveBeenCalled();
    expect(salesOrders.ensureProductionSetup).toHaveBeenCalledWith(
      'so-1',
      expect.objectContaining({ id: 'dealer-a' }),
    );
  });

  it('does not create a second SO when CAS loses the same-RFQ race', async () => {
    const { service, prisma, tx, sequences } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, id: 'q-b' });
    tx.quotation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.accept('q-b', dealer())).rejects.toBeInstanceOf(BadRequestException);
    expect(sequences.next).not.toHaveBeenCalled();
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
  });

  it('hides non-SENT quotes from dealer reject and forbids staff reject of SENT', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, status: 'APPROVED' });
    await expect(service.reject('q-a', dealer())).rejects.toBeInstanceOf(NotFoundException);
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    await expect(service.reject('q-a', staff())).rejects.toBeInstanceOf(BadRequestException);
  });
});
