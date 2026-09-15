import { FloorHandoffService } from './floor-handoff.service';
import { notificationEventId } from '@maher/notifications';
import type { PipelineHandoffFacts } from '../production/pipeline-handoff';

function facts(over: Partial<PipelineHandoffFacts> = {}): PipelineHandoffFacts {
  return {
    productionOrderId: 'po-1',
    newlyReadyTasks: [],
    completedStage: null,
    packagingStageCompleted: false,
    poBecameReadyForDelivery: false,
    soBecameReadyForDelivery: false,
    salesOrderId: 'so-1',
    deliveryId: null,
    ...over,
  };
}

describe('FloorHandoffService', () => {
  function make(poStatus = 'IN_PROGRESS', soStatus = 'IN_PRODUCTION') {
    const emit = jest.fn().mockResolvedValue({ ok: true, count: 1 });
    const prisma = {
      productionOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'po-1',
          number: 'PO-1',
          status: poStatus,
          productDescription: 'Model 204',
          product: { nameEn: 'Model 204', sku: '204' },
          salesOrder: {
            id: 'so-1',
            number: 'SO-1042',
            status: soStatus,
            customerId: 'cust-1',
            lines: [{ description: 'Model 204', product: { nameEn: 'Model 204' } }],
          },
        }),
      },
      productionTask: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new FloorHandoffService(prisma as never, { emit } as never);
    return { svc, emit, prisma };
  }

  it('notifies the assigned next worker once for task.ready', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-uph',
            assignedEmployeeId: 'worker-b',
            statusFrom: 'NOT_STARTED',
            stageCode: 'UPHOLSTERY',
            stageNameEn: 'Upholstery',
            executionKind: 'PRODUCTION',
            isRework: false,
          },
        ],
      }),
      { actorUserId: 'worker-a' },
    );
    const ready = emit.mock.calls.filter((c: [{ topic: string }]) => c[0].topic === 'task.ready');
    expect(ready).toHaveLength(1);
    expect(ready[0][0].recipientUserIds).toEqual(['worker-b']);
    expect(ready[0][0].linkUrl).toBe('/tasks/t-uph');
    expect(ready[0][0].eventId).toBe(
      notificationEventId({
        topic: 'task.ready',
        entityType: 'task',
        entityId: 't-uph',
        transition: 'NOT_STARTED→READY',
      }),
    );
    expect(ready[0][0].vars.number).toBe('SO-1042');
  });

  it('does not emit task.ready when the join is not yet ready', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(facts({ newlyReadyTasks: [] }), { actorUserId: 'worker-a' });
    expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ topic: 'task.ready' }));
  });

  it('unassigned READY does not skill-fan-out workers', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-open',
            assignedEmployeeId: null,
            statusFrom: 'NOT_STARTED',
            stageCode: 'CARPENTRY',
            stageNameEn: 'Carpentry',
            executionKind: 'PRODUCTION',
            isRework: false,
          },
        ],
      }),
    );
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual([]);
  });

  it('emits quality.queued not task.ready for inspection', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-qc',
            assignedEmployeeId: 'inspector',
            statusFrom: 'NOT_STARTED',
            stageCode: 'INSPECTION',
            stageNameEn: 'Inspection',
            executionKind: 'QUALITY',
            isRework: false,
          },
        ],
      }),
    );
    expect(emit.mock.calls.map((c: [{ topic: string }]) => c[0].topic)).toEqual(['quality.queued']);
  });

  it('emits packaging.ready when packaging becomes executable', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-pack',
            assignedEmployeeId: 'packer',
            statusFrom: 'NOT_STARTED',
            stageCode: 'PACKAGING',
            stageNameEn: 'Packaging',
            executionKind: 'PRODUCTION',
            isRework: false,
          },
        ],
      }),
    );
    expect(emit.mock.calls[0][0].topic).toBe('packaging.ready');
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual(['packer']);
  });

  it('emits packaging.completed and order.readyForDelivery from canonical rollup', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(
      facts({
        packagingStageCompleted: true,
        soBecameReadyForDelivery: true,
        deliveryId: 'del-1',
      }),
    );
    const topics = emit.mock.calls.map((c: [{ topic: string }]) => c[0].topic);
    expect(topics).toContain('packaging.completed');
    expect(topics).toContain('order.readyForDelivery');
    expect(topics).toContain('delivery.readyToLoad');
  });

  it('skips handoff emits when the sales order is cancelled', async () => {
    const { svc, emit } = make('CANCELLED', 'CANCELLED');
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-uph',
            assignedEmployeeId: 'worker-b',
            statusFrom: 'NOT_STARTED',
            stageCode: 'UPHOLSTERY',
            stageNameEn: 'Upholstery',
            executionKind: 'PRODUCTION',
            isRework: false,
          },
        ],
      }),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('hold copy never includes the internal reason', async () => {
    const { svc, emit } = make();
    await svc.onOrderHold({
      salesOrderId: 'so-1',
      number: 'SO-1042',
      customerId: 'cust-1',
      actorUserId: 'admin-1',
      workerUserIds: ['worker-b'],
    });
    const payload = emit.mock.calls[0][0];
    expect(payload.topic).toBe('order.onHold');
    expect(payload.vars).toEqual({ number: 'SO-1042' });
    expect(JSON.stringify(payload)).not.toMatch(/margin|cost|reason/i);
    expect(payload.customerId).toBe('cust-1');
    expect(payload.recipientUserIds).toEqual(['worker-b']);
  });

  it('same READY transition is idempotent via eventId', async () => {
    const { svc, emit } = make();
    const once = facts({
      newlyReadyTasks: [
        {
          id: 't-uph',
          assignedEmployeeId: 'worker-b',
          statusFrom: 'NOT_STARTED',
          stageCode: 'UPHOLSTERY',
          stageNameEn: 'Upholstery',
          executionKind: 'PRODUCTION',
          isRework: false,
        },
      ],
    });
    await svc.emitPipeline(once);
    await svc.emitPipeline(once);
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
  });

  it('skips next-stage notify while the sales order is on hold', async () => {
    const { svc, emit } = make('IN_PROGRESS', 'ON_HOLD');
    await svc.emitPipeline(
      facts({
        newlyReadyTasks: [
          {
            id: 't-uph',
            assignedEmployeeId: 'worker-b',
            statusFrom: 'NOT_STARTED',
            stageCode: 'UPHOLSTERY',
            stageNameEn: 'Upholstery',
            executionKind: 'PRODUCTION',
            isRework: false,
          },
        ],
      }),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits order.resumed without internal notes', async () => {
    const { svc, emit } = make();
    await svc.onOrderResumed({
      salesOrderId: 'so-1',
      number: 'SO-1042',
      customerId: 'cust-1',
      actorUserId: 'admin-1',
      workerUserIds: ['worker-b'],
      occurredAt: new Date('2026-09-14T10:00:00.000Z'),
    });
    expect(emit.mock.calls[0][0].topic).toBe('order.resumed');
    expect(emit.mock.calls[0][0].vars).toEqual({ number: 'SO-1042' });
    expect(JSON.stringify(emit.mock.calls[0][0])).not.toMatch(/reason|margin|cost/i);
  });

  it('emits order.cancelled to workers collected before cancel', async () => {
    const { svc, emit } = make();
    await svc.onOrderCancelled({
      salesOrderId: 'so-1',
      number: 'SO-1042',
      customerId: 'cust-1',
      actorUserId: 'admin-1',
      workerUserIds: ['worker-b'],
    });
    expect(emit.mock.calls[0][0].topic).toBe('order.cancelled');
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual(['worker-b']);
    expect(emit.mock.calls[0][0].eventId).toBe(
      notificationEventId({
        topic: 'order.cancelled',
        entityType: 'salesOrder',
        entityId: 'so-1',
        transition: 'CANCELLED',
      }),
    );
  });

  it('emits quality.passed and does not invent a packaging hop', async () => {
    const { svc, emit } = make();
    await svc.onQualityPassed({
      inspectionId: 'qc-1',
      productionOrderId: 'po-1',
      number: 'SO-1042',
      actorUserId: 'inspector',
      customerId: 'cust-1',
      salesOrderId: 'so-1',
      packagingTaskId: null,
    });
    expect(emit.mock.calls[0][0].topic).toBe('quality.passed');
    expect(emit.mock.calls[0][0].linkUrl).toBe('/sales-orders/so-1');
    expect(JSON.stringify(emit.mock.calls[0][0])).not.toMatch(/defect|note|blame/i);
  });

  it('emits quality.failed with worker-safe copy only', async () => {
    const { svc, emit } = make();
    await svc.onQualityFailed({
      inspectionId: 'qc-1',
      productionOrderId: 'po-1',
      number: 'SO-1042',
      actorUserId: 'inspector',
      skipReworkRequired: true,
    });
    const payload = emit.mock.calls[0][0];
    expect(payload.topic).toBe('quality.failed');
    expect(payload.vars).toEqual({ number: 'SO-1042' });
    expect(JSON.stringify(payload)).not.toMatch(/stitch|defect|margin|worker/i);
  });

  it('emits quality.reworkRequired to the assigned rework worker', async () => {
    const { svc, emit } = make();
    await svc.onReworkTaskReady({
      taskId: 't-rework',
      assignedEmployeeId: 'worker-a',
      stageNameEn: 'Upholstery',
      number: 'SO-1042',
      inspectionId: 'qc-1',
      actorUserId: 'inspector',
      customerId: 'cust-1',
    });
    expect(emit.mock.calls[0][0].topic).toBe('quality.reworkRequired');
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual(['worker-a']);
    expect(emit.mock.calls[0][0].linkUrl).toBe('/tasks/t-rework');
  });

  it('emits quality.reworkReady to assigned inspectors', async () => {
    const { svc, emit } = make();
    await svc.onReworkReadyToInspect({
      inspectionId: 'qc-1',
      productionOrderId: 'po-1',
      number: 'SO-1042',
      actorUserId: 'worker-a',
      inspectionTaskId: 't-qc',
      inspectorIds: ['inspector'],
      reworkId: 'rw-1',
    });
    expect(emit.mock.calls[0][0].topic).toBe('quality.reworkReady');
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual(['inspector']);
    expect(emit.mock.calls[0][0].linkUrl).toBe('/tasks/t-qc');
    expect(emit.mock.calls[0][0].eventId).toBe(
      notificationEventId({
        topic: 'quality.reworkReady',
        entityType: 'qualityInspection',
        entityId: 'qc-1',
        transition: 'REINSPECT:rw-1',
      }),
    );
  });

  it('does not emit order.readyForDelivery unless rollup says the SO became ready', async () => {
    const { svc, emit } = make();
    await svc.emitPipeline(facts({ packagingStageCompleted: true, soBecameReadyForDelivery: false }));
    const topics = emit.mock.calls.map((c: [{ topic: string }]) => c[0].topic);
    expect(topics).toContain('packaging.completed');
    expect(topics).not.toContain('order.readyForDelivery');
    expect(topics).not.toContain('delivery.readyToLoad');
  });

  it('task.completed is staff-facing with no assigned-worker extras', async () => {
    const { svc, emit } = make();
    await svc.onTaskLifecycle({
      topic: 'task.completed',
      taskId: 't-carp',
      taskName: 'Carpentry',
      number: 'SO-1042',
      actorUserId: 'worker-a',
    });
    expect(emit.mock.calls[0][0].recipientUserIds).toBeUndefined();
    expect(emit.mock.calls[0][0].excludeActor).toBe(true);
  });
});
