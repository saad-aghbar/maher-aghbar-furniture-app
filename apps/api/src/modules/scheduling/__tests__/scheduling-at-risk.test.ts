import { ConflictException } from '@nestjs/common';
import { SchedulingService } from '../scheduling.service';

const now = new Date();
const utcDay = (offset: number) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, 12));
const yesterday = utcDay(-1);
const tomorrow = utcDay(1);
const nextWeek = utcDay(7);
const later = utcDay(10);

function calendarRow() {
  return {
    id: 'cal-1',
    timezone: 'Asia/Amman',
    workingWeekdays: [0, 1, 2, 3, 4, 6],
    shiftStart: '08:00',
    shiftEnd: '16:00',
    breaks: [{ start: '12:00', end: '13:00' }],
    deliveryBufferWorkingDays: 1,
    isDefault: true,
  };
}

function makeService() {
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    scheduleAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    factoryCalendar: {
      findFirst: jest.fn().mockResolvedValue(calendarRow()),
      create: jest.fn(),
      update: jest.fn(),
    },
    factoryCalendarException: { findMany: jest.fn().mockResolvedValue([]) },
    productionStageDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    productionTask: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    inventoryItem: { findMany: jest.fn().mockResolvedValue([]) },
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryLot: { findMany: jest.fn().mockResolvedValue([]) },
    workerSkill: { findFirst: jest.fn() },
    productionSchedule: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    productionOrder: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    customer: { findMany: jest.fn().mockResolvedValue([]) },
    productionOrderWorkflowSnapshotNode: { findMany: jest.fn().mockResolvedValue([]) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    auditEvent: { create: jest.fn().mockResolvedValue(undefined) },
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
  return { service, prisma, queue };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    number: 'PO-2026-00059',
    status: 'READY_FOR_DELIVERY',
    requiredDeliveryDate: null,
    committedDeliveryDate: null,
    priority: 'NORMAL',
    customerId: 'c1',
    createdAt: yesterday,
    product: { id: 'prod-1', nameEn: 'Sofa', nameAr: 'كنبة', nameHe: null, imageUrl: null },
    salesOrder: { customer: { id: 'c1', name: 'Nile', nameEn: 'Nile Interiors', nameAr: 'النيل', nameHe: null } },
    ...overrides,
  };
}

function schedule(overrides: Record<string, unknown> = {}) {
  const productionOrder = (overrides.productionOrder as ReturnType<typeof order>) ?? order();
  return {
    id: 'sch-1',
    productionOrderId: productionOrder.id,
    version: 4,
    status: 'NEEDS_REVIEW',
    reason: 'WIP_NOT_READY',
    materialRisk: false,
    requiresAdminEstimateReview: false,
    requestedDeliveryDate: null,
    committedDeliveryDate: null,
    suggestedDeliveryDate: null,
    earliestAvailableDate: null,
    requestedDateFeasible: false,
    unschedulableReason: 'WIP_NOT_READY',
    planningMode: 'FORWARD',
    materialReadyAt: null,
    committedCompletionDate: null,
    productionOrder,
    ...overrides,
  };
}

