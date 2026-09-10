import { BadRequestException, ConflictException } from '@nestjs/common';
import { SchedulingService } from '../scheduling.service';

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    productionOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        id: 'po-1',
        status: 'PLANNED',
        releasedToFactoryAt: null,
        actualStartDate: null,
      }),
      update: jest.fn(),
    },
    productionSchedule: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    },
    productionTask: { findMany: jest.fn().mockResolvedValue([{ status: 'NOT_STARTED' }]) },
    scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleChangeHistory: { create: jest.fn().mockResolvedValue({}) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
    },
    productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    ...prismaOverrides,
  } as any;

  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    sendFromTemplate: jest.fn().mockResolvedValue(undefined),
  } as any;
  const idempotency = {
    once: jest.fn(async (_s: string, _k: string | undefined, _m: unknown, factory: () => Promise<unknown>) => ({
      result: await factory(),
      replayed: false,
    })),
  } as any;
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as any;
  const service = new SchedulingService(prisma, notifications, idempotency, queue);
  return { service, prisma };
}

const approved = {
  id: 'sched-1',
  productionOrderId: 'po-1',
  version: 3,
  status: 'APPROVED',
  approvedAt: new Date('2026-09-01T08:00:00.000Z'),
  approvedById: 'user-1',
};

describe('SchedulingService.unapprove', () => {
  it('reopens the same approved row without touching allocations or version', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findFirst.mockResolvedValue(approved);
    jest.spyOn(service, 'getOrderSchedule').mockResolvedValue({
      schedule: { id: 'sched-1', version: 3, status: 'PROPOSED' },
      canApprove: true,
      canUnapprove: false,
      executionStarted: false,
    } as any);

    const result = await service.unapprove('po-1', 3, 'user-1');

    expect(prisma.productionSchedule.update).toHaveBeenCalledWith({
      where: { id: 'sched-1' },
      data: expect.objectContaining({
        status: 'PROPOSED',
        promiseState: 'AWAITING_APPROVAL',
        approvedAt: null,
        approvedById: null,
      }),
    });
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
    expect(prisma.scheduleAllocation.findMany).not.toHaveBeenCalled();
    expect(prisma.scheduleChangeHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'unapprove', productionOrderId: 'po-1' }),
      }),
    );
    expect(result).toMatchObject({ canApprove: true, canUnapprove: false });
  });

  it('blocks overwrite once a stage has started', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findFirst.mockResolvedValue(approved);
    prisma.productionTask.findMany.mockResolvedValue([{ status: 'IN_PROGRESS' }]);

    await expect(service.unapprove('po-1', 3, 'user-1')).rejects.toMatchObject({
      response: { code: 'ALREADY_IN_PRODUCTION' },
    });
    expect(prisma.productionSchedule.update).not.toHaveBeenCalled();
    await expect(service.unapprove('po-1', 3, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a stale version', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findFirst.mockResolvedValue(approved);
    await expect(service.unapprove('po-1', 2, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.productionSchedule.update).not.toHaveBeenCalled();
  });

  it('is a no-op when the latest schedule is not approved', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findFirst.mockResolvedValue({ ...approved, status: 'PROPOSED' });
    jest.spyOn(service, 'getOrderSchedule').mockResolvedValue({
      schedule: { id: 'sched-1', version: 3, status: 'PROPOSED' },
    } as any);

    await service.unapprove('po-1', 3, 'user-1');
    expect(prisma.productionSchedule.update).not.toHaveBeenCalled();
  });

  it('lets approve → unapprove → approve reuse the same version', async () => {
    const { service, prisma } = makeService();
    const row = { ...approved, status: 'PROPOSED', approvedAt: null, approvedById: null };
    prisma.productionSchedule.findFirst.mockResolvedValue(row);
    prisma.productionSchedule.update.mockImplementation(async ({ data }: { data: { status: string } }) => {
      Object.assign(row, data);
      return row;
    });
    prisma.scheduleAllocation.findMany.mockResolvedValue([
      { id: 'alloc-1', plannedStart: new Date('2026-09-08T05:00:00.000Z'), plannedEnd: new Date('2026-09-08T08:00:00.000Z') },
    ]);
    jest.spyOn(service, 'getOrderSchedule').mockImplementation(async () => ({
      schedule: { id: row.id, version: row.version, status: row.status },
      canApprove: row.status === 'PROPOSED',
      canUnapprove: row.status === 'APPROVED',
      executionStarted: false,
    }) as any);
    jest.spyOn(service as any, 'customerFacingFingerprintForPo').mockResolvedValue(null);
    prisma.$transaction = jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
    prisma.productionSchedule.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    await service.approve('po-1', 3, 'user-1');
    expect(row.status).toBe('APPROVED');
    await service.unapprove('po-1', 3, 'user-1');
    expect(row.status).toBe('PROPOSED');
    expect(row.version).toBe(3);
    await service.approve('po-1', 3, 'user-1');
    expect(row.status).toBe('APPROVED');
    expect(row.version).toBe(3);
  });
});
