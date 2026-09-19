import { WatchService } from './watch.service';
import type { ReportsService } from '../reports/reports.service';
import type { PrismaService } from '../../common/prisma.service';
import type { QualityFloorService } from '../quality/quality-floor.service';
import type { AuthUser } from '@maher/types';

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    username: 'carpenter',
    name: 'Khaled Obeid',
    roles: ['PRODUCTION_WORKER'],
    permissions: ['production-task.read', 'quality-inspection.perform'],
    preferredLanguage: 'en',
    ...overrides,
  } as AuthUser;
}

describe('WatchService', () => {
  function make(
    reports: Partial<ReportsService>,
    prisma: Partial<PrismaService> = {},
    qualityFloor: Partial<QualityFloorService> = {},
  ) {
    return new WatchService(
      reports as ReportsService,
      prisma as PrismaService,
      qualityFloor as QualityFloorService,
    );
  }

  it('maps worker today current task and start/complete flags', async () => {
    const service = make(
      {
        workerHome: jest.fn().mockResolvedValue({
          urgentTask: {
            id: 't1',
            name: 'Carpentry',
            status: 'READY',
            orderNumber: 'SO-1',
            productTitle: 'Model 204',
          },
          todaysTasks: [],
          completedTodayCount: 2,
          unreadNotifications: 1,
        }),
      },
      {
        qualityInspection: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'qi1',
            stageCode: 'ASSEMBLY',
            productionOrder: {
              number: 'PO-1',
              productDescription: null,
              product: { nameEn: 'Luna' },
              salesOrder: { number: 'SO-9' },
            },
          }),
        },
      } as never,
    );

    const result = await service.workerToday(user());
    expect(result.currentTask).toMatchObject({
      id: 't1',
      canStart: true,
      canComplete: false,
      orderNumber: 'SO-1',
    });
    expect(result.nextInspection).toMatchObject({ id: 'qi1', orderNumber: 'SO-9' });
    expect(result.completedToday).toBe(2);
  });

  it('omits inspection when the worker cannot perform QC', async () => {
    const findFirst = jest.fn();
    const service = make(
      {
        workerHome: jest.fn().mockResolvedValue({
          urgentTask: null,
          todaysTasks: [],
          completedTodayCount: 0,
          unreadNotifications: 0,
        }),
      },
      { qualityInspection: { findFirst } } as never,
    );

    const result = await service.workerToday(
      user({ permissions: ['production-task.read'] }),
    );
    expect(result.nextInspection).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('maps admin alerts without inventing dismiss actions', async () => {
    const service = make(
      {
        adminHome: jest.fn().mockResolvedValue({
          urgentTasksCount: 1,
          unreadNotifications: 1,
          completedToday: 4,
          urgentTasks: [{ id: 'task-1', name: 'Late carpentry', plannedCompletion: null }],
        }),
      },
      {
        notification: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'n1', titleEn: 'Task ready', titleAr: 'جاهز', createdAt: new Date('2026-09-19') },
          ]),
        },
      } as never,
      { qualityAttentionCards: jest.fn().mockResolvedValue([]) },
    );

    const result = await service.adminSummary(
      user({
        permissions: ['report.sales.read', 'notification.read', 'quality-inspection.read'],
      }),
    );
    expect(result.counts.urgentTasks).toBe(1);
    expect(result.alerts[0]).toMatchObject({ id: 'n1', kind: 'notification' });
    expect(result.alerts.some((a) => a.kind === 'task')).toBe(true);
  });

  it('maps dealer orders without money fields', async () => {
    const service = make({
      dealerHome: jest.fn().mockResolvedValue({
        activeOrders: 3,
        ordersInProduction: 2,
        ordersNearingDelivery: 1,
        completedOrders: 9,
        outstandingBalance: 471.053,
        recentOrders: [
          {
            id: 'so1',
            number: 'SO-2026-00001',
            status: 'IN_PRODUCTION',
            title: 'Classic Chair',
            customerStatus: 'In production',
            calendarDate: '2026-09-22',
          },
        ],
      }),
    });

    const result = await service.dealerOrders(
      user({ permissions: ['sales-order.read'], customerId: 'c1' } as AuthUser),
    );
    expect(result.counts.inProduction).toBe(2);
    expect(result.orders[0]).toMatchObject({ number: 'SO-2026-00001', title: 'Classic Chair' });
    expect(JSON.stringify(result)).not.toMatch(/471|outstanding|balance/i);
  });
});
