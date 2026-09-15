import { Injectable, Logger } from '@nestjs/common';
import { notificationEventId } from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  fabricTopicForEventKind,
  fabricTopicForState,
  inventoryTopicForTxType,
  returnTopicFromTemplate,
  type LowStockCross,
} from './ops-notify.classify';

type EmitInput = {
  topic: string;
  eventId: string;
  actorUserId?: string | null;
  excludeActor?: boolean;
  entity: { type: string; id: string; number?: string };
  vars?: Record<string, string | number | null | undefined>;
  linkUrl: string;
  customerId?: string | null;
  recipientUserIds?: string[];
};

@Injectable()
export class OpsNotifyService {
  private readonly logger = new Logger(OpsNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async onPurchaseRequest(input: {
    topic: 'pr.created' | 'pr.approved';
    id: string;
    number: string;
    actorUserId?: string | null;
    requesterUserId?: string | null;
  }) {
    const extras = input.requesterUserId && input.topic === 'pr.approved' ? [input.requesterUserId] : [];
    await this.emit({
      topic: input.topic,
      eventId: notificationEventId({
        topic: input.topic,
        entityType: 'purchaseRequest',
        entityId: input.id,
        transition: input.topic === 'pr.created' ? 'SUBMITTED' : 'APPROVED',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'purchaseRequest', id: input.id, number: input.number },
      vars: { number: input.number },
      linkUrl: '/purchasing',
      recipientUserIds: extras,
    });
  }

  async onPurchaseOrder(input: {
    topic: 'po.approved' | 'po.sent' | 'po.partial' | 'po.received' | 'po.cancelled' | 'po.late';
    id: string;
    number: string;
    actorUserId?: string | null;
    transition?: string;
  }) {
    await this.emit({
      topic: input.topic,
      eventId: notificationEventId({
        topic: input.topic,
        entityType: 'purchaseOrder',
        entityId: input.id,
        transition: input.transition ?? input.topic,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'purchaseOrder', id: input.id, number: input.number },
      vars: { number: input.number },
      linkUrl: `/purchasing/${input.id}`,
    });
  }

  async onGoodsReceipt(input: {
    id: string;
    number: string;
    purchaseOrderId: string;
    actorUserId?: string | null;
  }) {
    await this.emit({
      topic: 'grn.posted',
      eventId: notificationEventId({
        topic: 'grn.posted',
        entityType: 'goodsReceipt',
        entityId: input.id,
        transition: 'POSTED',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'goodsReceipt', id: input.id, number: input.number },
      vars: { number: input.number },
      linkUrl: `/inventory/receive/${input.id}`,
    });
  }

  async onInventoryPosted(input: {
    type: string;
    txId: string;
    itemId: string;
    sku: string;
    actorUserId?: string | null;
    referenceType?: string | null;
  }) {
    const topic =
      input.referenceType === 'InventoryCount'
        ? 'inventory.counted'
        : inventoryTopicForTxType(input.type);
    if (!topic) return;
    await this.emit({
      topic,
      eventId: notificationEventId({
        topic,
        entityType: 'inventoryItem',
        entityId: input.itemId,
        transition: input.txId,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'inventoryItem', id: input.itemId, number: input.sku },
      vars: { sku: input.sku, number: input.sku },
      linkUrl: `/inventory/items/${input.itemId}`,
    });
  }

  async onLowStockCross(cross: LowStockCross, actorUserId?: string | null) {
    await this.emit({
      topic: 'inventory.lowStock',
      eventId: notificationEventId({
        topic: 'inventory.lowStock',
        entityType: 'inventoryItem',
        entityId: cross.itemId,
        transition: `CROSS:${cross.before.toFixed(3)}→${cross.after.toFixed(3)}`,
      }),
      actorUserId,
      entity: { type: 'inventoryItem', id: cross.itemId, number: cross.sku },
      vars: { sku: cross.sku, count: 1, number: cross.sku },
      linkUrl: '/inventory/low-stock',
    });
  }

  async onShortageBlockingProduction(input: {
    salesOrderId: string;
    number: string;
    actorUserId?: string | null;
  }) {
    const row = await this.prisma.salesOrder.findUnique({
      where: { id: input.salesOrderId },
      select: { status: true, updatedAt: true },
    });
    if (!row || row.status !== 'WAITING_FOR_MATERIALS') return;
    await this.emit({
      topic: 'inventory.shortageBlockingProduction',
      eventId: notificationEventId({
        topic: 'inventory.shortageBlockingProduction',
        entityType: 'salesOrder',
        entityId: input.salesOrderId,
        transition: `ENTER:${row.updatedAt.toISOString()}`,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'salesOrder', id: input.salesOrderId, number: input.number },
      vars: { number: input.number },
      linkUrl: `/sales-orders/${input.salesOrderId}`,
    });
  }

  async onFinishedPosted(input: {
    productionOrderId: string;
    salesOrderId?: string | null;
    number: string;
    actorUserId?: string | null;
    movementKey: string;
  }) {
    const entityId = input.salesOrderId ?? input.productionOrderId;
    const linkUrl = input.salesOrderId
      ? `/inventory/finished/${input.salesOrderId}`
      : `/production/${input.productionOrderId}`;
    await this.emit({
      topic: 'inventory.finishedPosted',
      eventId: notificationEventId({
        topic: 'inventory.finishedPosted',
        entityType: input.salesOrderId ? 'salesOrder' : 'productionOrder',
        entityId,
        transition: input.movementKey,
      }),
      actorUserId: input.actorUserId,
      entity: {
        type: input.salesOrderId ? 'salesOrder' : 'productionOrder',
        id: entityId,
        number: input.number,
      },
      vars: { number: input.number },
      linkUrl,
    });
  }

  async onFabric(input: {
    id: string;
    state?: string | null;
    eventKind?: string | null;
    actorUserId?: string | null;
  }) {
    const row = await this.prisma.fabricProcurement.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        state: true,
        salesOrderId: true,
        salesOrder: { select: { number: true } },
        productionOrderId: true,
        productionOrder: { select: { id: true, number: true } },
        requirement: {
          select: {
            requestedFabricLabel: true,
            displayName: true,
            sku: true,
            inventoryItem: { select: { sku: true, nameEn: true } },
          },
        },
      },
    });
    if (!row) return;
    const fromEvent = input.eventKind ? fabricTopicForEventKind(input.eventKind) : null;
    const fromState = fabricTopicForState(input.state ?? row.state);
    const topics = [...new Set([fromEvent, fromState].filter((t): t is string => Boolean(t)))];
    const number = row.salesOrder?.number ?? row.productionOrder?.number ?? row.id.slice(0, 8);
    const sku =
      row.requirement?.requestedFabricLabel ||
      row.requirement?.displayName ||
      row.requirement?.inventoryItem?.nameEn ||
      row.requirement?.sku ||
      row.requirement?.inventoryItem?.sku ||
      '';
    const assignedWorkerIds = await this.assignedWorkersForProductionOrder(
      row.productionOrderId ?? row.productionOrder?.id ?? null,
    );
    for (const topic of topics) {
      const extras = topic === 'fabric.readyForPickup' ? assignedWorkerIds : [];
      await this.emit({
        topic,
        eventId: notificationEventId({
          topic,
          entityType: 'fabricJob',
          entityId: row.id,
          transition: `${input.eventKind ?? input.state ?? row.state}`,
        }),
        actorUserId: input.actorUserId,
        // Purchasing who records unavailable/ready still needs the inbox row; demo has no second buyer.
        excludeActor: topic !== 'fabric.unavailable' && topic !== 'fabric.readyForPickup',
        entity: { type: 'fabricJob', id: row.id, number },
        vars: { number, sku },
        linkUrl: `/purchasing/fabric/${row.id}`,
        recipientUserIds: extras,
      });
    }
  }

  private async assignedWorkersForProductionOrder(productionOrderId: string | null): Promise<string[]> {
    if (!productionOrderId) return [];
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        productionOrderId,
        assignedEmployeeId: { not: null },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: { assignedEmployeeId: true },
    });
    return [...new Set(tasks.map((t) => t.assignedEmployeeId).filter((id): id is string => Boolean(id)))];
  }

  async onReturnCase(input: {
    templateCode: string;
    id: string;
    number: string;
    customerId: string;
    actorUserId?: string | null;
    delivery?: string | null;
    invoice?: string | null;
  }) {
    const topic = returnTopicFromTemplate(input.templateCode);
    if (!topic) return;
    await this.emit({
      topic,
      eventId: notificationEventId({
        topic,
        entityType: 'returnRequest',
        entityId: input.id,
        transition: input.templateCode,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'returnRequest', id: input.id, number: input.number },
      vars: {
        number: input.number,
        delivery: input.delivery ?? undefined,
        invoice: input.invoice ?? undefined,
      },
      linkUrl: `/returns/${input.id}`,
      customerId: input.customerId,
    });
  }

  async onInvoice(input: {
    topic: 'invoice.created' | 'invoice.overdue' | 'invoice.voided';
    id: string;
    number: string;
    customerId: string;
    actorUserId?: string | null;
    transition?: string;
  }) {
    await this.emit({
      topic: input.topic,
      eventId: notificationEventId({
        topic: input.topic,
        entityType: 'invoice',
        entityId: input.id,
        transition: input.transition ?? input.topic,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'invoice', id: input.id, number: input.number },
      vars: { number: input.number, invoice: input.number },
      linkUrl: `/invoices/${input.id}`,
      customerId: input.customerId,
    });
  }

  async onPaymentReceived(input: {
    id: string;
    number: string;
    customerId: string;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    actorUserId?: string | null;
  }) {
    const display = input.invoiceNumber ?? input.number;
    const linkUrl = input.invoiceId ? `/invoices/${input.invoiceId}` : `/payments/${input.id}`;
    await this.emit({
      topic: 'payment.received',
      eventId: notificationEventId({
        topic: 'payment.received',
        entityType: 'payment',
        entityId: input.id,
        transition: 'RECORDED',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'payment', id: input.invoiceId ?? input.id, number: display },
      vars: { number: display, invoice: display },
      linkUrl,
      customerId: input.customerId,
    });
  }

  async onScheduleAtRisk(input: {
    productionOrderId: string;
    number: string;
    scheduleId: string;
    actorUserId?: string | null;
  }) {
    await this.emit({
      topic: 'schedule.atRisk',
      eventId: notificationEventId({
        topic: 'schedule.atRisk',
        entityType: 'schedule',
        entityId: input.productionOrderId,
        transition: 'AT_RISK',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'schedule', id: input.productionOrderId, number: input.number },
      vars: { number: input.number },
      linkUrl: '/scheduling',
    });
  }

  async onScheduleConflict(input: {
    conflictId: string;
    number: string;
    actorUserId?: string | null;
  }) {
    await this.emit({
      topic: 'schedule.conflict',
      eventId: notificationEventId({
        topic: 'schedule.conflict',
        entityType: 'schedule',
        entityId: input.conflictId,
        transition: 'OPEN',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'schedule', id: input.conflictId, number: input.number },
      vars: { number: input.number },
      linkUrl: '/scheduling',
    });
  }

  async onTaskScheduledToday(input: {
    taskId: string;
    taskName: string;
    number: string;
    employeeId: string;
    dayYmd: string;
  }) {
    await this.emit({
      topic: 'task.scheduledToday',
      eventId: notificationEventId({
        topic: 'task.scheduledToday',
        entityType: 'task',
        entityId: input.taskId,
        transition: input.dayYmd,
      }),
      entity: { type: 'task', id: input.taskId, number: input.number },
      vars: { number: input.number, taskName: input.taskName, date: input.dayYmd },
      linkUrl: `/tasks/${input.taskId}`,
      recipientUserIds: [input.employeeId],
      excludeActor: false,
    });
  }

  private async emit(input: EmitInput) {
    try {
      await this.notifications.emit({
        topic: input.topic,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        excludeActor: input.excludeActor ?? true,
        entity: input.entity,
        vars: input.vars,
        linkUrl: input.linkUrl,
        customerId: input.customerId,
        recipientUserIds: input.recipientUserIds,
      });
    } catch (err) {
      this.logger.warn(
        `Ops notify emit failed for ${input.topic} ${input.eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
