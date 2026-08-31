import { BadRequestException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { RequestsService } from '../requests.service';

function dealer(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'dealer-a',
    username: 'nile',
    email: 'nile@example.com',
    name: 'Nile',
    roles: ['CUSTOMER'],
    permissions: ['request.read', 'request.create', 'request.update'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
    ...overrides,
  };
}

function admin(): AuthUser {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: ['request.read', 'request.update'],
    preferredLanguage: 'en',
  };
}

function makeService(existing?: Record<string, unknown>) {
  const requestRow = {
    id: 'rfq-1',
    number: 'RFQ-1',
    status: 'DRAFT',
    customerId: 'customer-a',
    archivedAt: null,
    submittedAt: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    informationRequestReason: null,
    reviewHistory: null,
    notes: null,
    internalNotes: null,
    requiredDeliveryDate: null,
    offeredDeliveryDate: null,
    items: [
      {
        productName: 'Sofa',
        quantity: 1,
        productId: 'p1',
        fabricType: null,
        fabricColor: null,
        fabricCode: null,
      },
    ],
    documents: [],
    customer: { id: 'customer-a', name: 'Nile', nameEn: 'Nile' },
    quotations: [],
    ...existing,
  };

  const prisma: any = {
    requestForQuotation: {
      findFirst: jest.fn().mockResolvedValue(requestRow),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...requestRow,
        ...data,
        items: requestRow.items,
        customer: requestRow.customer,
      })),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...requestRow,
        ...data,
        items: requestRow.items,
        customer: requestRow.customer,
      })),
    },
    requestItem: { deleteMany: jest.fn() },
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ imageUrl: null }),
    },
    productionOrder: { findFirst: jest.fn().mockResolvedValue(null) },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    scheduleChangeHistory: { create: jest.fn().mockResolvedValue({ id: 'hist-1' }) },
    customer: { findUnique: jest.fn() },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[]);
      return (arg as (t: any) => Promise<unknown>)(prisma);
    }),
  };
  const sequences = { next: jest.fn().mockResolvedValue('RFQ-TEST-1') };
  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
  };
  const storage = { createAccessToken: jest.fn().mockReturnValue('tok') };
  const service = new RequestsService(
    prisma as never,
    sequences as never,
    notifications as never,
    storage as never,
  );
  return { service, prisma, requestRow };
}

describe('dealer RFQ delivery lead time', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects create with today through day+3 and accepts day+4', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T05:00:00.000Z') });
    const { service, prisma } = makeService();
    const items = [{ productName: 'Sofa', quantity: 1, productId: 'p1' }];
    for (const date of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']) {
      await expect(
        service.create(
          { items, requiredDeliveryDate: date } as never,
          'dealer-a',
          { user: dealer() },
        ),
      ).rejects.toMatchObject({ response: { code: 'DELIVERY_DATE_TOO_SOON' } });
    }
    expect(prisma.requestForQuotation.create).not.toHaveBeenCalled();

    await service.create(
      { items, requiredDeliveryDate: '2026-09-14' } as never,
      'dealer-a',
      { user: dealer() },
    );
    expect(prisma.requestForQuotation.create).toHaveBeenCalled();
  });

  it('rejects a dealer edit that tries to bypass the cutoff', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T05:00:00.000Z') });
    const { service, prisma } = makeService({ status: 'DRAFT' });
    await expect(
      service.update('rfq-1', { requiredDeliveryDate: '2026-09-12' } as never, dealer()),
    ).rejects.toMatchObject({ response: { code: 'DELIVERY_DATE_TOO_SOON' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets staff record an early phone-order required date', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T05:00:00.000Z') });
    const { service, prisma } = makeService();
    await service.create(
      {
        customerId: 'customer-a',
        items: [{ productName: 'Sofa', quantity: 1, productId: 'p1' }],
        requiredDeliveryDate: '2026-09-11',
      } as never,
      'admin-1',
      { user: admin() },
    );
    expect(prisma.requestForQuotation.create).toHaveBeenCalled();
  });

  it('requires an explicit reason when admin offers a date before the dealer cutoff', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-10T05:00:00.000Z') });
    const { service, prisma } = makeService({
      requiredDeliveryDate: new Date('2026-09-18T00:00:00.000Z'),
      offeredDeliveryDate: null,
    });

    await expect(
      service.setOfferedDeliveryDate('rfq-1', admin(), '2026-09-12'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setOfferedDeliveryDate('rfq-1', admin(), '2026-09-12'),
    ).rejects.toMatchObject({ response: { code: 'REASON_REQUIRED' } });
    expect(prisma.requestForQuotation.update).not.toHaveBeenCalled();

    await service.setOfferedDeliveryDate(
      'rfq-1',
      admin(),
      '2026-09-12',
      'Rush for showroom opening',
    );
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newValues: expect.objectContaining({ dealerLeadTimeOverride: true }),
        }),
      }),
    );
  });
});
