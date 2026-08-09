import type { AuthUser } from '@maher/types';
import { ReportsService } from './reports.service';
import type { PrismaService } from '../../common/prisma.service';

const LEAK_KEYS = [
  'progressPercent',
  'manufacturingCost',
  'costBreakdown',
  'productionPrice',
  'profit',
  'salary',
  'assignedEmployee',
  'assigneeName',
  'assignedEmployeeId',
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

function collectAssignedIds(calls: unknown[][]): string[] {
  const ids: string[] = [];
  for (const call of calls) {
    const where = (call[0] as { where?: { assignedEmployeeId?: string } })?.where;
    if (where?.assignedEmployeeId) ids.push(where.assignedEmployeeId);
  }
  return ids;
}

describe('ReportsService.workerHome', () => {
  const workerA: AuthUser = {
    id: 'worker-a',
    username: 'carpenter',
    email: 'carpenter@example.com',
    name: 'Ali Hassan',
    roles: ['PRODUCTION_WORKER'],
    permissions: ['production-task.read', 'notification.read'],
    preferredLanguage: 'en',
  };

  const workerB: AuthUser = {
    ...workerA,
    id: 'worker-b',
    username: 'painter',
    name: 'Sara Nassar',
  };

  function makeService() {
    const productionTaskCount = jest.fn().mockResolvedValue(2);
    const productionTaskFindMany = jest.fn().mockResolvedValue([]);
    const notificationCount = jest.fn().mockResolvedValue(1);
    const notificationFindMany = jest.fn().mockResolvedValue([
      {
        id: 'n1',
        titleEn: 'New task',
        titleAr: 'مهمة جديدة',
        bodyEn: 'Assigned to you',
        bodyAr: 'أُسندت إليك',
        createdAt: new Date('2026-08-05T10:00:00.000Z'),
        readAt: null,
      },
    ]);

    const prisma = {
      productionTask: {
        count: productionTaskCount,
        findMany: productionTaskFindMany,
      },
      notification: {
        count: notificationCount,
        findMany: notificationFindMany,
      },
    };

    return {
      service: new ReportsService(prisma as unknown as PrismaService),
      productionTaskCount,
      productionTaskFindMany,
      notificationCount,
      notificationFindMany,
    };
  }

  it('scopes every task query to worker A assignedEmployeeId', async () => {
    const { service, productionTaskCount, productionTaskFindMany } = makeService();
    await service.workerHome(workerA);

    for (const call of productionTaskCount.mock.calls) {
      expect(call[0].where.assignedEmployeeId).toBe('worker-a');
    }
    expect(productionTaskFindMany.mock.calls[0][0].where.assignedEmployeeId).toBe(
      'worker-a',
    );
  });

  it('never queries Worker B assignedEmployeeId', async () => {
    const { service, productionTaskCount, productionTaskFindMany } = makeService();
    await service.workerHome(workerA);

    const ids = [
      ...collectAssignedIds(productionTaskCount.mock.calls),
      ...collectAssignedIds(productionTaskFindMany.mock.calls),
    ];
    expect(ids.every((id) => id === 'worker-a')).toBe(true);
    expect(ids.includes(workerB.id)).toBe(false);
  });

  it('does not return Worker B tasks even if present in unrelated data', async () => {
    const { service, productionTaskFindMany } = makeService();
    productionTaskFindMany.mockResolvedValueOnce([
      {
        id: 'task-a',
        number: 'PT-1',
        name: 'Cutting',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        plannedCompletion: new Date('2026-08-05T17:00:00.000Z'),
        productionOrder: {
          number: 'PO-1',
          productDescription: 'Table',
          salesOrder: { number: 'ORD-1258' },
          product: {
            nameEn: 'Dining Table',
            nameAr: null,
            nameHe: null,
            imageUrl: null,
          },
        },
      },
    ]);

    const result = await service.workerHome(workerA);
    expect(result.urgentTask?.id).toBe('task-a');
    expect(result.todaysTasks.every((t) => t.id !== 'task-b')).toBe(true);
    // findMany was scoped — B never requested
    expect(productionTaskFindMany.mock.calls[0][0].where.assignedEmployeeId).toBe(
      'worker-a',
    );
  });

  it('returns floor-safe payload without progress/cost/other-worker leaks', async () => {
    const { service, productionTaskFindMany } = makeService();
    productionTaskFindMany.mockResolvedValueOnce([
      {
        id: 'task-a',
        number: 'PT-1',
        name: 'Assembly',
        priority: 'HIGH',
        status: 'READY',
        plannedCompletion: null,
        estimatedMinutes: 90,
        stageDefinition: {
          estimatedHours: null,
          nameEn: 'Assembly',
          nameAr: 'تجميع',
          nameHe: null,
        },
        productionOrder: {
          number: 'PO-9',
          productDescription: 'Sofa',
          salesOrder: { number: 'ORD-99' },
          product: {
            nameEn: 'Lobby Sofa',
            nameAr: null,
            nameHe: null,
            imageUrl: 'https://example.com/sofa.png',
          },
        },
      },
    ]);

    const result = await service.workerHome(workerA);
    expect(result.completedTodayCount).toBe(2);
    expect(result.urgentTask?.orderNumber).toBe('ORD-99');
    expect(result.urgentTask?.imageUrl).toBe('https://example.com/sofa.png');
    expect(result.urgentTask?.estimatedMinutes).toBe(90);
    expect(result.notifications).toHaveLength(1);
    assertNoLeaks(result);
    expect(JSON.stringify(result)).not.toContain('progressPercent');
  });

  it('scopes notifications to the current user only', async () => {
    const { service, notificationCount, notificationFindMany } = makeService();
    await service.workerHome(workerA);
    expect(notificationCount.mock.calls[0][0].where.userId).toBe('worker-a');
    expect(notificationFindMany.mock.calls[0][0].where.userId).toBe('worker-a');
  });
});
