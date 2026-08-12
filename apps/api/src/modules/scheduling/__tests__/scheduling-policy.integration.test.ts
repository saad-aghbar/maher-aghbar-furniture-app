import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { SchedulingService } from '../scheduling.service';

/**
 * Lightweight unit tests for SchedulingService branches that only need a
 * mocked Prisma/Notifications/Idempotency/Queue surface — no real database.
 * Full end-to-end scheduling generation is covered by manual QA against a
 * seeded database (see docs/production-scheduling-test-plan.md).
 */

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    username: 'dealer1',
    email: 'dealer1@example.com',
    name: 'Dealer One',
    roles: ['DEALER'],
    permissions: ['schedule.request-change.own'],
    preferredLanguage: 'en',
    customerId: 'customer-1',
    ...overrides,
  };
}

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    productionOrder: { findFirst: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    productionSchedule: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    ...prismaOverrides,
  } as any;

  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    sendFromTemplate: jest.fn().mockResolvedValue(undefined),
  } as any;

  const idempotency = {
    once: jest.fn(async (_scope: string, _key: string | undefined, _meta: unknown, factory: () => Promise<unknown>) => ({
      result: await factory(),
      replayed: false,
    })),
  } as any;

  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as any;

  const service = new SchedulingService(prisma, notifications, idempotency, queue);
  return { service, prisma, notifications, idempotency, queue };
}

describe('SchedulingService.dealerDateChange', () => {
  it('throws ForbiddenException when the caller does not own the production order', async () => {
    const { service, prisma } = makeService();
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      customerId: 'someone-else',
      status: 'PLANNED',
      salesOrder: null,
    });

    await expect(
      service.dealerDateChange('po-1', { requestedDeliveryDate: '2030-01-01' }, makeUser()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects with DATE_CHANGE_LOCKED once the order is in production', async () => {
    const { service, prisma } = makeService();
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      customerId: 'customer-1',
      status: 'IN_PROGRESS',
      salesOrder: null,
    });
    prisma.productionSchedule.findFirst.mockResolvedValue(null);

    await expect(
      service.dealerDateChange('po-1', { requestedDeliveryDate: '2030-01-01' }, makeUser()),
    ).rejects.toMatchObject({ response: { code: 'DATE_CHANGE_LOCKED' } });
  });

  it('updates the order directly and notifies admins when no schedule is approved yet', async () => {
    const { service, prisma, notifications } = makeService();
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      number: 'PO-0001',
      customerId: 'customer-1',
      status: 'PLANNED',
      salesOrder: null,
    });
    prisma.productionSchedule.findFirst.mockResolvedValue(null);
    prisma.productionOrder.update.mockResolvedValue({});
    jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as any);

    const result = await service.dealerDateChange(
      'po-1',
      { requestedDeliveryDate: '2030-01-01' },
      makeUser(),
    );

    expect(result).toEqual({ ok: true, action: 'updated' });
    expect(prisma.productionOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'po-1' } }),
    );
    expect(notifications.notifyAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'DEALER_DATE_UPDATED' }),
    );
  });

  it('creates a change request (no direct update) once a schedule is approved', async () => {
    const { service, prisma, notifications } = makeService();
    prisma.productionOrder.findFirst.mockResolvedValue({
      id: 'po-1',
      number: 'PO-0001',
      customerId: 'customer-1',
      status: 'PLANNED',
      salesOrder: null,
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({ id: 'sched-1', status: 'APPROVED' });

    const result = await service.dealerDateChange(
      'po-1',
      { requestedDeliveryDate: '2030-01-01', reason: 'Customer needs it sooner' },
      makeUser(),
    );

    expect(result).toEqual({ ok: true, action: 'requested' });
    expect(prisma.productionOrder.update).not.toHaveBeenCalled();
    expect(notifications.notifyAdminUsers).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'DEALER_DATE_CHANGE_REQUEST' }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });
});

describe('SchedulingService.availability', () => {
  it('returns a dealer-safe UNAVAILABLE shape with no capacity/worker internals when products are unknown', async () => {
    const { service, prisma } = makeService({
      product: { findMany: jest.fn().mockResolvedValue([]) },
      productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const response = await service.availability(
      { items: [{ productId: '00000000-0000-0000-0000-000000000001', quantity: 1 }] },
      makeUser(),
    );

    expect(response).toEqual({
      estimateStatus: 'UNAVAILABLE',
      earliestAvailableDate: null,
      requestedDateFeasible: false,
      suggestedDeliveryDate: null,
      alternativeDates: [],
      estimateConfidence: 'LOW',
      requiresAdminEstimateReview: true,
    });
    // Dealer-safe: no worker/capacity/employee fields ever leak into the response.
    expect(Object.keys(response)).not.toEqual(
      expect.arrayContaining(['workers', 'employeeId', 'allocations']),
    );
  });
});
