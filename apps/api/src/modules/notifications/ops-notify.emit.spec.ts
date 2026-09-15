import { notificationEventId } from '@maher/notifications';
import { OpsNotifyService } from './ops-notify.service';

describe('OpsNotifyService', () => {
  function make() {
    const emit = jest.fn().mockResolvedValue({ ok: true, count: 1 });
    const prisma = {
      fabricProcurement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'fp-1',
          state: 'READY_FOR_PICKUP',
          salesOrderId: 'so-1',
          salesOrder: { number: 'SO-1042' },
          productionOrderId: 'po-1',
          productionOrder: { id: 'po-1', number: 'PO-1' },
          requirement: {
            requestedFabricLabel: 'Velvet 302',
            displayName: 'Velvet 302',
            sku: 'FAB-VEL',
            inventoryItem: { sku: 'FAB-VEL', nameEn: 'Velvet 302' },
          },
        }),
      },
      productionTask: {
        findMany: jest.fn().mockResolvedValue([{ assignedEmployeeId: 'worker-1' }]),
      },
      salesOrder: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'WAITING_FOR_MATERIALS',
          updatedAt: new Date('2026-09-14T08:00:00.000Z'),
        }),
      },
    };
    const svc = new OpsNotifyService(prisma as never, { emit } as never);
    return { svc, emit };
  }

  it('uses a stable eventId for the same PO transition', async () => {
    const { svc, emit } = make();
    await svc.onPurchaseOrder({
      topic: 'po.late',
      id: 'po-1',
      number: 'PORD-0142',
      transition: 'LATE:2026-09-01',
    });
    await svc.onPurchaseOrder({
      topic: 'po.late',
      id: 'po-1',
      number: 'PORD-0142',
      transition: 'LATE:2026-09-01',
    });
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].eventId).toBe(
      notificationEventId({
        topic: 'po.late',
        entityType: 'purchaseOrder',
        entityId: 'po-1',
        transition: 'LATE:2026-09-01',
      }),
    );
    expect(emit.mock.calls[0][0].vars).not.toHaveProperty('price');
    expect(JSON.stringify(emit.mock.calls[0][0])).not.toMatch(/bank|unitCost|margin/i);
  });

  it('does not spam low stock while the same crossing identity is retried', async () => {
    const { svc, emit } = make();
    const cross = { itemId: 'item-1', sku: 'OAK-22', before: 12, after: 4, minStock: 5 };
    await svc.onLowStockCross(cross);
    await svc.onLowStockCross(cross);
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].linkUrl).toBe('/inventory/low-stock');
    expect(emit.mock.calls[0][0].vars.sku).toBe('OAK-22');
  });

  it('uses a new eventId when stock recovers and later drops again', async () => {
    const { svc, emit } = make();
    await svc.onLowStockCross({ itemId: 'item-1', sku: 'OAK-22', before: 12, after: 4, minStock: 5 });
    await svc.onLowStockCross({ itemId: 'item-1', sku: 'OAK-22', before: 9, after: 2, minStock: 5 });
    expect(emit.mock.calls[0][0].eventId).not.toBe(emit.mock.calls[1][0].eventId);
  });

  it('keeps invoice overdue idempotent per due date', async () => {
    const { svc, emit } = make();
    await svc.onInvoice({
      topic: 'invoice.overdue',
      id: 'inv-1',
      number: 'INV-42',
      customerId: 'cust-1',
      transition: 'OVERDUE:2026-08-01',
    });
    await svc.onInvoice({
      topic: 'invoice.overdue',
      id: 'inv-1',
      number: 'INV-42',
      customerId: 'cust-1',
      transition: 'OVERDUE:2026-08-01',
    });
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].customerId).toBe('cust-1');
    expect(JSON.stringify(emit.mock.calls[0][0].vars)).not.toMatch(/amount|total|cost/i);
  });

  it('schedules today once per task/day for the assigned worker only', async () => {
    const { svc, emit } = make();
    await svc.onTaskScheduledToday({
      taskId: 't-1',
      taskName: 'Upholstery',
      number: 'SO-1042',
      employeeId: 'worker-1',
      dayYmd: '2026-09-14',
    });
    await svc.onTaskScheduledToday({
      taskId: 't-1',
      taskName: 'Upholstery',
      number: 'SO-1042',
      employeeId: 'worker-1',
      dayYmd: '2026-09-14',
    });
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].recipientUserIds).toEqual(['worker-1']);
    expect(emit.mock.calls[0][0].linkUrl).toBe('/tasks/t-1');
  });

  it('keeps fabric copy scoped to SO + fabric name without supplier price', async () => {
    const { svc, emit } = make();
    await svc.onFabric({ id: 'fp-1', eventKind: 'RECEIVED', state: 'READY_FOR_PICKUP' });
    const topics = emit.mock.calls.map((c: [{ topic: string }]) => c[0].topic);
    expect(topics).toEqual(expect.arrayContaining(['fabric.arrived', 'fabric.readyForPickup']));
    for (const call of emit.mock.calls) {
      expect(call[0].vars.number).toBe('SO-1042');
      expect(call[0].vars.sku).toBe('Velvet 302');
      expect(call[0].linkUrl).toBe('/purchasing/fabric/fp-1');
      expect(JSON.stringify(call[0])).not.toMatch(/price|supplier|cost/i);
    }
    const ready = emit.mock.calls.find((c: [{ topic: string }]) => c[0].topic === 'fabric.readyForPickup');
    expect(ready[0].recipientUserIds).toEqual(['worker-1']);
    expect(ready[0].excludeActor).toBe(false);
  });

  it('keeps schedule.atRisk idempotent per production order, not per schedule version', async () => {
    const { svc, emit } = make();
    await svc.onScheduleAtRisk({
      productionOrderId: 'po-1',
      number: 'SO-1042',
      scheduleId: 'sched-v1',
    });
    await svc.onScheduleAtRisk({
      productionOrderId: 'po-1',
      number: 'SO-1042',
      scheduleId: 'sched-v2',
    });
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].eventId).toBe(
      notificationEventId({
        topic: 'schedule.atRisk',
        entityType: 'schedule',
        entityId: 'po-1',
        transition: 'AT_RISK',
      }),
    );
    expect(emit.mock.calls[0][0].linkUrl).toBe('/scheduling');
  });

  it('notifies return cases once per template without recovery internals', async () => {
    const { svc, emit } = make();
    await svc.onReturnCase({
      templateCode: 'RETURN_DECISION',
      id: 'ret-1',
      number: 'RET-9',
      customerId: 'cust-1',
    });
    await svc.onReturnCase({
      templateCode: 'RETURN_DECISION',
      id: 'ret-1',
      number: 'RET-9',
      customerId: 'cust-1',
    });
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].topic).toBe('return.decision');
    expect(JSON.stringify(emit.mock.calls[0][0])).not.toMatch(/SCRAP_RECOVERY|factoryShare|chargeAmount/i);
  });

  it('opens GRN on the live receive route', async () => {
    const { svc, emit } = make();
    await svc.onGoodsReceipt({ id: 'grn-1', number: 'GRN-1', purchaseOrderId: 'po-1' });
    expect(emit.mock.calls[0][0].linkUrl).toBe('/inventory/receive/grn-1');
  });

  it('binds production shortage to the persisted WAITING_FOR_MATERIALS row', async () => {
    const { svc, emit } = make();
    await svc.onShortageBlockingProduction({
      salesOrderId: 'so-1',
      number: 'SO-1042',
    });
    await svc.onShortageBlockingProduction({
      salesOrderId: 'so-1',
      number: 'SO-1042',
    });
    expect(emit.mock.calls[0][0].eventId).toBe(emit.mock.calls[1][0].eventId);
    expect(emit.mock.calls[0][0].eventId).toBe(
      notificationEventId({
        topic: 'inventory.shortageBlockingProduction',
        entityType: 'salesOrder',
        entityId: 'so-1',
        transition: 'ENTER:2026-09-14T08:00:00.000Z',
      }),
    );
    expect(emit.mock.calls[0][0].customerId).toBeUndefined();
  });
});
