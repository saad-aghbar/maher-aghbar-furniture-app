import { ProductionOrderStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';

describe('ReportsService.adminHome', () => {
  const user: AuthUser = {
    id: 'u1',
    username: 'admin',
    email: 'a@b.c',
    name: 'Admin',
    roles: ['SYSTEM_ADMINISTRATOR'],
    permissions: [
      'report.sales.read',
      'production-task.read',
      'notification.read',
      'audit.read',
    ],
    preferredLanguage: 'en',
  };

  function makeService(overrides: Partial<Record<string, unknown>> = {}) {
    const prisma = {
      requestForQuotation: { count: jest.fn().mockResolvedValue(2) },
      salesOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      invoice: {
        count: jest.fn().mockResolvedValue(3),
        aggregate: jest.fn().mockResolvedValue({ _sum: { outstandingAmount: 1200 } }),
      },
      customer: { count: jest.fn().mockResolvedValue(5) },
      returnRequest: { count: jest.fn().mockResolvedValue(0) },
      inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
      productionOrder: { count: jest.fn().mockResolvedValue(4) },
      productionSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      productionTask: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            number: 'T-1',
            name: 'Cut foam',
            priority: 'URGENT',
            status: 'IN_PROGRESS',
            plannedCompletion: null,
            assignedEmployee: { firstName: 'Ali', lastName: 'H' },
          },
        ]),
      },
      notification: { count: jest.fn().mockResolvedValue(7) },
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            action: 'UPDATE',
            entityType: 'SalesOrder',
            entityId: 'so1',
            createdAt: new Date('2026-08-05T10:00:00Z'),
            user: { firstName: 'Admin', lastName: 'User' },
          },
        ]),
      },
      ...overrides,
    };
    return {
      service: new ReportsService(prisma as unknown as PrismaService),
      prisma,
    };
  }

  it('returns dashboard fields plus mobile extras', async () => {
    const { service, prisma } = makeService();
    const result = await service.adminHome(user);

    expect(result.newOrders).toBe(2);
    expect(Number(result.outstandingReceivables)).toBe(1200);
    expect(result.completedToday).toBe(4);
    expect(result.urgentTasksCount).toBe(2);
    expect(result.urgentTasks).toHaveLength(1);
    expect(result.urgentTasks[0]!.assigneeName).toBe('Ali H');
    expect(result.unreadNotifications).toBe(7);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity![0]!.actorName).toBe('Admin User');
    expect(result.floorSpotlight).toBeNull();
    expect(prisma.salesOrder.findFirst).toHaveBeenCalled();
    expect(prisma.productionSchedule.findMany).toHaveBeenCalled();
    expect(result.delayedOrders).toBe(0);
    expect(prisma.productionSchedule.findMany).toHaveBeenCalled();
    expect(prisma.productionOrder.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProductionOrderStatus.COMPLETED,
        }),
      }),
    );
  });

  it('omits tasks/notifications/activity when permissions missing', async () => {
    const limited: AuthUser = {
      ...user,
      permissions: ['report.sales.read'],
    };
    const { service, prisma } = makeService();
    const result = await service.adminHome(limited);

    expect(result.urgentTasksCount).toBe(0);
    expect(result.urgentTasks).toEqual([]);
    expect(result.unreadNotifications).toBe(0);
    expect(result.recentActivity).toBeNull();
    expect(prisma.productionTask.count).not.toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it('counts delayed orders from canonical may-be-late, not overdue required dates', async () => {
    const lateSo = {
      id: 'so-jabal',
      number: 'SO-2026-00023',
      status: 'IN_PRODUCTION',
      requiredDeliveryDate: new Date('2026-07-28T13:00:00.000Z'),
      externalOrderNumber: null,
      customer: { name: 'Jabal', nameEn: 'Jabal', nameAr: null, nameHe: null },
      lines: [],
      quotation: null,
    };
    const { service } = makeService({
      productionSchedule: {
        findMany: jest.fn().mockResolvedValue([
          {
            productionOrderId: 'po-jabal',
            version: 1,
            status: 'APPROVED',
            committedDeliveryDate: new Date('2026-08-10T13:00:00.000Z'),
            requestedDeliveryDate: new Date('2026-07-28T13:00:00.000Z'),
            earliestAvailableDate: new Date('2026-07-27T13:00:00.000Z'),
            suggestedDeliveryDate: new Date('2026-07-27T13:00:00.000Z'),
            requestedDateFeasible: false,
            unschedulableReason: null,
            requiresAdminEstimateReview: false,
            materialRisk: false,
            productionOrder: {
              id: 'po-jabal',
              number: 'PO-2026-00023',
              status: 'IN_PROGRESS',
              requiredDeliveryDate: new Date('2026-07-28T13:00:00.000Z'),
              committedDeliveryDate: new Date('2026-08-10T13:00:00.000Z'),
              salesOrderId: 'so-jabal',
            },
          },
        ]),
      },
      salesOrder: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(lateSo),
      },
    });
    const result = await service.adminHome(user);
    expect(result.delayedOrders).toBe(1);
    expect(result.floorSpotlight?.reason).toBe('late');
    expect(result.floorSpotlight?.order.number).toBe('SO-2026-00023');
    expect(result.floorSpotlight?.peerCount).toBe(1);
  });
});
