import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';

const LEAK_KEYS = [
  'manufacturingCost',
  'costBreakdown',
  'productionPrice',
  'profit',
  'bomDefaults',
  'assignedEmployee',
  'stages',
  'currentStageCode',
  'currentStage',
];

function assertNoLeaks(value: unknown, path = 'root'): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoLeaks(item, `${path}[${i}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (LEAK_KEYS.includes(key)) {
      throw new Error(`Leak field "${key}" present at ${path}`);
    }
    assertNoLeaks(child, `${path}.${key}`);
  }
}

describe('ReportsService.dealerHome', () => {
  const dealerA: AuthUser = {
    id: 'user-a',
    username: 'cedar',
    email: 'cedar@example.com',
    name: 'Cedar Hotel',
    roles: ['CUSTOMER'],
    permissions: ['sales-order.read', 'invoice.read', 'notification.read'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
  };

  const dealerB: AuthUser = {
    ...dealerA,
    id: 'user-b',
    username: 'olive',
    customerId: 'customer-b',
  };

  function makeService() {
    const salesOrderCount = jest.fn().mockResolvedValue(2);
    const salesOrderFindMany = jest.fn().mockResolvedValue([]);
    const invoiceAggregate = jest.fn().mockResolvedValue({ _sum: { outstandingAmount: 500 } });
    const invoiceFindFirst = jest.fn().mockResolvedValue({
      dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    });
    const invoiceFindMany = jest.fn().mockResolvedValue([
      {
        id: 'inv1',
        number: 'INV-1',
        status: 'ISSUED',
        total: 500,
        outstandingAmount: 500,
        invoiceDate: new Date('2026-08-01'),
        dueDate: new Date('2026-08-20'),
      },
    ]);
    const notificationCount = jest.fn().mockResolvedValue(1);

    const prisma = {
      factoryCalendar: {
        findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
      },
      salesOrder: {
        count: salesOrderCount,
        findMany: salesOrderFindMany,
      },
      invoice: {
        aggregate: invoiceAggregate,
        findFirst: invoiceFindFirst,
        findMany: invoiceFindMany,
      },
      notification: { count: notificationCount },
    };

    return {
      service: new ReportsService(prisma as unknown as PrismaService),
      prisma,
      salesOrderCount,
      salesOrderFindMany,
      invoiceAggregate,
    };
  }

  it('rejects users without customerId', async () => {
    const { service } = makeService();
    const admin: AuthUser = { ...dealerA, customerId: undefined };
    await expect(service.dealerHome(admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes every query to the dealer customerId', async () => {
    const { service, salesOrderCount, salesOrderFindMany, invoiceAggregate } = makeService();
    await service.dealerHome(dealerA);

    for (const call of salesOrderCount.mock.calls) {
      expect(call[0].where.customerId).toBe('customer-a');
    }
    expect(salesOrderFindMany.mock.calls[0][0].where.customerId).toBe('customer-a');
    expect(invoiceAggregate.mock.calls[0][0].where.customerId).toBe('customer-a');
  });

  it('never queries another dealer customerId', async () => {
    const { service, salesOrderCount } = makeService();
    await service.dealerHome(dealerA);
    const foreign = salesOrderCount.mock.calls.some(
      (c) => c[0].where.customerId === dealerB.customerId,
    );
    expect(foreign).toBe(false);
  });

  it('returns dealer-safe payload without cost/worker/stage leaks', async () => {
    const { service, salesOrderFindMany } = makeService();
    salesOrderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
      {
        id: 'so1',
        number: 'SO-1',
        status: 'IN_PRODUCTION',
        requiredDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
        externalOrderNumber: null,
        lines: [
          {
            description: 'Sofa',
            product: { nameEn: 'Lobby Sofa', nameAr: null, nameHe: null, imageUrl: null },
          },
        ],
        quotation: { request: null },
        productionOrders: [
          {
            progressPercent: 55,
            status: 'IN_PROGRESS',
            requiredDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
            committedDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
            schedules: [
              {
                status: 'APPROVED',
                requestedDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
                suggestedDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
                committedDeliveryDate: new Date('2026-08-20T00:00:00.000Z'),
                earliestAvailableDate: new Date('2026-08-20T00:00:00.000Z'),
              },
            ],
          },
        ],
        deliveries: [],
      },
    ]);

    const result = await service.dealerHome(dealerA);
    expect(result.outstandingBalance).toBeDefined();
    expect(result.recentOrders[0]!.progressPercent).toBe(40);
    expect(result.recentOrders[0]!.progressLabel).toBe('In progress');
    expect(result.recentOrders[0]!.calendarDate).toBe('2026-08-20');
    expect(result.recentOrders[0]!.committedDeliveryDate).toBe('2026-08-20');
    assertNoLeaks(result);
  });

  it('counts nearing from calendarDate (committed), not a slipped projection', async () => {
    const { service, salesOrderFindMany } = makeService();
    const committed = new Date('2026-08-19T00:00:00.000Z');
    const slipped = new Date('2026-08-28T00:00:00.000Z');
    salesOrderFindMany.mockResolvedValueOnce([
      {
        status: 'IN_PRODUCTION',
        requiredDeliveryDate: committed,
        quotation: { request: null },
        productionOrders: [
          {
            status: 'IN_PROGRESS',
            requiredDeliveryDate: committed,
            committedDeliveryDate: committed,
            schedules: [
              {
                status: 'APPROVED',
                requestedDeliveryDate: committed,
                suggestedDeliveryDate: committed,
                committedDeliveryDate: committed,
                earliestAvailableDate: slipped,
              },
            ],
          },
        ],
        deliveries: [],
      },
    ]);
    const result = await service.dealerHome(dealerA);
    expect(result.ordersNearingDelivery).toBe(1);
  });
});
