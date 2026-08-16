import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { SchedulingService } from '../scheduling.service';

const TZ = 'Asia/Amman';

function calendarRow() {
  return {
    id: 'cal-1',
    timezone: TZ,
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    deliveryBufferWorkingDays: 1,
    isDefault: true,
  };
}

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-a',
    username: 'nile',
    email: 'nile@example.com',
    name: 'Nile',
    roles: ['CUSTOMER'],
    permissions: ['schedule.read.own'],
    preferredLanguage: 'en',
    customerId: 'customer-a',
    ...overrides,
  };
}

function makeService() {
  const prisma = {
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue(calendarRow()),
      create: jest.fn(),
      update: jest.fn(),
    },
    factoryCalendarException: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    productionSchedule: { findFirst: jest.fn() },
    salesOrder: { findMany: jest.fn().mockResolvedValue([]) },
    notificationTemplate: { findUnique: jest.fn().mockResolvedValue({ code: 'DELIVERY_DATE_UPDATED' }) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
  } as any;

  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue({ ok: true, count: 1 }),
    sendFromTemplate: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new SchedulingService(
    prisma,
    notifications,
    { once: jest.fn() } as any,
    { enqueue: jest.fn() } as any,
  );
  return { service, prisma, notifications };
}

describe('dealer own schedule + own-deliveries isolation', () => {
  it('404s when Dealer A asks for Dealer B production order', async () => {
    const { service, prisma } = makeService();
    prisma.productionOrder.findFirst.mockResolvedValue(null);
    await expect(service.getOwnOrderSchedule('po-b', makeUser())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.productionOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'po-b',
          OR: [{ customerId: 'customer-a' }, { salesOrder: { customerId: 'customer-a' } }],
        }),
      }),
    );
  });

  it('403s own-deliveries without a customer account', async () => {
    const { service } = makeService();
    await expect(
      service.listOwnDeliveries(makeUser({ customerId: undefined })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes own-deliveries to the caller customerId', async () => {
    const { service, prisma } = makeService();
    prisma.salesOrder.findMany.mockResolvedValue([]);
    await service.listOwnDeliveries(makeUser());
    expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'customer-a', archivedAt: null },
      }),
    );
  });

  it('maps compact confirmed dates and projected without exposing earliestAvailableDate', async () => {
    const { service, prisma } = makeService();
    const committed = new Date('2026-08-25T00:00:00.000Z');
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      number: 'PO-1',
      status: 'PLANNED',
      requiredDeliveryDate: committed,
      committedDeliveryDate: committed,
      salesOrder: { id: 'so-1', status: 'CONFIRMED', requiredDeliveryDate: committed, deliveries: [] },
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      requestedDeliveryDate: committed,
      suggestedDeliveryDate: committed,
      committedDeliveryDate: committed,
      earliestAvailableDate: committed,
      requestedDateFeasible: true,
      materialRisk: false,
      requiresAdminEstimateReview: false,
      unschedulableReason: null,
    });

    const dto = await service.getOwnOrderSchedule('po-1', makeUser());
    expect(dto.customerStatus).toBe('CONFIRMED_ON_TRACK');
    expect(dto.compactDates).toBe(true);
    expect(dto.calendarDate).toBe('2026-08-25');
    expect(dto).toHaveProperty('projectedDeliveryDate');
    expect(dto).not.toHaveProperty('earliestAvailableDate');
    expect(dto).not.toHaveProperty('allocations');
    expect(dto).not.toHaveProperty('unschedulableReason');
  });
});

describe('dealer fingerprint notify', () => {
  it('does not notify when only allocations would have moved (same fingerprint)', async () => {
    const { service, prisma, notifications } = makeService();
    const committed = new Date('2026-08-23T00:00:00.000Z');
    prisma.productionOrder.findUnique.mockResolvedValue({
      status: 'IN_PROGRESS',
      number: 'PO-1',
      customerId: 'customer-a',
      requiredDeliveryDate: committed,
      committedDeliveryDate: committed,
      salesOrder: { id: 'so-1', customerId: 'customer-a', status: 'IN_PRODUCTION', deliveries: [] },
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({
      requestedDeliveryDate: committed,
      suggestedDeliveryDate: committed,
      committedDeliveryDate: committed,
      earliestAvailableDate: committed,
    });

    const fp = await (service as any).customerFacingFingerprintForPo('po-1');
    await (service as any).notifyDealerIfCustomerFacingChanged('po-1', fp);
    expect(notifications.notifyCustomerUsers).not.toHaveBeenCalled();
  });

  it('notifies with a customer-safe template when projected day slips', async () => {
    const { service, prisma, notifications } = makeService();
    const committed = new Date('2026-08-23T00:00:00.000Z');
    const slipped = new Date('2026-08-25T00:00:00.000Z');
    prisma.productionOrder.findUnique.mockResolvedValue({
      status: 'IN_PROGRESS',
      number: 'PO-1',
      customerId: 'customer-a',
      requiredDeliveryDate: committed,
      committedDeliveryDate: committed,
      salesOrder: { id: 'so-1', customerId: 'customer-a', status: 'IN_PRODUCTION', deliveries: [] },
    });
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce({
        requestedDeliveryDate: committed,
        suggestedDeliveryDate: committed,
        committedDeliveryDate: committed,
        earliestAvailableDate: slipped,
      })
      .mockResolvedValue({
        requestedDeliveryDate: committed,
        suggestedDeliveryDate: committed,
        committedDeliveryDate: committed,
        earliestAvailableDate: slipped,
      });
    prisma.notificationTemplate.findUnique.mockResolvedValue({ code: 'DELIVERY_MAY_BE_DELAYED' });

    await (service as any).notifyDealerIfCustomerFacingChanged(
      'po-1',
      '2026-08-23|2026-08-23|2026-08-23|IN_PRODUCTION|',
    );
    expect(notifications.notifyCustomerUsers).toHaveBeenCalledWith(
      'customer-a',
      expect.objectContaining({
        templateCode: 'DELIVERY_MAY_BE_DELAYED',
        vars: expect.objectContaining({ orderNumber: 'PO-1' }),
      }),
    );
  });
});
