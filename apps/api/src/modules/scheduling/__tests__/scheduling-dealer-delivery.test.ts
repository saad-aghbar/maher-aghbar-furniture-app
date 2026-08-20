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

  it('uses Delivery.deliveryDate as actual, not updatedAt', async () => {
    const { service, prisma } = makeService();
    const deliveredOn = new Date('2026-08-12T00:00:00.000Z');
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      number: 'PO-1',
      status: 'COMPLETED',
      requiredDeliveryDate: deliveredOn,
      committedDeliveryDate: deliveredOn,
      salesOrder: {
        id: 'so-1',
        status: 'DELIVERED',
        requiredDeliveryDate: deliveredOn,
        quotation: { request: { status: 'QUOTED' } },
        deliveries: [
          {
            status: 'DELIVERED',
            deliveryDate: deliveredOn,
            updatedAt: new Date('2026-08-15T12:00:00.000Z'),
          },
        ],
      },
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      requestedDeliveryDate: deliveredOn,
      suggestedDeliveryDate: deliveredOn,
      committedDeliveryDate: deliveredOn,
      earliestAvailableDate: deliveredOn,
    });
    const dto = await service.getOwnOrderSchedule('po-1', makeUser());
    expect(dto.customerStatus).toBe('DELIVERED');
    expect(dto.calendarDate).toBe('2026-08-12');
    expect(new Date(dto.actualDeliveryDate as Date).toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('keeps a slipped commitment on Aug 19 and omits it from Aug 21 range', async () => {
    const { service, prisma } = makeService();
    const committed = new Date('2026-08-19T00:00:00.000Z');
    const slipped = new Date('2026-08-21T00:00:00.000Z');
    prisma.salesOrder.findMany.mockResolvedValue([
      {
        id: 'so-19',
        number: 'SO-2026-00019',
        status: 'IN_PRODUCTION',
        requiredDeliveryDate: committed,
        deliveryAddress: null,
        projectName: 'Abdali',
        quotation: { request: null },
        lines: [],
        productionOrders: [
          {
            id: 'po-19',
            number: 'PO-19',
            status: 'IN_PROGRESS',
            requiredDeliveryDate: committed,
            committedDeliveryDate: committed,
            quantity: 1,
            productDescription: 'Banquette',
            product: { nameEn: 'Banquette', nameAr: null, nameHe: null, imageUrl: null },
            schedules: [
              {
                status: 'APPROVED',
                requestedDeliveryDate: committed,
                suggestedDeliveryDate: committed,
                committedDeliveryDate: committed,
                earliestAvailableDate: slipped,
                requestedDateFeasible: true,
                materialRisk: false,
                requiresAdminEstimateReview: false,
                unschedulableReason: null,
              },
            ],
          },
        ],
        deliveries: [],
      },
    ]);

    const august = await service.listOwnDeliveries(makeUser(), { from: '2026-08-01', to: '2026-08-31' });
    expect(august.data).toHaveLength(1);
    expect(august.data[0]!.calendarDate).toBe('2026-08-19');
    expect(august.data[0]!.projectedDeliveryDate).toEqual(slipped);
    expect(august.data[0]!.customerStatus).toBe('MAY_BE_DELAYED');
    expect(august.data[0]!.requiresDealerAttention).toBe(false);

    const onPromise = await service.listOwnDeliveries(makeUser(), {
      from: '2026-08-19',
      to: '2026-08-19',
    });
    expect(onPromise.data.map((r: { salesOrderId: string }) => r.salesOrderId)).toEqual(['so-19']);

    const onProjection = await service.listOwnDeliveries(makeUser(), {
      from: '2026-08-21',
      to: '2026-08-21',
    });
    expect(onProjection.data).toHaveLength(0);
  });

  it('nulls a stale past projection and keeps DELAYED on committed', async () => {
    const { service, prisma } = makeService();
    const requested = new Date('2026-07-28T00:00:00.000Z');
    const historical = new Date('2026-07-27T00:00:00.000Z');
    const committed = new Date('2026-08-10T00:00:00.000Z');
    prisma.salesOrder.findMany.mockResolvedValue([
      {
        id: 'so-jabal',
        number: 'SO-2026-00023',
        status: 'IN_PRODUCTION',
        requiredDeliveryDate: requested,
        deliveryAddress: null,
        projectName: 'Jabal',
        quotation: { request: null },
        lines: [],
        productionOrders: [
          {
            id: 'po-jabal',
            number: 'PO-22',
            status: 'IN_PROGRESS',
            requiredDeliveryDate: requested,
            committedDeliveryDate: committed,
            quantity: 1,
            productDescription: 'Dining',
            product: { nameEn: 'Dining', nameAr: null, nameHe: null, imageUrl: null },
            schedules: [
              {
                status: 'APPROVED',
                requestedDeliveryDate: requested,
                suggestedDeliveryDate: historical,
                committedDeliveryDate: committed,
                earliestAvailableDate: historical,
                requestedDateFeasible: false,
                materialRisk: false,
                requiresAdminEstimateReview: false,
                unschedulableReason: null,
              },
            ],
          },
        ],
        deliveries: [],
      },
    ]);

    const listed = await service.listOwnDeliveries(makeUser());
    expect(listed.data[0]!.calendarDate).toBe('2026-08-10');
    expect(listed.data[0]!.projectedDeliveryDate).toBeNull();
    expect(listed.data[0]!.customerStatus).toBe('DELAYED');
    expect(listed.data[0]!.scheduleUpdating).toBe(true);
    expect(listed.data[0]!.requiresDealerAttention).toBe(false);

    const onCommit = await service.listOwnDeliveries(makeUser(), {
      from: '2026-08-10',
      to: '2026-08-10',
    });
    expect(onCommit.data.map((r: { salesOrderId: string }) => r.salesOrderId)).toEqual(['so-jabal']);

    const onHistory = await service.listOwnDeliveries(makeUser(), {
      from: '2026-07-27',
      to: '2026-07-27',
    });
    expect(onHistory.data).toHaveLength(0);
  });

  it('filters own-deliveries by planned logistics day, not production suggested', async () => {
    const { service, prisma } = makeService();
    const requested = new Date('2026-08-19T00:00:00.000Z');
    const suggested = new Date('2026-08-17T00:00:00.000Z');
    const planned = new Date('2026-08-19T00:00:00.000Z');
    prisma.salesOrder.findMany.mockResolvedValue([
      {
        id: 'so-balqis',
        number: 'SO-2026-00019',
        status: 'READY_FOR_DELIVERY',
        requiredDeliveryDate: requested,
        deliveryAddress: null,
        projectName: 'Abdali',
        quotation: { request: null },
        lines: [],
        productionOrders: [
          {
            id: 'po-balqis',
            number: 'PO-18',
            status: 'READY_FOR_DELIVERY',
            requiredDeliveryDate: requested,
            committedDeliveryDate: null,
            quantity: 6,
            productDescription: 'Banquette',
            product: { nameEn: 'Banquette', nameAr: null, nameHe: null, imageUrl: null },
            schedules: [
              {
                status: 'APPROVED',
                requestedDeliveryDate: requested,
                suggestedDeliveryDate: suggested,
                committedDeliveryDate: null,
                earliestAvailableDate: suggested,
                requestedDateFeasible: true,
                materialRisk: false,
                requiresAdminEstimateReview: false,
                unschedulableReason: null,
              },
            ],
          },
        ],
        deliveries: [{ status: 'PLANNED', deliveryDate: planned }],
      },
    ]);

    const listed = await service.listOwnDeliveries(makeUser());
    expect(listed.data[0]!.calendarDate).toBe('2026-08-19');
    expect(listed.data[0]!.plannedDeliveryDate).toEqual(planned);
    expect(listed.data[0]!.suggestedDeliveryDate).toEqual(suggested);
    expect(listed.data[0]!.committedDeliveryDate).toBeNull();
    expect(listed.data[0]!.customerStatus).toBe('READY_FOR_DELIVERY');

    const onTruck = await service.listOwnDeliveries(makeUser(), {
      from: '2026-08-19',
      to: '2026-08-19',
    });
    expect(onTruck.data.map((r: { salesOrderId: string }) => r.salesOrderId)).toEqual(['so-balqis']);

    const onProduction = await service.listOwnDeliveries(makeUser(), {
      from: '2026-08-17',
      to: '2026-08-17',
    });
    expect(onProduction.data).toHaveLength(0);
  });

  it('does not leak another dealer into calendar counts', async () => {
    const { service, prisma } = makeService();
    prisma.salesOrder.findMany.mockResolvedValue([]);
    await service.listOwnDeliveries(makeUser({ customerId: 'customer-oasis' }));
    expect(prisma.salesOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: 'customer-oasis', archivedAt: null },
      }),
    );
    expect(prisma.salesOrder.findMany.mock.calls[0][0]).not.toHaveProperty('take');
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
