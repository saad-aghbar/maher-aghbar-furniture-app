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
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    quotationApproval: { create: jest.fn().mockResolvedValue({ id: 'appr-1' }) },
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
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    salesOrder: { findFirst: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    systemSetting: { findUnique: jest.fn().mockResolvedValue({ value: false }) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    requestForQuotation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    dealerPrice: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return (arg as (t: typeof tx) => Promise<unknown>)(tx);
    }),
  };
  const sequences = { next: jest.fn().mockResolvedValue('SO-UAT-1') };
  const notifications = {
    sendFromTemplate: jest.fn().mockResolvedValue({ ok: true }),
    notifyAdminUsers: jest.fn(),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
  };
  const salesOrders = {
    syncCalculatedCosts: jest.fn().mockResolvedValue(undefined),
    confirm: jest.fn().mockResolvedValue(undefined),
    ensureProductionSetup: jest.fn().mockResolvedValue(undefined),
  };
  const email = { send: jest.fn().mockResolvedValue({ ok: true }) };
  const whatsapp = { send: jest.fn().mockResolvedValue({ ok: true }) };
  const service = new QuotationsService(
    prisma as never,
    sequences as never,
    notifications as never,
    salesOrders as never,
    email as never,
    whatsapp as never,
  );
  return { service, prisma, tx, sequences, salesOrders, email, whatsapp, notifications };
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
  offeredDeliveryDate: new Date('2026-09-22T00:00:00.000Z'),
  salesRepId: null,
  lines: [
    {
      id: 'l1',
      description: 'Milano Sofa',
      quantity: 1,
      unitPrice: 6000,
      manufacturingComplexity: 'STANDARD',
      productId: 'p1',
    },
  ],
  approvals: [],
  salesOrders: [],
  customer: { id: 'customer-a', name: 'Nile', email: 'nile@example.com', phone: '+962790000099' },
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
        where: { id: 'q-a', status: { in: ['SENT', 'VIEWED'] }, archivedAt: null },
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

  it('hides unsent quotes from dealer reject', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({ ...sentQuote, status: 'APPROVED' });
    await expect(service.reject('q-a', dealer())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets staff withdraw a SENT quotation', async () => {
    const { service, prisma, tx } = makeService();
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    tx.quotation.update.mockResolvedValue({ ...sentQuote, status: 'REJECTED' });
    const result = await service.reject('q-a', staff());
    expect(result.status).toBe('REJECTED');
    expect(tx.quotationApproval.create).toHaveBeenCalled();
  });

  it('marks APPROVED as SENT even when email or WhatsApp throw', async () => {
    const { service, prisma, email, whatsapp } = makeService();
    const approved = { ...sentQuote, status: 'APPROVED' };
    prisma.quotation.findFirst.mockResolvedValue(approved);
    prisma.quotation.update.mockResolvedValue({ ...approved, status: 'SENT' });
    email.send.mockRejectedValue(new Error('Resend email failed'));
    whatsapp.send.mockRejectedValue(new Error('WhatsApp Cloud API failed'));
    const result = await service.send('q-a', staff());
    expect(result.status).toBe('SENT');
    expect(prisma.quotation.update).toHaveBeenCalled();
  });

  it('treats a second send on SENT as success', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue(sentQuote);
    const result = await service.send('q-a', staff());
    expect(result.status).toBe('SENT');
    expect(prisma.quotation.update).not.toHaveBeenCalled();
  });

  it('sends a DRAFT quotation when selling prices are set', async () => {
    const { service, prisma } = makeService();
    const draft = { ...sentQuote, status: 'DRAFT' };
    prisma.quotation.findFirst.mockResolvedValue(draft);
    prisma.quotation.update.mockResolvedValue({ ...draft, status: 'SENT' });
    const result = await service.send('q-a', staff());
    expect(result.status).toBe('SENT');
  });

  it('blocks send when a CUSTOM line has no selling price', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({
      ...sentQuote,
      status: 'DRAFT',
      lines: [
        {
          id: 'l1',
          description: 'Milano Sofa',
          quantity: 1,
          unitPrice: 0,
          manufacturingComplexity: 'CUSTOM',
        },
      ],
    });
    await expect(service.send('q-a', staff())).rejects.toMatchObject({
      response: {
        message: 'Set a selling price for Custom Milano Sofa before sending this quotation.',
      },
    });
    expect(prisma.quotation.update).not.toHaveBeenCalled();
  });

  it('prefills STANDARD unit price from DealerPrice on create', async () => {
    const { service, prisma, sequences } = makeService();
    sequences.next.mockResolvedValue('QT-NEW');
    prisma.dealerPrice.findMany.mockResolvedValue([{ productId: 'p1', price: 6000 }]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', sku: 'MIL', nameEn: 'Milano', nameAr: null, nameHe: null, basePrice: 5000 },
    ]);
    prisma.quotation.create.mockResolvedValue({ id: 'q-new', status: 'DRAFT', lines: [] });
    await service.create(
      {
        customerId: 'customer-a',
        lines: [{ description: 'Milano Sofa', quantity: 1, unitPrice: 0, productId: 'p1' }],
      },
      'admin-1',
    );
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ unitPrice: '6000.000', manufacturingComplexity: 'STANDARD' }),
            ]),
          },
        }),
      }),
    );
  });

  it('does not invent a MODIFIED selling price from catalog', async () => {
    const { service, prisma, sequences } = makeService();
    sequences.next.mockResolvedValue('QT-NEW');
    prisma.dealerPrice.findMany.mockResolvedValue([{ productId: 'p1', price: 6000 }]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', sku: 'MIL', nameEn: 'Milano', nameAr: null, nameHe: null, basePrice: 5000 },
    ]);
    prisma.quotation.create.mockResolvedValue({ id: 'q-new', status: 'DRAFT', lines: [] });
    await service.create(
      {
        customerId: 'customer-a',
        lines: [
          {
            description: 'Milano Sofa',
            quantity: 1,
            unitPrice: 0,
            productId: 'p1',
            manufacturingComplexity: 'MODIFIED',
          },
        ],
      },
      'admin-1',
    );
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({ unitPrice: '0.000', manufacturingComplexity: 'MODIFIED' }),
            ]),
          },
        }),
      }),
    );
  });

  it('does not promote a description-matched line to STANDARD or invent a price', async () => {
    const { service, prisma, sequences } = makeService();
    sequences.next.mockResolvedValue('QT-NEW');
    prisma.dealerPrice.findMany.mockResolvedValue([{ productId: 'p1', price: 6000 }]);
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        sku: 'MIL',
        nameEn: 'Milano Sofa',
        nameAr: null,
        nameHe: null,
        basePrice: 5000,
      },
    ]);
    prisma.quotation.create.mockResolvedValue({ id: 'q-new', status: 'DRAFT', lines: [] });
    await service.create(
      {
        customerId: 'customer-a',
        lines: [
          {
            description: 'Milano Sofa custom corner',
            quantity: 1,
            unitPrice: 0,
            manufacturingComplexity: 'CUSTOM',
          },
        ],
      },
      'admin-1',
    );
    expect(prisma.quotation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                unitPrice: '0.000',
                manufacturingComplexity: 'CUSTOM',
              }),
            ]),
          },
        }),
      }),
    );
  });

  it('copies quotation complexity and measurements on accept instead of reclassifying', async () => {
    const { service, prisma, tx } = makeService();
    const customQuote = {
      ...sentQuote,
      lines: [
        {
          id: 'l1',
          description: 'Custom Corner Sofa',
          quantity: 1,
          unitPrice: 6000,
          manufacturingComplexity: 'CUSTOM',
          productId: 'p1',
          width: 220,
          height: 85,
          depth: 95,
          customMeasurements: [{ key: 'arm', label: 'Arm', value: 70, catalogValue: 60 }],
        },
      ],
    };
    prisma.quotation.findFirst.mockResolvedValue(customQuote);
    tx.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        width: 220,
        height: 85,
        depth: 95,
        seatHeight: 45,
        imageUrl: null,
        nameEn: 'Milano',
      },
    ]);
    tx.quotation.findFirstOrThrow.mockResolvedValue({
      ...customQuote,
      status: 'ACCEPTED',
      acceptedById: 'dealer-a',
      salesOrders: [{ id: 'so-1', number: 'SO-UAT-1', status: 'DRAFT' }],
    });
    await service.accept('q-a', dealer());
    const created = tx.salesOrder.create.mock.calls[0]?.[0] as {
      data: {
        lines: {
          create: Array<{
            manufacturingComplexity: string;
            orderSpec?: { manufacturingComplexity?: string; customMeasurements?: unknown };
          }>;
        };
      };
    };
    expect(created.data.lines.create[0]?.manufacturingComplexity).toBe('CUSTOM');
    expect(created.data.lines.create[0]?.orderSpec?.manufacturingComplexity).toBe('CUSTOM');
    expect(created.data.lines.create[0]?.orderSpec?.customMeasurements).toEqual([
      expect.objectContaining({ key: 'arm', value: 70 }),
    ]);
  });

  it('refuses dealer accept after valid-until and marks EXPIRED', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({
      ...sentQuote,
      expirationDate: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.quotation.update.mockResolvedValue({ ...sentQuote, status: 'EXPIRED' });
    await expect(service.accept('q-a', dealer())).rejects.toMatchObject({
      response: { code: 'QUOTATION_EXPIRED' },
    });
    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'EXPIRED' } }),
    );
  });

  it('strips internalNotes from dealer GET and keeps rejectionReason', async () => {
    const { service, prisma } = makeService();
    prisma.quotation.findFirst.mockResolvedValue({
      ...sentQuote,
      status: 'REJECTED',
      internalNotes: 'factory only',
      approvals: [{ decision: 'REJECTED', comment: 'Price too high' }],
    });
    const result = await service.getForClient('q-a', dealer());
    expect(result).not.toHaveProperty('internalNotes');
    expect((result as { rejectionReason?: string }).rejectionReason).toBe('Price too high');
  });
});
