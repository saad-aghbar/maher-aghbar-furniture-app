import { Injectable, Logger } from '@nestjs/common';
import { notificationEventId } from '@maher/notifications';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from './notifications.service';
import { classifyReadyHandoff, isPackagingStageCode } from './floor-handoff.classify';
import type { NewlyReadyTask, PipelineHandoffFacts } from '../production/pipeline-handoff';

type OrderCtx = {
  productionOrderId: string;
  poNumber: string;
  poStatus: string;
  salesOrderId: string | null;
  soNumber: string | null;
  soStatus: string | null;
  customerId: string | null;
  model: string | null;
};

@Injectable()
export class FloorHandoffService {
  private readonly logger = new Logger(FloorHandoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async emitPipeline(facts: PipelineHandoffFacts, opts: { actorUserId?: string | null } = {}) {
    if (!facts.productionOrderId) return;
    const ctx = await this.loadPoContext(facts.productionOrderId);
    if (!ctx) return;
    if (ctx.poStatus === 'CANCELLED' || ctx.soStatus === 'CANCELLED') return;
    const held = ctx.poStatus === 'ON_HOLD' || ctx.soStatus === 'ON_HOLD';
    const actorUserId = opts.actorUserId ?? null;

    if (!held) {
      for (const task of facts.newlyReadyTasks) {
        await this.emitReadyTask(task, ctx, actorUserId);
      }
      if (
        facts.completedStage &&
        classifyReadyHandoff({ stageCode: facts.completedStage.code }) === 'task.ready' &&
        !isPackagingStageCode(facts.completedStage.code)
      ) {
        await this.emit({
          topic: 'stage.completed',
          eventId: notificationEventId({
            topic: 'stage.completed',
            entityType: 'productionOrder',
            entityId: facts.productionOrderId,
            transition: `COMPLETED:${facts.completedStage.code}`,
          }),
          actorUserId,
          entity: {
            type: 'productionOrder',
            id: facts.productionOrderId,
            number: ctx.soNumber ?? ctx.poNumber,
          },
          vars: {
            number: ctx.soNumber ?? ctx.poNumber,
            stage: facts.completedStage.nameEn,
            nextStage: facts.newlyReadyTasks[0]?.stageNameEn ?? '',
            taskName: facts.completedStage.nameEn,
            model: ctx.model,
          },
          linkUrl: ctx.salesOrderId
            ? `/sales-orders/${ctx.salesOrderId}`
            : `/production/${facts.productionOrderId}`,
          customerId: ctx.customerId,
        });
      }
      if (facts.packagingStageCompleted) {
        await this.emit({
          topic: 'packaging.completed',
          eventId: notificationEventId({
            topic: 'packaging.completed',
            entityType: 'productionOrder',
            entityId: facts.productionOrderId,
            transition: 'PACKAGING:COMPLETED',
          }),
          actorUserId,
          entity: {
            type: 'productionOrder',
            id: facts.productionOrderId,
            number: ctx.soNumber ?? ctx.poNumber,
          },
          vars: { number: ctx.soNumber ?? ctx.poNumber, stage: 'Packaging', model: ctx.model },
          linkUrl: ctx.salesOrderId
            ? `/sales-orders/${ctx.salesOrderId}`
            : `/production/${facts.productionOrderId}`,
          customerId: ctx.customerId,
        });
      }
      if (facts.soBecameReadyForDelivery || facts.poBecameReadyForDelivery) {
        await this.emitReadyForDelivery(facts, ctx, actorUserId);
      }
    }
  }

  async emitReadyTask(task: NewlyReadyTask, ctx: OrderCtx, actorUserId: string | null) {
    const topic = classifyReadyHandoff({
      stageCode: task.stageCode,
      executionKind: task.executionKind,
    });
    const assigned = task.assignedEmployeeId ? [task.assignedEmployeeId] : [];
    const number = ctx.soNumber ?? ctx.poNumber;
    const entityId = task.id;
    await this.emit({
      topic,
      eventId: notificationEventId({
        topic,
        entityType: 'task',
        entityId,
        transition: `${task.statusFrom}→READY`,
      }),
      actorUserId,
      entity: { type: 'task', id: entityId, number },
      vars: {
        number,
        taskName: task.stageNameEn,
        stage: task.stageNameEn,
        model: ctx.model,
      },
      linkUrl: `/tasks/${task.id}`,
      customerId: ctx.customerId,
      recipientUserIds: assigned,
    });
  }

  async onTaskAssigned(input: {
    taskId: string;
    employeeId: string;
    taskName: string;
    number: string;
    actorUserId?: string | null;
    urgent?: boolean;
  }) {
    await this.emit({
      topic: 'task.assigned',
      eventId: notificationEventId({
        topic: 'task.assigned',
        entityType: 'task',
        entityId: input.taskId,
        transition: `assigned:${input.employeeId}:${Date.now()}`,
      }),
      actorUserId: input.actorUserId ?? null,
      entity: { type: 'task', id: input.taskId, number: input.number },
      vars: { number: input.number, taskName: input.taskName, orderNumber: input.number },
      linkUrl: `/tasks/${input.taskId}`,
      recipientUserIds: [input.employeeId],
    });
    if (input.urgent) {
      await this.emit({
        topic: 'task.urgent',
        eventId: notificationEventId({
          topic: 'task.urgent',
          entityType: 'task',
          entityId: input.taskId,
          transition: `urgent:${input.employeeId}:${Date.now()}`,
        }),
        actorUserId: input.actorUserId ?? null,
        entity: { type: 'task', id: input.taskId, number: input.number },
        vars: { number: input.number, taskName: input.taskName },
        linkUrl: `/tasks/${input.taskId}`,
        recipientUserIds: [input.employeeId],
      });
    }
  }

  async onTaskLifecycle(input: {
    topic: 'task.started' | 'task.paused' | 'task.resumed' | 'task.completed';
    taskId: string;
    taskName: string;
    number: string;
    actorUserId?: string | null;
    salesOrderId?: string | null;
    customerId?: string | null;
  }) {
    await this.emit({
      topic: input.topic,
      eventId: notificationEventId({
        topic: input.topic,
        entityType: 'task',
        entityId: input.taskId,
        transition: input.topic,
      }),
      actorUserId: input.actorUserId ?? null,
      entity: { type: 'task', id: input.taskId, number: input.number },
      vars: { number: input.number, taskName: input.taskName },
      linkUrl: `/tasks/${input.taskId}`,
      customerId: input.customerId,
    });
  }

  async onOrderHold(input: {
    salesOrderId: string;
    number: string;
    customerId: string;
    actorUserId: string;
    workerUserIds: string[];
    occurredAt?: Date;
  }) {
    await this.emit({
      topic: 'order.onHold',
      eventId: notificationEventId({
        topic: 'order.onHold',
        entityType: 'salesOrder',
        entityId: input.salesOrderId,
        transition: `ON_HOLD:${(input.occurredAt ?? new Date()).toISOString()}`,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'salesOrder', id: input.salesOrderId, number: input.number },
      vars: { number: input.number },
      linkUrl: `/sales-orders/${input.salesOrderId}`,
      customerId: input.customerId,
      recipientUserIds: input.workerUserIds,
    });
  }

  async onOrderResumed(input: {
    salesOrderId: string;
    number: string;
    customerId: string;
    actorUserId: string;
    workerUserIds: string[];
    occurredAt?: Date;
  }) {
    await this.emit({
      topic: 'order.resumed',
      eventId: notificationEventId({
        topic: 'order.resumed',
        entityType: 'salesOrder',
        entityId: input.salesOrderId,
        transition: `RESUMED:${(input.occurredAt ?? new Date()).toISOString()}`,
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'salesOrder', id: input.salesOrderId, number: input.number },
      vars: { number: input.number },
      linkUrl: `/sales-orders/${input.salesOrderId}`,
      customerId: input.customerId,
      recipientUserIds: input.workerUserIds,
    });
  }

  async onOrderCancelled(input: {
    salesOrderId: string;
    number: string;
    customerId: string;
    actorUserId: string;
    workerUserIds: string[];
  }) {
    await this.emit({
      topic: 'order.cancelled',
      eventId: notificationEventId({
        topic: 'order.cancelled',
        entityType: 'salesOrder',
        entityId: input.salesOrderId,
        transition: 'CANCELLED',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'salesOrder', id: input.salesOrderId, number: input.number },
      vars: { number: input.number },
      linkUrl: `/sales-orders/${input.salesOrderId}`,
      customerId: input.customerId,
      recipientUserIds: input.workerUserIds,
    });
  }

  async onQualityPassed(input: {
    inspectionId: string;
    productionOrderId: string;
    number: string;
    actorUserId: string;
    customerId?: string | null;
    salesOrderId?: string | null;
    packagingTaskId?: string | null;
  }) {
    await this.emit({
      topic: 'quality.passed',
      eventId: notificationEventId({
        topic: 'quality.passed',
        entityType: 'qualityInspection',
        entityId: input.inspectionId,
        transition: 'PASSED',
      }),
      actorUserId: input.actorUserId,
      entity: {
        type: input.packagingTaskId ? 'task' : input.salesOrderId ? 'salesOrder' : 'productionOrder',
        id: input.packagingTaskId ?? input.salesOrderId ?? input.productionOrderId,
        number: input.number,
      },
      vars: { number: input.number },
      linkUrl: input.packagingTaskId
        ? `/tasks/${input.packagingTaskId}`
        : input.salesOrderId
          ? `/sales-orders/${input.salesOrderId}`
          : `/production/${input.productionOrderId}`,
      customerId: input.customerId,
    });
  }

  async onQualityFailed(input: {
    inspectionId: string;
    productionOrderId: string;
    number: string;
    actorUserId: string;
    customerId?: string | null;
    salesOrderId?: string | null;
    reworkTaskId?: string | null;
    reworkWorkerIds?: string[];
    skipReworkRequired?: boolean;
  }) {
    await this.emit({
      topic: 'quality.failed',
      eventId: notificationEventId({
        topic: 'quality.failed',
        entityType: 'qualityInspection',
        entityId: input.inspectionId,
        transition: 'FAILED',
      }),
      actorUserId: input.actorUserId,
      entity: {
        type: input.reworkTaskId ? 'task' : 'productionOrder',
        id: input.reworkTaskId ?? input.productionOrderId,
        number: input.number,
      },
      vars: { number: input.number },
      linkUrl: input.reworkTaskId
        ? `/tasks/${input.reworkTaskId}`
        : `/production/${input.productionOrderId}`,
      customerId: input.customerId,
    });
    if (!input.skipReworkRequired && !input.reworkTaskId) {
      await this.emit({
        topic: 'quality.reworkRequired',
        eventId: notificationEventId({
          topic: 'quality.reworkRequired',
          entityType: 'qualityInspection',
          entityId: input.inspectionId,
          transition: 'FAILED_REWORK_REQUIRED',
        }),
        actorUserId: input.actorUserId,
        entity: { type: 'qualityInspection', id: input.inspectionId, number: input.number },
        vars: { number: input.number },
        linkUrl: `/production/${input.productionOrderId}`,
        customerId: input.customerId,
        recipientUserIds: input.reworkWorkerIds ?? [],
      });
    }
  }

  async onReworkTaskReady(input: {
    taskId: string;
    assignedEmployeeId: string | null;
    stageNameEn: string;
    number: string;
    inspectionId: string | null;
    actorUserId: string;
    customerId?: string | null;
  }) {
    const assigned = input.assignedEmployeeId ? [input.assignedEmployeeId] : [];
    await this.emit({
      topic: 'quality.reworkRequired',
      eventId: notificationEventId({
        topic: 'quality.reworkRequired',
        entityType: 'task',
        entityId: input.taskId,
        transition: 'READY',
      }),
      actorUserId: input.actorUserId,
      entity: { type: 'task', id: input.taskId, number: input.number },
      vars: { number: input.number, taskName: input.stageNameEn, stage: input.stageNameEn },
      linkUrl: `/tasks/${input.taskId}`,
      customerId: input.customerId,
      recipientUserIds: assigned,
    });
  }

  async onReworkReadyToInspect(input: {
    inspectionId: string;
    productionOrderId: string;
    number: string;
    actorUserId: string;
    inspectionTaskId?: string | null;
    inspectorIds?: string[];
    customerId?: string | null;
    salesOrderId?: string | null;
    reworkId?: string;
  }) {
    await this.emit({
      topic: 'quality.reworkReady',
      eventId: notificationEventId({
        topic: 'quality.reworkReady',
        entityType: 'qualityInspection',
        entityId: input.inspectionId,
        transition: `REINSPECT:${input.reworkId ?? input.inspectionId}`,
      }),
      actorUserId: input.actorUserId,
      entity: {
        type: input.inspectionTaskId ? 'task' : 'productionOrder',
        id: input.inspectionTaskId ?? input.productionOrderId,
        number: input.number,
      },
      vars: { number: input.number },
      linkUrl: input.inspectionTaskId
        ? `/tasks/${input.inspectionTaskId}`
        : `/production/${input.productionOrderId}`,
      customerId: input.customerId,
      recipientUserIds: input.inspectorIds ?? [],
    });
  }

  async assignedWorkerIdsForSalesOrder(salesOrderId: string): Promise<string[]> {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        productionOrder: { salesOrderId, status: { not: 'CANCELLED' } },
        assignedEmployeeId: { not: null },
        status: {
          in: ['NOT_STARTED', 'READY', 'IN_PROGRESS', 'PAUSED', 'READY_FOR_INSPECTION', 'BLOCKED'],
        },
      },
      select: { assignedEmployeeId: true },
    });
    return [...new Set(tasks.map((t) => t.assignedEmployeeId).filter((id): id is string => Boolean(id)))];
  }

  private async emitReadyForDelivery(
    facts: PipelineHandoffFacts,
    ctx: OrderCtx,
    actorUserId: string | null,
  ) {
    if (facts.soBecameReadyForDelivery && ctx.salesOrderId) {
      await this.emit({
        topic: 'order.readyForDelivery',
        eventId: notificationEventId({
          topic: 'order.readyForDelivery',
          entityType: 'salesOrder',
          entityId: ctx.salesOrderId,
          transition: 'READY_FOR_DELIVERY',
        }),
        actorUserId,
        entity: { type: 'salesOrder', id: ctx.salesOrderId, number: ctx.soNumber ?? ctx.poNumber },
        vars: { number: ctx.soNumber ?? ctx.poNumber, model: ctx.model },
        linkUrl: `/sales-orders/${ctx.salesOrderId}`,
        customerId: ctx.customerId,
      });
    }
    if (facts.deliveryId) {
      await this.emit({
        topic: 'delivery.readyToLoad',
        eventId: notificationEventId({
          topic: 'delivery.readyToLoad',
          entityType: 'delivery',
          entityId: facts.deliveryId,
          transition: 'READY_TO_LOAD',
        }),
        actorUserId,
        entity: { type: 'delivery', id: facts.deliveryId, number: ctx.soNumber ?? ctx.poNumber },
        vars: { number: ctx.soNumber ?? ctx.poNumber, delivery: ctx.soNumber ?? ctx.poNumber },
        linkUrl: `/deliveries/${facts.deliveryId}`,
        customerId: ctx.customerId,
      });
    }
  }

  private async loadPoContext(productionOrderId: string): Promise<OrderCtx | null> {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: {
        id: true,
        number: true,
        status: true,
        productDescription: true,
        product: { select: { nameEn: true, sku: true } },
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            customerId: true,
            lines: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
              select: { description: true, product: { select: { nameEn: true } } },
            },
          },
        },
      },
    });
    if (!po) return null;
    const model =
      po.product?.nameEn ||
      po.salesOrder?.lines[0]?.product?.nameEn ||
      po.salesOrder?.lines[0]?.description ||
      po.productDescription ||
      null;
    return {
      productionOrderId: po.id,
      poNumber: po.number,
      poStatus: po.status,
      salesOrderId: po.salesOrder?.id ?? null,
      soNumber: po.salesOrder?.number ?? null,
      soStatus: po.salesOrder?.status ?? null,
      customerId: po.salesOrder?.customerId ?? null,
      model,
    };
  }

  private async emit(input: {
    topic: string;
    eventId: string;
    actorUserId: string | null;
    entity: { type: string; id: string; number?: string };
    vars?: Record<string, string | number | null | undefined>;
    linkUrl: string;
    customerId?: string | null;
    recipientUserIds?: string[];
  }) {
    try {
      await this.notifications.emit({
        topic: input.topic,
        eventId: input.eventId,
        actorUserId: input.actorUserId,
        excludeActor: true,
        entity: input.entity,
        vars: input.vars,
        linkUrl: input.linkUrl,
        customerId: input.customerId,
        recipientUserIds: input.recipientUserIds,
      });
    } catch (err) {
      this.logger.warn(
        `Floor handoff emit failed for ${input.topic} ${input.eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