describe('canonical at-risk list and dashboard', () => {
  it('counts unique incomplete POs and ignores superseded / completed rows', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findMany.mockResolvedValue([
      schedule({
        id: 'old',
        version: 3,
        status: 'NEEDS_REVIEW',
        unschedulableReason: 'WIP_NOT_READY',
        productionOrder: order({ id: 'po-clean', number: 'PO-1', status: 'IN_PROGRESS' }),
        productionOrderId: 'po-clean',
      }),
      schedule({
        id: 'latest',
        version: 5,
        status: 'APPROVED',
        unschedulableReason: null,
        requestedDateFeasible: true,
        suggestedDeliveryDate: nextWeek,
        earliestAvailableDate: tomorrow,
        committedDeliveryDate: nextWeek,
        productionOrder: order({
          id: 'po-clean',
          number: 'PO-1',
          status: 'IN_PROGRESS',
          committedDeliveryDate: nextWeek,
        }),
        productionOrderId: 'po-clean',
      }),
      schedule({
        productionOrderId: 'po-done',
        productionOrder: order({ id: 'po-done', number: 'PO-2', status: 'COMPLETED' }),
      }),
      schedule({
        productionOrderId: 'po-wip',
        productionOrder: order({ id: 'po-wip', number: 'PO-3', status: 'READY_FOR_DELIVERY' }),
      }),
      schedule({
        id: 'proposed',
        productionOrderId: 'po-wait',
        status: 'PROPOSED',
        unschedulableReason: null,
        requiresAdminEstimateReview: true,
        requestedDateFeasible: false,
        suggestedDeliveryDate: nextWeek,
        earliestAvailableDate: nextWeek,
        productionOrder: order({ id: 'po-wait', number: 'PO-4', status: 'IN_PROGRESS' }),
      }),
    ]);

    const list = await service.listAtRisk();
    const dash = await service.dashboardSummary();
    expect(list.data.map((row: { number: string }) => row.number)).toEqual(['PO-3']);
    expect(list.data[0]).toMatchObject({
      riskStatus: 'BLOCKED',
      reasonCode: 'WIP_NOT_READY',
      recoverableAutomatically: true,
      recommendedAction: 'VIEW_PRODUCTION',
    });
    expect(dash.atRisk).toBe(list.data.length);
    expect(dash.awaitingApproval).toBe(1);
    expect(dash.atRisk + dash.awaitingApproval).toBe(2);
  });

  it('does not put requested-infeasible uncommitted plans in May be late', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findMany.mockResolvedValue([
      schedule({
        status: 'PROPOSED',
        unschedulableReason: null,
        requiresAdminEstimateReview: true,
        requestedDeliveryDate: tomorrow,
        requestedDateFeasible: false,
        suggestedDeliveryDate: later,
        earliestAvailableDate: later,
        productionOrder: order({ status: 'IN_PROGRESS', requiredDeliveryDate: tomorrow }),
      }),
    ]);
    const list = await service.listAtRisk();
    const dash = await service.dashboardSummary();
    expect(list.data).toEqual([]);
    expect(dash.atRisk).toBe(0);
    expect(dash.awaitingApproval).toBe(1);
  });

  it('classifies committed-yesterday incomplete work as LATE', async () => {
    const { service, prisma } = makeService();
    prisma.productionSchedule.findMany.mockResolvedValue([
      schedule({
        status: 'APPROVED',
        unschedulableReason: null,
        requestedDateFeasible: true,
        committedDeliveryDate: yesterday,
        earliestAvailableDate: later,
        suggestedDeliveryDate: later,
        productionOrder: order({ status: 'IN_PROGRESS', committedDeliveryDate: yesterday }),
      }),
    ]);
    const list = await service.listAtRisk();
    expect(list.data[0]).toMatchObject({
      riskStatus: 'LATE',
      recommendedAction: 'REVIEW_COMMITMENT',
      recoverableAutomatically: false,
    });
  });
});

