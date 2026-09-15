import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InvoiceStatus, PurchaseOrderStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_FACTORY_TIMEZONE } from '../scheduling/domain/dealer-request-lead';
import { detectConflicts, type ConflictAllocationInput } from '../scheduling/domain/conflict-detector';
import { ymdInTimezone } from '../scheduling/domain/factory-replan';
import { zonedLocalToUtc } from '../scheduling/domain/working-calendar';
import {
  invoiceIsOverdueCandidate,
  purchaseOrderIsLate,
  taskIsEligibleScheduledToday,
} from './ops-notify.classify';
import { OpsNotifyService } from './ops-notify.service';

const TICK_MS = 15 * 60 * 1000;

@Injectable()
export class OpsJobsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpsJobsWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsNotifyService,
  ) {}

  onModuleInit() {
    if (!jobsEnabled()) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tz = await this.factoryTimezone();
      const now = new Date();
      const todayYmd = ymdInTimezone(now, tz);
      const startOfToday = startOfLocalDay(todayYmd, tz);
      await this.markOverdueInvoices(startOfToday);
      await this.emitLatePurchaseOrders(startOfToday);
      await this.emitScheduledToday(todayYmd, tz);
      await this.emitAtRiskSchedules();
      await this.emitOpenConflicts();
    } catch (err) {
      this.logger.warn(`Ops notify jobs failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  async markOverdueInvoices(asOf: Date) {
    const rows = await this.prisma.invoice.findMany({
      where: {
        archivedAt: null,
        outstandingAmount: { gt: 0 },
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID, InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
        dueDate: { lt: asOf },
      },
      select: { id: true, number: true, customerId: true, status: true, outstandingAmount: true, dueDate: true },
      take: 200,
    });
    for (const row of rows) {
      if (
        !invoiceIsOverdueCandidate({
          status: row.status,
          outstandingAmount: Number(row.outstandingAmount),
          dueDate: row.dueDate,
          now: asOf,
        })
      ) {
        continue;
      }
      if (row.status !== InvoiceStatus.OVERDUE) {
        await this.prisma.invoice.update({
          where: { id: row.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
      }
      const dueKey = row.dueDate ? row.dueDate.toISOString().slice(0, 10) : 'none';
      await this.ops.onInvoice({
        topic: 'invoice.overdue',
        id: row.id,
        number: row.number,
        customerId: row.customerId,
        transition: `OVERDUE:${dueKey}`,
      });
    }
  }

  async emitLatePurchaseOrders(asOf: Date) {
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
        expectedDeliveryDate: { lt: asOf },
      },
      select: { id: true, number: true, status: true, expectedDeliveryDate: true },
      take: 200,
    });
    for (const row of rows) {
      if (
        !purchaseOrderIsLate({
          status: row.status,
          expectedDeliveryDate: row.expectedDeliveryDate,
          now: asOf,
        })
      ) {
        continue;
      }
      const expectedKey = row.expectedDeliveryDate
        ? row.expectedDeliveryDate.toISOString().slice(0, 10)
        : 'none';
      await this.ops.onPurchaseOrder({
        topic: 'po.late',
        id: row.id,
        number: row.number,
        transition: `LATE:${expectedKey}`,
      });
    }
  }

  async emitScheduledToday(todayYmd: string, tz: string) {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        assignedEmployeeId: { not: null },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        plannedStart: { not: null },
      },
      select: {
        id: true,
        name: true,
        status: true,
        plannedStart: true,
        assignedEmployeeId: true,
        productionOrder: {
          select: { number: true, salesOrder: { select: { number: true } } },
        },
      },
      take: 500,
    });
    for (const task of tasks) {
      if (
        !taskIsEligibleScheduledToday({
          status: task.status,
          assignedEmployeeId: task.assignedEmployeeId,
          plannedStart: task.plannedStart,
          todayYmd,
          timezoneYmd: ymdInTimezone,
          timeZone: tz,
        })
      ) {
        continue;
      }
      const number = task.productionOrder.salesOrder?.number ?? task.productionOrder.number;
      await this.ops.onTaskScheduledToday({
        taskId: task.id,
        taskName: task.name,
        number,
        employeeId: task.assignedEmployeeId!,
        dayYmd: todayYmd,
      });
    }
  }

  async emitAtRiskSchedules() {
    const rows = await this.prisma.productionSchedule.findMany({
      where: {
        status: { in: ['APPROVED', 'PROPOSED', 'NEEDS_REVIEW'] },
        OR: [{ promiseState: 'AT_RISK' }, { materialRisk: true }],
        productionOrder: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      },
      orderBy: { version: 'desc' },
      distinct: ['productionOrderId'],
      select: {
        id: true,
        productionOrderId: true,
        productionOrder: { select: { number: true, salesOrder: { select: { number: true } } } },
      },
      take: 200,
    });
    for (const row of rows) {
      const number = row.productionOrder.salesOrder?.number ?? row.productionOrder.number;
      await this.ops.onScheduleAtRisk({
        productionOrderId: row.productionOrderId,
        number,
        scheduleId: row.id,
      });
    }
  }

  async emitOpenConflicts() {
    const rows = await this.prisma.scheduleAllocation.findMany({
      where: {
        plannedEnd: { gte: new Date() },
        schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, isActive: true } },
        schedule: {
          select: {
            id: true,
            version: true,
            status: true,
            productionOrderId: true,
            requestedDeliveryDate: true,
            committedDeliveryDate: true,
            productionOrder: {
              select: {
                id: true,
                number: true,
                priority: true,
                customerId: true,
                createdAt: true,
                requiredDeliveryDate: true,
                committedDeliveryDate: true,
                product: { select: { nameEn: true } },
              },
            },
          },
        },
        productionTask: {
          select: {
            id: true,
            name: true,
            status: true,
            stageDefinitionId: true,
            stageDefinition: { select: { id: true, nameEn: true, code: true } },
          },
        },
      },
      take: 800,
    });
    const inputs: ConflictAllocationInput[] = rows.map((a) => {
      const order = a.schedule.productionOrder;
      return {
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}`.trim() : null,
        employeeActive: a.employee?.isActive ?? null,
        resourceSlot: a.resourceSlot,
        plannedStart: a.plannedStart,
        plannedEnd: a.plannedEnd,
        estimatedMinutes: Number(a.estimatedMinutes),
        isPinned: a.isPinned,
        manuallyAdjusted: a.manuallyAdjusted,
        productionOrderId: a.schedule.productionOrderId,
        scheduleId: a.schedule.id,
        scheduleVersion: a.schedule.version,
        scheduleStatus: a.schedule.status,
        productionTaskId: a.productionTaskId,
        taskStatus: a.productionTask?.status ?? null,
        taskName: a.productionTask?.name ?? null,
        stageDefinitionId: a.productionTask?.stageDefinitionId ?? a.productionTask?.stageDefinition?.id ?? null,
        stageName: a.productionTask?.stageDefinition?.nameEn ?? a.productionTask?.name ?? null,
        stageCode: a.productionTask?.stageDefinition?.code ?? null,
        orderNumber: order?.number ?? '',
        productName: order?.product?.nameEn ?? null,
        priority: order?.priority ?? 'NORMAL',
        requestedDeliveryDate: a.schedule.requestedDeliveryDate ?? order?.requiredDeliveryDate ?? null,
        committedDeliveryDate: a.schedule.committedDeliveryDate ?? order?.committedDeliveryDate ?? null,
        customerId: order?.customerId ?? a.schedule.productionOrderId,
        createdAt: order?.createdAt ?? a.plannedStart,
      };
    });
    const conflicts = detectConflicts(inputs, new Date());
    for (const conflict of conflicts) {
      const number = conflict.allocationA.orderNumber || conflict.allocationB.orderNumber;
      await this.ops.onScheduleConflict({
        conflictId: conflict.conflictId,
        number,
      });
    }
  }

  private async factoryTimezone(): Promise<string> {
    const row = await this.prisma.factoryCalendar.findFirst({
      where: { isDefault: true },
      select: { timezone: true },
    });
    return row?.timezone?.trim() || DEFAULT_FACTORY_TIMEZONE;
  }
}

function jobsEnabled(): boolean {
  if (process.env.OPS_NOTIFY_JOBS === '0') return false;
  if (process.env.JEST_WORKER_ID) return false;
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

function startOfLocalDay(ymd: string, timeZone: string): Date {
  const parts = ymd.split('-').map((part) => Number(part));
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return zonedLocalToUtc(year, month, day, 0, 0, 0, timeZone);
}
