import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, TaskStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { IdempotencyService } from '../../common/idempotency.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  AssignTaskDto,
  ListTasksDto,
  TaskBlockDto,
  TaskProgressDto,
} from './dto/task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import {
  buildTaskTimingSummary,
  closedSecondsFromTimeEntries,
} from '../../common/helpers/task-timing.util';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Parse YYYY-MM-DD as a UTC calendar day; null if invalid. */
function parseYmd(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
    private readonly invoices: InvoicesService,
    private readonly storage: LocalStorageService,
    private readonly idempotency: IdempotencyService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly scheduling?: SchedulingService,
  ) {}

  private notifyScheduleLifecycle(taskId: string, event: 'start' | 'pause' | 'complete' | 'blocker') {
    this.scheduling?.onTaskLifecycle(taskId, event).catch(() => undefined);
  }

  async list(query: ListTasksDto, userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes('production-task.update-any');
    // Floor workers share the same role but must only ever see their assigned tasks.
    const forceMine = query.mine === true || !canSeeAll;

    let statusWhere: Prisma.ProductionTaskWhereInput = {};
    if (query.status) {
      statusWhere = { status: query.status };
    } else if (query.scope === 'completed') {
      statusWhere = { status: TaskStatus.COMPLETED };
    } else if (query.scope === 'open' || (forceMine && query.scope !== 'all')) {
      statusWhere = {
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      };
    }

    const completedFrom = parseYmd(query.completedFrom);
    const completedTo = parseYmd(query.completedTo);
    const q = query.q?.trim();

    let dealerIdsFromSearch: string[] | undefined;
    if (q) {
      const dealers = await this.prisma.customer.findMany({
        where: {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { nameEn: { contains: q, mode: 'insensitive' } },
            { nameAr: { contains: q, mode: 'insensitive' } },
            { nameHe: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      });
      dealerIdsFromSearch = dealers.map((d) => d.id);
    }

    const where: Prisma.ProductionTaskWhereInput = {
      ...statusWhere,
      ...(forceMine ? { assignedEmployeeId: userId } : {}),
      ...(query.dueToday
        ? {
            plannedCompletion: {
              gte: startOfUtcDay(),
              lte: endOfUtcDay(),
            },
          }
        : {}),
      ...(query.customerId
        ? { productionOrder: { customerId: query.customerId } }
        : {}),
      ...(completedFrom || completedTo
        ? {
            actualCompletion: {
              ...(completedFrom ? { gte: startOfUtcDay(completedFrom) } : {}),
              ...(completedTo ? { lte: endOfUtcDay(completedTo) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              {
                productionOrder: {
                  number: { contains: q, mode: 'insensitive' },
                },
              },
              {
                productionOrder: {
                  productDescription: { contains: q, mode: 'insensitive' },
                },
              },
              {
                productionOrder: {
                  salesOrder: { number: { contains: q, mode: 'insensitive' } },
                },
              },
              ...(dealerIdsFromSearch?.length
                ? [
                    {
                      productionOrder: {
                        customerId: { in: dealerIdsFromSearch },
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionTask.count({ where }),
      this.prisma.productionTask.findMany({
        where,
        include: {
          productionOrder: {
            select: {
              id: true,
              number: true,
              status: true,
              productDescription: true,
              salesOrder: { select: { id: true, number: true } },
              product: {
                select: {
                  id: true,
                  imageUrl: true,
                  nameEn: true,
                  nameAr: true,
                  nameHe: true,
                },
              },
            },
          },
          stageDefinition: {
            select: {
              id: true,
              code: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              dependsOnCodes: true,
              sortOrder: true,
              requiresPhotos: true,
            },
          },
          stageInstance: {
            select: canSeeAll
              ? { id: true, status: true, progressPercent: true }
              : { id: true, status: true },
          },
          ...(canSeeAll
            ? {
                assignedEmployee: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              }
            : {}),
          blockers: true,
          timeEntries: {
            where: { endedAt: null },
            orderBy: { startedAt: 'desc' as const },
            take: 1,
            select: { startedAt: true },
          },
        },
        orderBy:
          query.scope === 'completed'
            ? [{ actualCompletion: 'desc' as const }, { createdAt: 'desc' as const }]
            : [
                { priority: 'desc' as const },
                { plannedCompletion: 'asc' as const },
                { createdAt: 'desc' as const },
              ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const mapped = data.map((task) => {
      const product = task.productionOrder.product;
      const openStartedAt = task.timeEntries?.[0]?.startedAt ?? null;
      const { timeEntries: _entries, ...rest } = task;
      const timing = buildTaskTimingSummary({
        status: task.status,
        actualMinutes: task.actualMinutes,
        estimatedMinutes: task.estimatedMinutes,
        plannedCompletion: task.plannedCompletion,
        openStartedAt,
        // List query only loads open entries; fall back to minute storage.
      });
      const row = {
        ...rest,
        timing,
        productImageUrl: product?.imageUrl?.trim() || null,
        factoryOrderNumber: task.productionOrder.number,
        salesOrderNumber: task.productionOrder.salesOrder?.number ?? null,
      };
      if (canSeeAll) return row;
      const { progressPercent: _omit, ...safe } = row;
      return safe;
    });

    return { data: mapped, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  /**
   * Distinct dealers from completed tasks the worker can see (for floor filters).
   * Avoids requiring customer.read for production workers.
   */
  async listCompletedDealers(userId: string, permissions: string[]) {
    const canSeeAll = permissions.includes('production-task.update-any');
    const rows = await this.prisma.productionTask.findMany({
      where: {
        status: TaskStatus.COMPLETED,
        ...(canSeeAll ? {} : { assignedEmployeeId: userId }),
      },
      select: {
        productionOrder: {
          select: { customerId: true },
        },
      },
      take: 500,
      orderBy: { actualCompletion: 'desc' },
    });

    const ids = [
      ...new Set(
        rows
          .map((r) => r.productionOrder.customerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!ids.length) return { data: [] };

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        nameEn: c.nameEn ?? null,
        nameAr: c.nameAr ?? null,
        nameHe: c.nameHe ?? null,
      })),
    };
  }

  private async getTask(id: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
      include: {
        blockers: true,
        stageDefinition: true,
        stageInstance: true,
        productionOrder: true,
      },
    });
    if (!task) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found.' });
    return task;
  }

  async getById(id: string, userId?: string, permissions: string[] = []) {
    const canSeeAll = permissions.includes('production-task.update-any');

    const task = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id },
      include: {
        productionOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            productDescription: true,
            quantity: true,
            specifications: true,
            currentStageCode: true,
            ...(canSeeAll ? { progressPercent: true } : {}),
            salesOrder: { select: { id: true, number: true } },
            product: {
              select: {
                id: true,
                sku: true,
                nameAr: true,
                nameEn: true,
                nameHe: true,
                imageUrl: true,
                galleryUrls: true,
              },
            },
          },
        },
        stageDefinition: true,
        ...(canSeeAll
          ? {
              stageInstance: true,
              assignedEmployee: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
              timeEntries: {
                orderBy: { startedAt: 'desc' as const },
                select: { startedAt: true, endedAt: true },
              },
            }
          : {
              stageInstance: {
                select: { id: true, status: true, actualStart: true, actualEnd: true },
              },
              timeEntries: {
                orderBy: { startedAt: 'desc' as const },
                select: { startedAt: true, endedAt: true },
              },
            }),
        blockers: true,
      },
    });

    if (userId) {
      if (!canSeeAll && task.assignedEmployeeId !== userId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You can only view tasks assigned to you.',
        });
      }
    }

    const photoDocs = await this.prisma.document.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        category: `TASK_PHOTO:${task.id}`,
        archivedAt: null,
      },
      select: { id: true, fileName: true, storageKey: true, mimeType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const attachmentDocs = await this.prisma.document.findMany({
      where: {
        productionOrderId: task.productionOrderId,
        archivedAt: null,
        OR: [
          { category: null },
          { NOT: { category: { startsWith: 'TASK_PHOTO:' } } },
        ],
      },
      select: { id: true, fileName: true, storageKey: true, mimeType: true, category: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const toFile = (doc: {
      id: string;
      fileName: string;
      storageKey: string;
      mimeType?: string | null;
      category?: string | null;
      createdAt: Date;
    }) => {
      const token = this.storage.createAccessToken(doc.storageKey, 3600);
      return {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        category: doc.category ?? null,
        createdAt: doc.createdAt,
        downloadPath: `/api/v1/uploads/download?token=${token}`,
      };
    };

    const photos = photoDocs.map(toFile);
    const attachments = attachmentDocs.map(toFile);

    const openStartedAt =
      task.status === 'IN_PROGRESS'
        ? (task.timeEntries?.find((e: { endedAt?: Date | null; startedAt: Date }) => !e.endedAt)
            ?.startedAt ??
          task.timeEntries?.[0]?.startedAt ??
          null)
        : null;

    const hasClosedEntries = (task.timeEntries ?? []).some(
      (e: { endedAt?: Date | null }) => e.endedAt != null,
    );
    const timing = buildTaskTimingSummary({
      status: task.status,
      actualMinutes: task.actualMinutes,
      actualSeconds: hasClosedEntries
        ? closedSecondsFromTimeEntries(task.timeEntries)
        : undefined,
      estimatedMinutes: task.estimatedMinutes,
      plannedCompletion: task.plannedCompletion,
      openStartedAt,
    });

    const product = task.productionOrder.product;
    const productImageUrls = [
      product?.imageUrl?.trim() || null,
      ...((product?.galleryUrls as string[] | undefined) ?? []).map((u) => u?.trim() || null),
    ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

    const payload = {
      ...task,
      timing,
      photos,
      attachments,
      productImageUrl: productImageUrls[0] ?? null,
      productImageUrls,
      factoryOrderNumber: task.productionOrder.number,
      salesOrderNumber: task.productionOrder.salesOrder?.number ?? null,
    };

    if (canSeeAll) return payload;
    const { progressPercent: _omit, timeEntries: _te, ...safe } = payload;
    return safe;
  }

  private async closeOpenTimeEntries(
    tx: Prisma.TransactionClient,
    taskId: string,
    userId: string,
  ) {
    const open = await tx.taskTimeEntry.findMany({
      where: { taskId, endedAt: null },
    });
    if (open.length === 0) return;

    const now = new Date();
    for (const entry of open) {
      const durationMs = Math.max(0, now.getTime() - entry.startedAt.getTime());
      // Floor — never round a 1m2s session up to 2 minutes.
      const minutes = Math.floor(durationMs / 60000);
      await tx.taskTimeEntry.update({
        where: { id: entry.id },
        data: { endedAt: now, minutes, userId: entry.userId || userId },
      });
    }

    const closed = await tx.taskTimeEntry.findMany({
      where: { taskId, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });
    const totalSeconds = closedSecondsFromTimeEntries(closed);
    await tx.productionTask.update({
      where: { id: taskId },
      data: { actualMinutes: Math.floor(totalSeconds / 60) },
    });
  }

  private assertCanModify(
    task: { assignedEmployeeId: string | null },
    userId: string,
    permissions: string[],
  ) {
    const canAny = permissions.includes('production-task.update-any');
    const canOwn =
      permissions.includes('production-task.update-own') && task.assignedEmployeeId === userId;
    if (!canAny && !canOwn) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only modify tasks assigned to you.',
      });
    }
  }

  private async assertPrereqsMet(task: {
    productionOrderId: string;
    stageDefinition: { dependsOnCodes: string[]; code: string } | null;
    stageInstance: { status: string } | null;
  }) {
    const depends = task.stageDefinition?.dependsOnCodes ?? [];
    const met = await this.pipeline.arePrereqsMet(task.productionOrderId, depends);
    if (!met) {
      throw new BadRequestException({
        code: 'STAGE_LOCKED',
        message: `Stage ${task.stageDefinition?.code ?? 'unknown'} is locked until prerequisites are completed: ${depends.join(', ')}`,
      });
    }
  }

  async assign(id: string, dto: AssignTaskDto) {
    const task = await this.getTask(id);
    const orderStatus = task.productionOrder?.status;
    if (orderStatus === 'COMPLETED' || orderStatus === 'CANCELLED') {
      throw new BadRequestException({
        code: 'ASSIGN_LOCKED',
        message: 'Cannot assign workers on a completed or cancelled production order.',
      });
    }

    const lockedTaskStatuses = [
      'COMPLETED',
      'CANCELLED',
      'IN_PROGRESS',
      'PAUSED',
      'READY_FOR_INSPECTION',
      'BLOCKED',
    ];
    const lockedStageStatuses = [
      'COMPLETED',
      'SKIPPED',
      'IN_PROGRESS',
      'PAUSED',
      'READY_FOR_INSPECTION',
      'BLOCKED',
    ];
    const stageStatus = task.stageInstance?.status;
    if (lockedTaskStatuses.includes(task.status) || (stageStatus && lockedStageStatuses.includes(stageStatus))) {
      throw new BadRequestException({
        code: 'ASSIGN_LOCKED',
        message:
          'Cannot reassign this stage — it is already in progress, completed, or otherwise locked.',
      });
    }

    const employee = await this.prisma.user.findFirst({
      where: { id: dto.employeeId, isActive: true, archivedAt: null },
    });
    if (!employee) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Employee not found.' });
    }

    if (dto.plannedCompletion) {
      const due = new Date(dto.plannedCompletion);
      if (Number.isNaN(due.getTime())) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'plannedCompletion must be a valid ISO datetime.',
        });
      }
    }

    const updated = await this.prisma.productionTask.update({
      where: { id },
      data: {
        assignedEmployeeId: dto.employeeId,
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.plannedCompletion
          ? { plannedCompletion: new Date(dto.plannedCompletion) }
          : {}),
        ...(dto.estimatedMinutes != null ? { estimatedMinutes: dto.estimatedMinutes } : {}),
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        stageDefinition: true,
        productionOrder: { select: { id: true, number: true } },
      },
    });

    const timing = buildTaskTimingSummary({
      status: updated.status,
      actualMinutes: updated.actualMinutes,
      estimatedMinutes: updated.estimatedMinutes,
      plannedCompletion: updated.plannedCompletion,
      openStartedAt: null,
    });

    const orderNumber = updated.productionOrder?.number ?? '';
    const taskName = updated.name ?? updated.stageDefinition?.nameEn ?? 'Task';
    const priority = dto.priority ?? updated.priority;
    await this.notifications
      .sendFromTemplate({
        templateCode: 'WORKER_ASSIGNED',
        channel: 'IN_APP',
        to: { userId: dto.employeeId },
        vars: { taskName, orderNumber },
        linkUrl: `/tasks/${updated.id}`,
      })
      .catch(() => undefined);
    if (priority === 'URGENT') {
      await this.notifications
        .sendFromTemplate({
          templateCode: 'URGENT_TASK',
          channel: 'IN_APP',
          to: { userId: dto.employeeId },
          vars: { taskName, orderNumber },
          linkUrl: `/tasks/${updated.id}`,
        })
        .catch(() => undefined);
    }

    return { ...updated, timing };
  }

  async start(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    await this.assertPrereqsMet(task);

    const stageStatus = task.stageInstance?.status;
    const allowedTask = ['NOT_STARTED', 'READY', 'PAUSED'].includes(task.status);
    const stageOk =
      !stageStatus || ['READY', 'IN_PROGRESS', 'PENDING'].includes(stageStatus);

    if (!allowedTask) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task cannot be started.' });
    }
    if (task.status === 'NOT_STARTED' && stageStatus && stageStatus === 'PENDING') {
      throw new BadRequestException({
        code: 'STAGE_LOCKED',
        message: 'Task is not READY yet — waiting for previous stages.',
      });
    }
    if (!stageOk && stageStatus === 'COMPLETED') {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Stage already completed.' });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskTimeEntry.create({
        data: {
          taskId: id,
          userId,
          startedAt: new Date(),
        },
      });
      const updated = await tx.productionTask.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          actualStart: task.actualStart ?? new Date(),
          assignedEmployeeId: task.assignedEmployeeId ?? userId,
        },
      });
      await this.pipeline.onTaskStart(task.productionOrderId, task.stageInstanceId, tx);
      return updated;
    }).then((updated) => {
      this.notifyScheduleLifecycle(id, 'start');
      return updated;
    });
  }

  async pause(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only in-progress tasks can be paused.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.closeOpenTimeEntries(tx, id, userId);
      return tx.productionTask.update({
        where: { id },
        data: { status: 'PAUSED' },
      });
    }).then((updated) => {
      this.notifyScheduleLifecycle(id, 'pause');
      return updated;
    });
  }

  async resume(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (!['PAUSED', 'BLOCKED'].includes(task.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only paused or blocked tasks can be resumed.',
      });
    }
    await this.assertPrereqsMet(task);

    return this.prisma.$transaction(async (tx) => {
      await tx.taskTimeEntry.create({
        data: { taskId: id, userId, startedAt: new Date() },
      });
      const updated = await tx.productionTask.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
      if (task.stageInstanceId && task.status === 'BLOCKED') {
        await tx.productionStageInstance.update({
          where: { id: task.stageInstanceId },
          data: { status: 'IN_PROGRESS' },
        });
      }
      await this.pipeline.onTaskStart(task.productionOrderId, task.stageInstanceId, tx);
      return updated;
    });
  }

  async progress(id: string, dto: TaskProgressDto, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Task is closed.' });
    }
    await this.assertPrereqsMet(task);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productionTask.update({
        where: { id },
        data: {
          progressPercent: dto.percent,
          status: dto.percent >= 100 ? 'READY_FOR_INSPECTION' : 'IN_PROGRESS',
        },
      });
      await this.pipeline.onTaskProgress(
        task.productionOrderId,
        task.stageInstanceId,
        dto.percent,
        tx,
      );
      return updated;
    });
  }

  /**
   * Floor "report problem" — logs a blocker for supervisors but does **not**
   * pause the task. Workers keep the timer and action dock and can finish.
   * Legacy hard-BLOCKED tasks are released to PAUSED so work can continue.
   */
  async block(id: string, dto: TaskBlockDto, userId: string, permissions: string[]) {
    const scope = `task.block:${id}`;
    const { result } = await this.idempotency.once(
      scope,
      dto.idempotencyKey,
      { userId, entityId: id },
      async () => {
        const task = await this.getTask(id);
        this.assertCanModify(task, userId, permissions);

        if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
          throw new ConflictException({
            code: 'TASK_TERMINAL',
            message: 'Cannot report a problem on a finished or cancelled task.',
          });
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.taskBlocker.create({
            data: {
              taskId: id,
              category: dto.category,
              reason: dto.reason,
              reportedById: userId,
            },
          });

          // Soft reports must never leave the floor task hard-blocked.
          if (task.status === 'BLOCKED') {
            await tx.productionTask.update({
              where: { id },
              data: { status: 'PAUSED' },
            });
            if (task.stageInstanceId) {
              await tx.productionStageInstance.update({
                where: { id: task.stageInstanceId },
                data: { status: 'IN_PROGRESS' },
              });
            }
          }
        });

        this.notifyScheduleLifecycle(id, 'blocker');
        return this.getById(id, userId, permissions);
      },
    );
    return result;
  }

  async unblock(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (task.status !== 'BLOCKED') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only blocked tasks can be unblocked.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.taskBlocker.updateMany({
        where: { taskId: id, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });

      const updated = await tx.productionTask.update({
        where: { id },
        data: { status: 'PAUSED' },
        include: { blockers: true },
      });

      if (task.stageInstanceId) {
        await tx.productionStageInstance.update({
          where: { id: task.stageInstanceId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return updated;
    });
  }

  async updateNotes(
    id: string,
    notes: string,
    userId: string,
    permissions: string[],
    idempotencyKey?: string,
  ) {
    const scope = `task.notes:${id}`;
    const { result } = await this.idempotency.once(
      scope,
      idempotencyKey,
      { userId, entityId: id },
      async () => {
        const task = await this.getTask(id);
        this.assertCanModify(task, userId, permissions);
        if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
          throw new ConflictException({
            code: 'TASK_TERMINAL',
            message: 'Cannot update notes on a finished or cancelled task.',
          });
        }
        return this.prisma.productionTask.update({
          where: { id },
          data: { notes },
        });
      },
    );
    return result;
  }

  async complete(
    id: string,
    userId: string,
    permissions: string[],
    dto?: { notes?: string; photoDocumentIds?: string[]; idempotencyKey?: string },
  ) {
    const scope = `task.complete:${id}`;

    if (dto?.idempotencyKey) {
      const cached = await this.idempotency.get(scope, dto.idempotencyKey);
      if (cached != null) return cached;
    }

    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);

    // Idempotent: already completed → return current detail (no silent re-run).
    if (task.status === 'COMPLETED') {
      const existing = await this.getById(id, userId, permissions);
      if (dto?.idempotencyKey) {
        await this.idempotency.put({
          scope,
          key: dto.idempotencyKey,
          userId,
          entityId: id,
          response: existing,
        });
      }
      return existing;
    }

    if (task.status === 'CANCELLED') {
      throw new ConflictException({
        code: 'TASK_CANCELLED',
        message: 'Cannot complete a cancelled task.',
      });
    }

    if (task.status === 'BLOCKED') {
      throw new ConflictException({
        code: 'TASK_BLOCKED',
        message: 'Resolve the reported problem before finishing this task.',
      });
    }

    // Soft floor reports (taskBlocker rows) stay visible to supervisors but do
    // not gate completion — only a hard BLOCKED status does.

    await this.assertPrereqsMet(task);

    if (['READY', 'NOT_STARTED', 'PAUSED'].includes(task.status)) {
      await this.start(id, userId, permissions);
    }

    if (task.stageDefinition?.requiresPhotos) {
      const linked = dto?.photoDocumentIds?.length
        ? dto.photoDocumentIds.length
        : await this.prisma.document.count({
            where: {
              productionOrderId: task.productionOrderId,
              category: `TASK_PHOTO:${id}`,
              archivedAt: null,
            },
          });
      if (!linked) {
        throw new BadRequestException({
          code: 'PHOTOS_REQUIRED',
          message: 'This stage requires at least one photo before completion.',
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.closeOpenTimeEntries(tx, id, userId);

      if (dto?.photoDocumentIds?.length) {
        await tx.document.updateMany({
          where: { id: { in: dto.photoDocumentIds } },
          data: {
            productionOrderId: task.productionOrderId,
            category: `TASK_PHOTO:${id}`,
            visibility: 'CUSTOMER_VISIBLE',
          },
        });
      } else if (task.stageDefinition?.requiresPhotos) {
        await tx.document.updateMany({
          where: {
            productionOrderId: task.productionOrderId,
            category: `TASK_PHOTO:${id}`,
            archivedAt: null,
          },
          data: { visibility: 'CUSTOMER_VISIBLE' },
        });
      }

      const row = await tx.productionTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          progressPercent: 100,
          actualCompletion: new Date(),
          ...(dto?.notes ? { notes: dto.notes } : {}),
        },
        include: {
          stageDefinition: true,
          productionOrder: {
            select: { id: true, number: true, progressPercent: true, status: true },
          },
        },
      });

      // Completes stage when all tasks done, unlocks next READY stages, rolls up PO %.
      await this.pipeline.onTaskComplete(task.productionOrderId, task.stageInstanceId, tx);

      const po = await tx.productionOrder.findUnique({
        where: { id: task.productionOrderId },
        select: { id: true, number: true, progressPercent: true, status: true },
      });

      return {
        ...row,
        productionOrder: po ?? row.productionOrder,
        orderProgressPercent: po?.progressPercent ?? row.productionOrder.progressPercent,
        replayed: false as const,
      };
    });

    if (dto?.idempotencyKey) {
      await this.idempotency.put({
        scope,
        key: dto.idempotencyKey,
        userId,
        entityId: id,
        response: updated,
      });
    }

    const poStatus = updated.productionOrder?.status;
    const salesOrderId = (
      await this.prisma.productionOrder.findUnique({
        where: { id: task.productionOrderId },
        select: { salesOrderId: true },
      })
    )?.salesOrderId;

    if (poStatus === 'COMPLETED' && salesOrderId) {
      await this.invoices.ensureFromSalesOrder(salesOrderId, userId).catch(() => {});
    }

    this.notifyScheduleLifecycle(id, 'complete');

    return updated;
  }
}
