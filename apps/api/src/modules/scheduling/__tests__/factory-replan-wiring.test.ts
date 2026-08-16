/**
 * Factory replan HTTP/job wiring. Mocked Prisma only.
 */
import { SchedulingService } from '../scheduling.service';
import { OccupancyCollisionError } from '../domain/factory-replan';
import { zonedLocalToUtc } from '../domain/working-calendar';

const TZ = 'Asia/Amman';

function amman(y: number, m: number, d: number, hh: number, mm: number): Date {
  return zonedLocalToUtc(y, m, d, hh, mm, 0, TZ);
}

function makeService() {
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'cal-1',
        timezone: TZ,
        workingWeekdays: [0, 1, 2, 3, 4, 6],
        shiftStart: '08:00',
        shiftEnd: '16:00',
        breaks: [{ start: '12:00', end: '13:00' }],
        isDefault: true,
        deliveryBufferWorkingDays: 1,
      }),
      create: jest.fn(),
      update: jest.fn(),
    },
    factoryCalendarException: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        id: 'ex-1',
        date: new Date('2026-08-19T00:00:00.000Z'),
        type: 'SHUTDOWN',
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'ex-1',
        date: new Date('2026-08-19T00:00:00.000Z'),
        type: 'EXTRA_SHIFT',
      }),
      delete: jest.fn().mockResolvedValue({}),
    },
    productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    productionTask: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
    workerSkill: { findFirst: jest.fn() },
    productionSchedule: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    productionOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrderWorkflowSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
    productionOrderWorkflowSnapshotNode: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
    schedulingReplanRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1', status: 'QUEUED' }),
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as any;

  const notifications = {
    notifyAdminUsers: jest.fn().mockResolvedValue(undefined),
    notifyCustomerUsers: jest.fn().mockResolvedValue(undefined),
    sendFromTemplate: jest.fn().mockResolvedValue(undefined),
  } as any;
  const idempotency = {
    once: jest.fn(
      async (_s: string, _k: string | undefined, _m: unknown, factory: () => Promise<unknown>) => ({
        result: await factory(),
        replayed: false,
      }),
    ),
  } as any;
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined), setProcessor: jest.fn() } as any;
  const service = new SchedulingService(prisma, notifications, idempotency, queue);
  return { service, prisma, queue };
}