describe('resolve at-risk', () => {
  it('returns ALREADY_ON_TRACK without generating', async () => {
    const { service, prisma } = makeService();
    const po = order({ status: 'IN_PROGRESS', committedDeliveryDate: nextWeek });
    prisma.productionOrder.findUnique.mockResolvedValue(po);
    prisma.productionSchedule.findFirst.mockResolvedValue(
      schedule({
        status: 'APPROVED',
        unschedulableReason: null,
        committedDeliveryDate: nextWeek,
        earliestAvailableDate: tomorrow,
        suggestedDeliveryDate: tomorrow,
        productionOrder: po,
      }),
    );
    const generate = jest.spyOn(service, 'generateForProductionOrder');
    const result = await service.resolveAtRisk('po-1', { id: 'admin' });
    expect(result.action).toBe('ALREADY_ON_TRACK');
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not auto-resolve missing estimates', async () => {
    const { service, prisma } = makeService();
    const po = order({ status: 'PLANNED' });
    prisma.productionOrder.findUnique.mockResolvedValue(po);
    prisma.productionSchedule.findFirst.mockResolvedValue(
      schedule({
        status: 'NEEDS_REVIEW',
        unschedulableReason: null,
        requiresAdminEstimateReview: true,
        productionOrder: po,
      }),
    );
    const generate = jest.spyOn(service, 'generateForProductionOrder');
    const result = await service.resolveAtRisk('po-1', { id: 'admin' });
    expect(result.action).toBe('NEEDS_ADMIN');
    expect(result.recommendedAction).toBe('REVIEW_ESTIMATES');
    expect(result.resolvedAutomatically).toBe(false);
    expect(generate).not.toHaveBeenCalled();
  });

  it('replans a recoverable WIP block and can leave the set', async () => {
    const { service, prisma } = makeService();
    const po = order({ status: 'READY_FOR_DELIVERY' });
    const blocked = schedule({ productionOrder: po });
    const cleared = schedule({
      status: 'PROPOSED',
      unschedulableReason: null,
      suggestedDeliveryDate: nextWeek,
      earliestAvailableDate: nextWeek,
      requestedDateFeasible: true,
      productionOrder: po,
    });
    prisma.productionOrder.findUnique.mockResolvedValue(po);
    prisma.productionSchedule.findFirst
      .mockResolvedValueOnce(blocked)
      .mockResolvedValueOnce(cleared);
    jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);
    const result = await service.resolveAtRisk('po-1', { id: 'admin' });
    expect(result.resolvedAutomatically).toBe(true);
    expect(result.stillNeedsAttention).toBe(false);
    expect(result.riskStatus).toBe('AWAITING_APPROVAL');
  });

  it('keeps an impossible commitment and does not claim success', async () => {
    const { service, prisma } = makeService();
    const po = order({ status: 'IN_PROGRESS', committedDeliveryDate: nextWeek });
    const atRisk = schedule({
      status: 'APPROVED',
      unschedulableReason: null,
      committedDeliveryDate: nextWeek,
      earliestAvailableDate: later,
      suggestedDeliveryDate: later,
      productionOrder: po,
    });
    prisma.productionOrder.findUnique.mockResolvedValue(po);
    prisma.productionSchedule.findFirst.mockResolvedValue(atRisk);
    jest.spyOn(service, 'generateForProductionOrder').mockRejectedValue(
      new ConflictException({ code: 'WOULD_MISS_COMMITMENT', message: 'miss' }),
    );
    const result = await service.resolveAtRisk('po-1', { id: 'admin' });
    expect(result.resolvedAutomatically).toBe(false);
    expect(result.stillNeedsAttention).toBe(true);
    expect(result.action).toBe('COMMITMENT_INFEASIBLE');
    expect(result.earliestFeasibleDate).toEqual(later);
  });

  it('resolve-all only clears recoverable rows and matches remaining', async () => {
    const { service, prisma } = makeService();
    const wip = schedule({
      productionOrderId: 'po-wip',
      productionOrder: order({ id: 'po-wip', number: 'PO-W', status: 'READY_FOR_DELIVERY', priority: 'HIGH' }),
    });
    const estimates = schedule({
      id: 'est',
      productionOrderId: 'po-est',
      unschedulableReason: null,
      requiresAdminEstimateReview: true,
      productionOrder: order({ id: 'po-est', number: 'PO-E', status: 'PLANNED', priority: 'LOW' }),
    });
    prisma.productionSchedule.findMany.mockResolvedValue([wip, estimates]);
    prisma.productionOrder.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'po-wip' ? wip.productionOrder : estimates.productionOrder,
    );
    prisma.productionSchedule.findFirst.mockImplementation(async ({ where }: { where: { productionOrderId: string } }) =>
      where.productionOrderId === 'po-wip' ? wip : estimates,
    );
    jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async (poId: string) => {
      if (poId === 'po-wip') {
        Object.assign(wip, {
          status: 'PROPOSED',
          unschedulableReason: null,
          suggestedDeliveryDate: nextWeek,
          earliestAvailableDate: nextWeek,
        });
      }
      return {} as never;
    });

    const result = await service.resolveAllAtRisk({ id: 'admin' });
    expect(result.resolvedAutomatically).toBe(1);
    expect(result.stillNeedsAttention).toBe(1);
    expect(result.remaining).toBe(1);
    expect(result.results).toHaveLength(2);
  });
});

