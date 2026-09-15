import { InvoiceStatus, PurchaseOrderStatus } from '@maher/database';
import { OpsJobsWorker } from './ops-jobs.worker';
import { OpsNotifyService } from './ops-notify.service';

describe('OpsJobsWorker', () => {
  function make(opts?: {
    invoices?: Array<Record<string, unknown>>;
    pos?: Array<Record<string, unknown>>;
    tasks?: Array<Record<string, unknown>>;
  }) {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue(opts?.invoices ?? []),
        update: jest.fn().mockResolvedValue({}),
      },
      purchaseOrder: {
        findMany: jest.fn().mockResolvedValue(opts?.pos ?? []),
      },
      productionTask: {
        findMany: jest.fn().mockResolvedValue(opts?.tasks ?? []),
      },
      productionSchedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      scheduleAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      factoryCalendar: {
        findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Amman' }),
      },
    };
    const ops = {
      onInvoice: jest.fn().mockResolvedValue(undefined),
      onPurchaseOrder: jest.fn().mockResolvedValue(undefined),
      onTaskScheduledToday: jest.fn().mockResolvedValue(undefined),
      onScheduleAtRisk: jest.fn().mockResolvedValue(undefined),
      onScheduleConflict: jest.fn().mockResolvedValue(undefined),
    };
    const worker = new OpsJobsWorker(prisma as never, ops as unknown as OpsNotifyService);
    return { worker, prisma, ops };
  }

  it('marks unpaid issued invoices overdue once per due date and skips paid', async () => {
    const due = new Date('2026-08-01T00:00:00.000Z');
    const invoices = [
      {
        id: 'inv-open',
        number: 'INV-42',
        customerId: 'cust-1',
        status: InvoiceStatus.ISSUED,
        outstandingAmount: 90,
        dueDate: due,
      },
      {
        id: 'inv-paid',
        number: 'INV-99',
        customerId: 'cust-1',
        status: InvoiceStatus.PAID,
        outstandingAmount: 0,
        dueDate: due,
      },
    ];
    const { worker, prisma, ops } = make({ invoices });
    prisma.invoice.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { status: InvoiceStatus } }) => {
      const row = invoices.find((i) => i.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    });
    const asOf = new Date('2026-09-14T00:00:00+03:00');
    await worker.markOverdueInvoices(asOf);
    await worker.markOverdueInvoices(asOf);
    expect(prisma.invoice.update).toHaveBeenCalledTimes(1);
    expect(ops.onInvoice).toHaveBeenCalledTimes(2);
    expect(ops.onInvoice.mock.calls[0][0].transition).toBe('OVERDUE:2026-08-01');
    expect(ops.onInvoice.mock.calls[0][0].id).toBe('inv-open');
    expect(ops.onInvoice.mock.calls.map((c: [{ id: string }]) => c[0].id)).not.toContain('inv-paid');
  });

  it('emits po.late only for open POs past expected date', async () => {
    const { worker, ops } = make({
      pos: [
        {
          id: 'po-late',
          number: 'PORD-0142',
          status: PurchaseOrderStatus.SENT,
          expectedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          id: 'po-received',
          number: 'PORD-9',
          status: PurchaseOrderStatus.RECEIVED,
          expectedDeliveryDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      ],
    });
    await worker.emitLatePurchaseOrders(new Date('2026-09-14T00:00:00+03:00'));
    expect(ops.onPurchaseOrder).toHaveBeenCalledTimes(1);
    expect(ops.onPurchaseOrder.mock.calls[0][0]).toMatchObject({
      topic: 'po.late',
      id: 'po-late',
      transition: 'LATE:2026-09-01',
    });
  });

  it('schedules today once per assigned open task/day', async () => {
    const { worker, ops } = make({
      tasks: [
        {
          id: 't-1',
          name: 'Upholstery',
          status: 'READY',
          plannedStart: new Date('2026-09-14T08:00:00+03:00'),
          assignedEmployeeId: 'worker-1',
          productionOrder: { number: 'PO-1', salesOrder: { number: 'SO-1042' } },
        },
        {
          id: 't-done',
          name: 'Done',
          status: 'COMPLETED',
          plannedStart: new Date('2026-09-14T08:00:00+03:00'),
          assignedEmployeeId: 'worker-1',
          productionOrder: { number: 'PO-2', salesOrder: { number: 'SO-2' } },
        },
      ],
    });
    await worker.emitScheduledToday('2026-09-14', 'Asia/Amman');
    await worker.emitScheduledToday('2026-09-14', 'Asia/Amman');
    expect(ops.onTaskScheduledToday).toHaveBeenCalledTimes(2);
    expect(ops.onTaskScheduledToday.mock.calls[0][0]).toMatchObject({
      taskId: 't-1',
      employeeId: 'worker-1',
      dayYmd: '2026-09-14',
    });
    expect(ops.onTaskScheduledToday.mock.calls.map((c: [{ taskId: string }]) => c[0].taskId)).not.toContain(
      't-done',
    );
  });
});