function atRiskSchedule(id: string, priority: 'HIGH' | 'NORMAL' = 'NORMAL') {
  return {
    id: `sch-${id}`,
    productionOrderId: id,
    version: 1,
    status: 'APPROVED',
    planningMode: 'BACKWARD',
    requestedDateFeasible: false,
    committedDeliveryDate: amman(2026, 8, 12, 16, 0),
    requestedDeliveryDate: amman(2026, 8, 12, 16, 0),
    earliestAvailableDate: amman(2026, 8, 22, 16, 0),
    suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
    unschedulableReason: null,
    requiresAdminEstimateReview: false,
    materialRisk: false,
    productionOrder: {
      id,
      number: `PO-${id}`,
      status: 'IN_PROGRESS',
      requiredDeliveryDate: amman(2026, 8, 12, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      priority,
      customerId: 'c1',
      createdAt: amman(2026, 8, 1, 8, 0),
      product: { id: 'p1', nameEn: 'Chair', nameAr: null, nameHe: null, imageUrl: null },
      salesOrder: { customer: { id: 'c1', name: 'A', nameEn: 'A', nameAr: null, nameHe: null } },
    },
  };
}

describe('factory replan wiring', () => {
  it('addException persists, enqueues REPLAN_FACTORY, and does not generate on the request path', async () => {
    const { service, prisma, queue } = makeService();
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);

    const result = await service.addException(
      { date: '2026-08-19', type: 'SHUTDOWN', note: 'Closed by admin' },
      'user-1',
    );

    expect(prisma.factoryCalendarException.upsert).toHaveBeenCalled();
    expect(prisma.schedulingReplanRun.create).toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN_FACTORY', { runId: 'run-1' });
    expect(result.replanQueued).toBe(true);
    expect(result.replanJobId).toBe('run-1');
    expect(result.calendarUpdated).toBe(true);
    expect(gen).not.toHaveBeenCalled();
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
  });

  it('deleteException enqueues without generating', async () => {
    const { service, prisma, queue } = makeService();
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);
    const result = await service.deleteException('2026-08-19', 'user-1');
    expect(prisma.factoryCalendarException.delete).toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN_FACTORY', { runId: 'run-1' });
    expect(result.replanQueued).toBe(true);
    expect(gen).not.toHaveBeenCalled();
  });

  it('REPLAN_FACTORY job generates increase candidates and records moved vs unchanged', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      actorId: 'user-1',
      changeType: 'calendar-exception:EXTRA_SHIFT',
      reason: 'calendar-exception:EXTRA_SHIFT',
      payload: { capacityDelta: 'increase', affectedYmd: '2026-08-19' },
    });
    prisma.productionSchedule.findMany.mockResolvedValue([atRiskSchedule('po-1', 'HIGH')]);
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      unschedulableReason: null,
      requiresAdminEstimateReview: false,
      materialRisk: false,
      requestedDateFeasible: false,
      earliestAvailableDate: amman(2026, 8, 22, 16, 0),
      suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      allocations: [{ productionTaskId: 't1', plannedStart: amman(2026, 8, 20, 8, 0), plannedEnd: amman(2026, 8, 20, 16, 0), employeeId: 'w1' }],
    });
    prisma.productionOrder.findUnique.mockResolvedValue(atRiskSchedule('po-1').productionOrder);
    let fingerprintCalls = 0;
    prisma.productionSchedule.findFirst.mockImplementation(async () => {
      fingerprintCalls += 1;
      const moved = fingerprintCalls > 1;
      return {
        status: 'APPROVED',
        unschedulableReason: null,
        requiresAdminEstimateReview: false,
        materialRisk: false,
        requestedDateFeasible: false,
        earliestAvailableDate: moved ? amman(2026, 8, 19, 16, 0) : amman(2026, 8, 22, 16, 0),
        suggestedDeliveryDate: moved ? amman(2026, 8, 19, 16, 0) : amman(2026, 8, 22, 16, 0),
        committedDeliveryDate: amman(2026, 8, 12, 16, 0),
        allocations: [
          {
            productionTaskId: 't1',
            plannedStart: moved ? amman(2026, 8, 19, 8, 0) : amman(2026, 8, 20, 8, 0),
            plannedEnd: moved ? amman(2026, 8, 19, 16, 0) : amman(2026, 8, 20, 16, 0),
            employeeId: 'w1',
          },
        ],
      };
    });
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);

    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });

    expect(gen).toHaveBeenCalledWith('po-1', 'user-1', expect.objectContaining({ reason: 'calendar-exception:EXTRA_SHIFT' }));
    const completed = prisma.schedulingReplanRun.update.mock.calls.find(
      (call: Array<{ data?: { status?: string } }>) => call[0]?.data?.status === 'COMPLETED',
    );
    expect(completed).toBeTruthy();
    expect(completed[0].data.result.moved).toBe(1);
  });

  it('one PO throw records failure and continues', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      actorId: 'user-1',
      changeType: 'calendar-exception:EXTRA_SHIFT',
      reason: 'x',
      payload: { capacityDelta: 'increase', affectedYmd: '2026-08-19' },
    });
    prisma.productionSchedule.findMany.mockResolvedValue([
      atRiskSchedule('po-1', 'HIGH'),
      atRiskSchedule('po-2', 'NORMAL'),
    ]);
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      unschedulableReason: null,
      requiresAdminEstimateReview: false,
      materialRisk: false,
      requestedDateFeasible: false,
      earliestAvailableDate: amman(2026, 8, 22, 16, 0),
      suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      allocations: [],
    });
    prisma.productionOrder.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      atRiskSchedule(where.id).productionOrder,
    );
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async (id) => {
      if (id === 'po-1') throw new Error('boom');
      return {} as never;
    });

    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });

    expect(gen).toHaveBeenCalledTimes(2);
    const completed = prisma.schedulingReplanRun.update.mock.calls.find(
      (call: Array<{ data?: { status?: string } }>) => call[0]?.data?.status === 'COMPLETED',
    );
    expect(completed[0].data.status).toBe('COMPLETED');
    expect(completed[0].data.result.failures).toEqual([
      expect.objectContaining({ productionOrderId: 'po-1', message: 'boom' }),
    ]);
  });

  it('processing the same COMPLETED runId twice does not generate again', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'COMPLETED',
      payload: { capacityDelta: 'increase' },
    });
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);
    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });
    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });
    expect(gen).not.toHaveBeenCalled();
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
  });

  it('retries once on occupancy collision then records failure if still colliding', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      actorId: 'user-1',
      changeType: 'calendar-exception:cleared',
      reason: 'calendar-exception:cleared',
      payload: { capacityDelta: 'increase', affectedYmd: '2026-08-19' },
    });
    prisma.productionSchedule.findMany.mockResolvedValue([atRiskSchedule('po-1', 'HIGH')]);
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      unschedulableReason: null,
      requiresAdminEstimateReview: false,
      materialRisk: false,
      requestedDateFeasible: false,
      earliestAvailableDate: amman(2026, 8, 22, 16, 0),
      suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      allocations: [],
    });
    prisma.productionOrder.findUnique.mockResolvedValue(atRiskSchedule('po-1').productionOrder);
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockRejectedValue(
      new OccupancyCollisionError('po-1', []),
    );

    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });

    expect(gen).toHaveBeenCalledTimes(2);
    expect(gen.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ validateAgainstOccupancy: true, existingOccupancy: expect.any(Array) }),
    );
    const completed = prisma.schedulingReplanRun.update.mock.calls.find(
      (call: Array<{ data?: { status?: string } }>) => call[0]?.data?.status === 'COMPLETED',
    );
    expect(completed[0].data.result.failures).toEqual([
      expect.objectContaining({ productionOrderId: 'po-1' }),
    ]);
    expect(completed[0].data.result.newConflictCount).toBe(0);
  });

  it('retries once then persists when the second generate succeeds', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      actorId: 'user-1',
      changeType: 'calendar-exception:cleared',
      reason: 'calendar-exception:cleared',
      payload: { capacityDelta: 'increase', affectedYmd: '2026-08-19' },
    });
    prisma.productionSchedule.findMany.mockResolvedValue([atRiskSchedule('po-1', 'HIGH')]);
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      unschedulableReason: null,
      requiresAdminEstimateReview: false,
      materialRisk: false,
      requestedDateFeasible: false,
      earliestAvailableDate: amman(2026, 8, 22, 16, 0),
      suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      allocations: [],
    });
    prisma.productionOrder.findUnique.mockResolvedValue(atRiskSchedule('po-1').productionOrder);
    let calls = 0;
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new OccupancyCollisionError('po-1', []);
      return {
        schedule: {
          allocations: [
            {
              id: 'alloc-1',
              employeeId: 'w1',
              plannedStart: amman(2026, 8, 19, 8, 0),
              plannedEnd: amman(2026, 8, 19, 12, 0),
            },
          ],
        },
      } as never;
    });

    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });

    expect(gen).toHaveBeenCalledTimes(2);
    const completed = prisma.schedulingReplanRun.update.mock.calls.find(
      (call: Array<{ data?: { status?: string } }>) => call[0]?.data?.status === 'COMPLETED',
    );
    expect(completed[0].data.result.failures).toEqual([]);
    expect(completed[0].data.result.newConflictCount).toBe(0);
  });

  it('second generate receives occupancy reserved by the first accepted plan', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      actorId: 'user-1',
      changeType: 'calendar-exception:cleared',
      reason: 'calendar-exception:cleared',
      payload: { capacityDelta: 'increase', affectedYmd: '2026-08-19' },
    });
    prisma.productionSchedule.findMany.mockResolvedValue([
      atRiskSchedule('po-1', 'HIGH'),
      atRiskSchedule('po-2', 'NORMAL'),
    ]);
    prisma.productionSchedule.findFirst.mockResolvedValue({
      status: 'APPROVED',
      unschedulableReason: null,
      requiresAdminEstimateReview: false,
      materialRisk: false,
      requestedDateFeasible: false,
      earliestAvailableDate: amman(2026, 8, 22, 16, 0),
      suggestedDeliveryDate: amman(2026, 8, 22, 16, 0),
      committedDeliveryDate: amman(2026, 8, 12, 16, 0),
      allocations: [],
    });
    prisma.productionOrder.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      atRiskSchedule(where.id).productionOrder,
    );
    const occupancySeen: unknown[] = [];
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async (id, _u, opts) => {
      occupancySeen.push(opts?.existingOccupancy ?? []);
      return {
        schedule: {
          allocations: [
            {
              id: `alloc-${id}`,
              employee: { id: 'w1' },
              plannedStart: amman(2026, 8, 19, 8, 0),
              plannedEnd: amman(2026, 8, 19, 12, 0),
              productionTask: { stageDefinitionId: 'stg-1' },
              resourceSlot: 0,
            },
          ],
        },
      } as never;
    });

    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });

    expect(gen).toHaveBeenCalledTimes(2);
    const second = occupancySeen[1] as Array<{ productionOrderId?: string; employeeId: string }>;
    expect(second.some((iv) => iv.productionOrderId === 'po-1' && iv.employeeId === 'w1')).toBe(true);
    expect(second.some((iv) => iv.employeeId === 'resource:stg-1:0')).toBe(true);
    const completed = prisma.schedulingReplanRun.update.mock.calls.find(
      (call: Array<{ data?: { status?: string } }>) => call[0]?.data?.status === 'COMPLETED',
    );
    expect(completed[0].data.result.newConflictCount).toBe(0);
  });

  it('does not start a second factory replan while another run is RUNNING', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'QUEUED',
      payload: { capacityDelta: 'increase' },
    });
    prisma.schedulingReplanRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'run-other' });
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);

    await expect(
      (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' }),
    ).rejects.toThrow(/FACTORY_REPLAN_BUSY/);
    expect(gen).not.toHaveBeenCalled();
    expect(prisma.schedulingReplanRun.update).not.toHaveBeenCalled();
  });

  it('reprocessing a COMPLETED runId does not create extra active versions or overlaps', async () => {
    const { service, prisma } = makeService();
    prisma.schedulingReplanRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'COMPLETED',
      payload: { capacityDelta: 'increase' },
      result: { newConflictCount: 0, moved: 1 },
    });
    const gen = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);
    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });
    await (service as any).processSchedulingJob('REPLAN_FACTORY', { runId: 'run-1' });
    expect(gen).not.toHaveBeenCalled();
    expect(prisma.productionSchedule.create).not.toHaveBeenCalled();
    expect(prisma.schedulingReplanRun.update).not.toHaveBeenCalled();
  });
});