describe('automatic risk refresh', () => {
  it('onTaskLifecycle enqueues REPLAN for the latest active PROPOSED schedule', async () => {
    const { service, prisma, queue } = makeService();
    prisma.productionTask.findUnique.mockResolvedValue({
      id: 't1',
      productionOrderId: 'po-1',
      name: 'Upholstery',
      number: 'T-1',
    });
    prisma.productionSchedule.findFirst.mockResolvedValue({
      id: 'sch-1',
      productionOrderId: 'po-1',
      status: 'PROPOSED',
    });
    await service.onTaskLifecycle('t1', 'complete');
    expect(queue.enqueue).toHaveBeenCalledWith('REPLAN', {
      productionOrderId: 'po-1',
      taskId: 't1',
      event: 'complete',
    });
  });

  it('RISK_ANALYSIS replans only when the classifier says recoverable', async () => {
    const { service, prisma } = makeService();
    const po = order({ status: 'READY_FOR_DELIVERY' });
    prisma.productionOrder.findUnique.mockResolvedValue(po);
    prisma.productionSchedule.findFirst.mockResolvedValue(schedule({ productionOrder: po }));
    const generate = jest.spyOn(service, 'generateForProductionOrder').mockResolvedValue({} as never);
    await (service as any).processSchedulingJob('RISK_ANALYSIS', { productionOrderId: 'po-1' });
    expect(generate).toHaveBeenCalledWith(
      'po-1',
      'system',
      expect.objectContaining({ reason: 'async:RISK_ANALYSIS' }),
    );

    generate.mockClear();
    prisma.productionSchedule.findFirst.mockResolvedValue(
      schedule({
        status: 'NEEDS_REVIEW',
        unschedulableReason: null,
        requiresAdminEstimateReview: true,
        productionOrder: order({ status: 'PLANNED' }),
      }),
    );
    prisma.productionOrder.findUnique.mockResolvedValue(order({ status: 'PLANNED' }));
    await (service as any).processSchedulingJob('RISK_ANALYSIS', { productionOrderId: 'po-1' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('after a REPLAN job the list and dashboard use the new classification', async () => {
    const { service, prisma } = makeService();
    const po = order({ id: 'po-1', status: 'READY_FOR_DELIVERY' });
    const row = schedule({ productionOrder: po, productionOrderId: 'po-1' });
    prisma.productionSchedule.findMany.mockResolvedValue([row]);
    expect((await service.listAtRisk()).data).toHaveLength(1);

    jest.spyOn(service, 'generateForProductionOrder').mockImplementation(async () => {
      Object.assign(row, {
        status: 'PROPOSED',
        unschedulableReason: null,
        suggestedDeliveryDate: nextWeek,
        earliestAvailableDate: nextWeek,
      });
      return {} as never;
    });
    await (service as any).processSchedulingJob('REPLAN', { productionOrderId: 'po-1', event: 'complete' });
    const list = await service.listAtRisk();
    const dash = await service.dashboardSummary();
    expect(list.data).toHaveLength(0);
    expect(dash.atRisk).toBe(0);
    expect(dash.awaitingApproval).toBe(1);
  });
});
