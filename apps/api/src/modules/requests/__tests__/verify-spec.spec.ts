import { ForbiddenException } from '@nestjs/common';
import { RequestsService } from '../requests.service';

describe('verifySpec', () => {
  const requestRow = {
    id: 'rfq-1',
    number: 'RFQ-1',
    status: 'SUBMITTED',
    customerId: 'customer-a',
    archivedAt: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    reviewHistory: [],
    items: [{ id: 'item-1', productName: 'Karina', quantity: 1, fabricType: null, fabricColor: null, fabricCode: null }],
    documents: [],
    aiJobs: [],
    customer: { id: 'customer-a', name: 'Nile' },
    quotations: [],
  };

  function makeService() {
    const prisma: any = {
      requestForQuotation: {
        findFirst: jest.fn().mockResolvedValue(requestRow),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...requestRow,
          ...data,
        })),
      },
      requestItem: { update: jest.fn() },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productionOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      factoryCalendar: { findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }) },
      auditEvent: { create: jest.fn() },
    };
    const service = new RequestsService(
      prisma,
      { next: jest.fn() } as never,
      { notifyAdminUsers: jest.fn(), notifyCustomerUsers: jest.fn() } as never,
      { createAccessToken: jest.fn(() => 'tok') } as never,
    );
    return { service, prisma };
  }

  it('appends SPEC_CONFIRMED to reviewHistory', async () => {
    const { service, prisma } = makeService();
    await service.verifySpec(
      'rfq-1',
      {
        id: 'admin-1',
        username: 'admin',
        roles: ['SYSTEM_ADMINISTRATOR'],
        permissions: ['request.update'],
        preferredLanguage: 'en',
      } as never,
      { itemId: 'item-1', action: 'CONFIRM' },
    );
    const updateCalls = prisma.requestForQuotation.update.mock.calls as Array<
      [{ data: { reviewHistory?: Array<{ action: string }> } }]
    >;
    const historyCall = updateCalls.find((call) => Array.isArray(call[0]?.data?.reviewHistory));
    expect(historyCall?.[0]?.data?.reviewHistory?.some((row) => row.action === 'SPEC_CONFIRMED')).toBe(true);
  });

  it('appends SPEC_CORRECTED and keeps the original dealer value retrievable', async () => {
    const { service, prisma } = makeService();
    await service.verifySpec(
      'rfq-1',
      {
        id: 'admin-1',
        username: 'admin',
        roles: ['SYSTEM_ADMINISTRATOR'],
        permissions: ['request.update'],
        preferredLanguage: 'en',
      } as never,
      { itemId: 'item-1', action: 'CORRECT', message: 'Karina · 250', fields: { width: '255' } },
    );
    expect(prisma.requestItem.update).toHaveBeenCalled();
    const updateCalls = prisma.requestForQuotation.update.mock.calls as Array<
      [{ data: { reviewHistory?: Array<{ action: string; message?: string | null }> } }]
    >;
    const historyCall = updateCalls.find((call) => Array.isArray(call[0]?.data?.reviewHistory));
    expect(
      historyCall?.[0]?.data?.reviewHistory?.some(
        (row) => row.action === 'SPEC_CORRECTED' && row.message === 'Karina · 250',
      ),
    ).toBe(true);
  });

  it('forbids dealers from verifying specs', async () => {
    const { service } = makeService();
    await expect(
      service.verifySpec(
        'rfq-1',
        {
          id: 'dealer-1',
          username: 'nile',
          roles: ['CUSTOMER'],
          permissions: ['request.update'],
          preferredLanguage: 'ar',
          customerId: 'customer-a',
        } as never,
        { itemId: 'item-1', action: 'CONFIRM' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
