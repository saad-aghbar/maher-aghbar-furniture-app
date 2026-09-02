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
import { ProductionInventoryService } from '../production/production-inventory.service';
import { MaterialUsageService } from '../production/material-usage.service';
import { WipKitService } from '../production/wip-kit.service';
import { pieceLabelsFromMetadata } from '../production/piece-labels';
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
import { intervalsOverlap } from '../production/worker-recommend';
import {
  isPrereqLockedForWorker,
  workerFloorOpenClauses,
} from '../production/worker-task-visibility';

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
    private readonly productionInventory: ProductionInventoryService,
    private readonly materialUsage: MaterialUsageService,
    private readonly wipKits: WipKitService,
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
      const openBase: Prisma.ProductionTaskWhereInput = {
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
      };
      if (forceMine) {
        // Hide locked/waiting + non-floor stages — match worker home / Tasks tab.
        statusWhere = { AND: workerFloorOpenClauses() };
      } else {
        statusWhere = openBase;
      }
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
      if (!canSeeAll && isPrereqLockedForWorker(task)) {
        throw new ForbiddenException({
          code: 'STAGE_LOCKED',
          message: 'This task is not available until previous stages are completed.',
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

    const snapNode = task.stageInstanceId
      ? await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
          where: { stageInstanceId: task.stageInstanceId },
          select: {
            inventoryTracking: true,
            requiresPhotos: true,
            expectedPieceCount: true,
          },
        })
      : null;
    const producesSemiFinished = snapNode
      ? WipKitService.producesWipKit(snapNode)
      : false;
    const expectedPieceCount =
      producesSemiFinished && snapNode && Number(snapNode.expectedPieceCount) > 0
        ? Math.floor(Number(snapNode.expectedPieceCount))
        : producesSemiFinished
          ? 1
          : null;
    const requiresPhotos =
      snapNode?.requiresPhotos ?? task.stageDefinition?.requiresPhotos ?? false;

    const payload = {
      ...task,
      timing,
      photos,
      attachments,
      productImageUrl: productImageUrls[0] ?? null,
      productImageUrls,
      factoryOrderNumber: task.productionOrder.number,
      salesOrderNumber: task.productionOrder.salesOrder?.number ?? null,
      producesSemiFinished,
      expectedPieceCount,
      requiresPhotos,
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
    stageInstanceId?: string | null;
    stageDefinition: { dependsOnCodes: string[]; code: string } | null;
    stageInstance: { status: string } | null;
  }) {
    const fallback = task.stageDefinition?.dependsOnCodes ?? [];
    const met = task.stageInstanceId
      ? await this.pipeline.arePrereqsMetForInstance(
          task.productionOrderId,
          task.stageInstanceId,
          fallback,
        )
      : await this.pipeline.arePrereqsMet(task.productionOrderId, fallback);
    if (!met) {
      const depends = task.stageInstanceId
        ? await this.pipeline.resolveDependsOnCodes(
            task.productionOrderId,
            task.stageInstanceId,
            fallback,
          )
        : fallback;
      throw new BadRequestException({
        code: 'STAGE_LOCKED',
        message: `Stage ${task.stageDefinition?.code ?? 'unknown'} is locked until prerequisites are completed: ${depends.join(', ')}`,
      });
    }
  }

  async assign(id: string, dto: AssignTaskDto, permissions: string[] = [], actorUserId?: string) {
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

    // Reassign allowed only pre-start (PO not yet on the floor).
    if (
      task.assignedEmployeeId &&
      task.assignedEmployeeId !== dto.employeeId &&
      (orderStatus === 'IN_PROGRESS' || orderStatus === 'QUALITY_CHECK' || orderStatus === 'READY_FOR_PACKAGING')
    ) {
      throw new BadRequestException({
        code: 'REASSIGN_LOCKED',
        message:
          'Cannot reassign after the production order is on the floor. Pause or complete the stage first.',
      });
    }

    const employee = await this.prisma.user.findFirst({
      where: { id: dto.employeeId, isActive: true, archivedAt: null },
      include: {
        roles: { include: { role: { select: { kind: true } } } },
        workerSkills: {
          where: { isActive: true },
          select: { stageDefinitionId: true },
        },
      },
    });
    if (!employee) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Employee not found.' });
    }
    const isProductionWorker = employee.roles.some((r) => r.role.kind === 'PRODUCTION_WORKER');
    if (!isProductionWorker) {
      throw new BadRequestException({
        code: 'WORKER_NOT_ELIGIBLE',
        message: 'Only active production workers can be assigned to floor stages.',
      });
    }
    const stageDefinitionId = task.stageDefinitionId ?? task.stageDefinition?.id ?? null;
    if (stageDefinitionId) {
      const skillCount = await this.prisma.workerSkill.count({
        where: { stageDefinitionId, isActive: true },
      });
      if (skillCount > 0) {
        const hasSkill = employee.workerSkills.some((s) => s.stageDefinitionId === stageDefinitionId);
        if (!hasSkill) {
          throw new BadRequestException({
            code: 'WORKER_SKILL_REQUIRED',
            message: 'Worker does not have the required skill for this stage.',
          });
        }
      }
    }

    let plannedStart: Date | null = null;
    let plannedCompletion: Date | null = null;
    if (dto.plannedStart) {
      plannedStart = new Date(dto.plannedStart);
      if (Number.isNaN(plannedStart.getTime())) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'plannedStart must be a valid ISO datetime.',
        });
      }
    }
    if (dto.plannedCompletion) {
      plannedCompletion = new Date(dto.plannedCompletion);
      if (Number.isNaN(plannedCompletion.getTime())) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'plannedCompletion must be a valid ISO datetime.',
        });
      }
    }
    if (plannedStart && !plannedCompletion) {
      throw new BadRequestException({
        code: 'DATE_INCOMPLETE',
        message: 'When plannedStart is set, plannedCompletion is required.',
      });
    }
    if (plannedStart && plannedCompletion && plannedStart.getTime() >= plannedCompletion.getTime()) {
      throw new BadRequestException({
        code: 'DATE_INVALID',
        message: 'plannedStart must be before plannedCompletion.',
      });
    }

    // Assign is planning (who + a window), not starting the stage. If the chosen
    // window sits before a predecessor, slide it to start when that predecessor ends.
    if (plannedStart && task.stageDefinition?.dependsOnCodes?.length) {
      const depCodes = task.stageDefinition.dependsOnCodes;
      const siblings = await this.prisma.productionTask.findMany({
        where: {
          productionOrderId: task.productionOrderId,
          id: { not: task.id },
          status: { not: 'CANCELLED' },
          isRework: false,
          stageDefinition: { code: { in: depCodes } },
        },
        select: {
          id: true,
          plannedCompletion: true,
          plannedStart: true,
          stageDefinition: { select: { code: true, nameEn: true } },
        },
      });
      let latestPredEnd: Date | null = null;
      for (const pred of siblings) {
        const predEnd = pred.plannedCompletion ?? pred.plannedStart;
        if (!predEnd) continue;
        if (!latestPredEnd || predEnd.getTime() > latestPredEnd.getTime()) {
          latestPredEnd = predEnd;
        }
      }
      if (latestPredEnd && plannedStart.getTime() < latestPredEnd.getTime()) {
        const durationMs = plannedCompletion
          ? Math.max(30 * 60_000, plannedCompletion.getTime() - plannedStart.getTime())
          : 2 * 60 * 60_000;
        plannedStart = new Date(latestPredEnd.getTime());
        plannedCompletion = new Date(plannedStart.getTime() + durationMs);
      }
    }

    // Worker overlap conflict vs other open tasks + schedule allocations.
    const windowStart = plannedStart;
    const windowEnd = plannedCompletion;
    if (windowStart && windowEnd) {
      const openStatuses = [
        'NOT_STARTED',
        'READY',
        'IN_PROGRESS',
        'PAUSED',
        'BLOCKED',
        'READY_FOR_INSPECTION',
      ] as const;
      const otherTasks = await this.prisma.productionTask.findMany({
        where: {
          assignedEmployeeId: dto.employeeId,
          id: { not: task.id },
          status: { in: [...openStatuses] },
          productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          OR: [
            {
              plannedStart: { not: null },
              plannedCompletion: { not: null },
            },
            { plannedCompletion: { not: null }, plannedStart: null },
          ],
        },
        select: {
          id: true,
          name: true,
          plannedStart: true,
          plannedCompletion: true,
          productionOrder: { select: { number: true } },
        },
      });
      const conflicts: Array<{
        kind: 'TASK' | 'ALLOCATION';
        id: string;
        label: string;
        start: string;
        end: string;
      }> = [];
      for (const other of otherTasks) {
        const oEnd = other.plannedCompletion;
        if (!oEnd) continue;
        const oStart = other.plannedStart ?? new Date(oEnd.getTime() - 60 * 60 * 1000);
        if (intervalsOverlap(windowStart, windowEnd, oStart, oEnd)) {
          conflicts.push({
            kind: 'TASK',
            id: other.id,
            label: `${other.productionOrder?.number ?? ''} ${other.name}`.trim(),
            start: oStart.toISOString(),
            end: oEnd.toISOString(),
          });
        }
      }
      const allocations = await this.prisma.scheduleAllocation.findMany({
        where: {
          employeeId: dto.employeeId,
          productionTaskId: { not: task.id },
          schedule: { status: { in: ['APPROVED', 'PROPOSED'] } },
          plannedStart: { lt: windowEnd },
          plannedEnd: { gt: windowStart },
        },
        select: {
          id: true,
          plannedStart: true,
          plannedEnd: true,
          productionTask: { select: { name: true, number: true } },
        },
        take: 20,
      });
      for (const a of allocations) {
        if (intervalsOverlap(windowStart, windowEnd, a.plannedStart, a.plannedEnd)) {
          conflicts.push({
            kind: 'ALLOCATION',
            id: a.id,
            label: a.productionTask?.name ?? a.productionTask?.number ?? 'Scheduled work',
            start: a.plannedStart.toISOString(),
            end: a.plannedEnd.toISOString(),
          });
        }
      }

      if (conflicts.length > 0) {
        const canOverride =
          dto.overrideConflict === true && permissions.includes('schedule.override');
        if (!canOverride) {
          const durationMs = Math.max(
            30 * 60_000,
            windowEnd.getTime() - windowStart.getTime(),
          );
          const latestEndMs = Math.max(
            ...conflicts.map((c) => new Date(c.end).getTime()),
            windowStart.getTime(),
          );
          const suggestedStart = new Date(latestEndMs);
          const suggestedEnd = new Date(latestEndMs + durationMs);
          throw new ConflictException({
            code: 'WORKER_SCHEDULE_CONFLICT',
            message: 'Worker has overlapping work in this time window.',
            conflicts,
            suggestedWindow: {
              plannedStart: suggestedStart.toISOString(),
              plannedCompletion: suggestedEnd.toISOString(),
            },
            overrideRequires: 'schedule.override',
          });
        }
      }
    }

    const updated = await this.prisma.productionTask.update({
      where: { id },
      data: {
        assignedEmployeeId: dto.employeeId,
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(plannedStart ? { plannedStart } : {}),
        ...(plannedCompletion ? { plannedCompletion } : {}),
        ...(dto.estimatedMinutes != null ? { estimatedMinutes: dto.estimatedMinutes } : {}),
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        stageDefinition: true,
        productionOrder: { select: { id: true, number: true, releasedToFactoryAt: true } },
      },
    });

    // Post–Release to factory: Change worker / dates are explicit actions — audit them.
    if (updated.productionOrder?.releasedToFactoryAt) {
      await this.prisma.auditEvent.create({
        data: {
          userId: actorUserId ?? null,
          action: 'production-task.change-assignment',
          entityType: 'ProductionTask',
          entityId: id,
          newValues: {
            productionOrderId: updated.productionOrder.id,
            assignedEmployeeId: dto.employeeId,
            plannedStart: plannedStart?.toISOString() ?? null,
            plannedCompletion: plannedCompletion?.toISOString() ?? null,
            previousEmployeeId: task.assignedEmployeeId,
          },
        },
      }).catch(() => undefined);
    }

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

    if (!task.productionOrder?.releasedToFactoryAt) {
      const poStatus = String(task.productionOrder?.status ?? '').toUpperCase();
      const legacyOnFloor =
        Boolean(task.productionOrder?.actualStartDate) ||
        ['IN_PROGRESS', 'ON_HOLD', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(
          poStatus,
        );
      if (!legacyOnFloor) {
        throw new BadRequestException({
          code: 'NOT_RELEASED_TO_FACTORY',
          message:
            'This order has not been released to the factory yet. Finish the production plan and release it first.',
        });
      }
    }

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

    await this.productionInventory.assertStageInventoryReady({
      productionOrderId: task.productionOrderId,
      stageInstanceId: task.stageInstanceId,
    });

    const claim = await this.wipKits.claimRequirementsForTask(id);
    if (claim.required && !claim.allReceived && !claim.allClaimed) {
      throw new BadRequestException({
        code: 'WIP_CLAIM_REQUIRED',
        message:
          'Receive the semi-finished work from the previous stage before starting this task.',
        unclaimedKitIds: claim.unclaimed.map((k) => k.id),
        lines: claim.lines?.map((l) => ({
          fromStageCode: l.fromStageCode,
          statusKey: l.statusKey,
          outstanding: l.outstanding,
        })),
      });
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

  async listMaterialUsage(id: string, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    return this.materialUsage.ensureExpectedLines(id);
  }

  async identifyMaterialUsage(
    id: string,
    userId: string,
    permissions: string[],
    code: string,
  ) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    return this.materialUsage.identifyScan(id, code);
  }

  async saveMaterialUsage(
    id: string,
    userId: string,
    permissions: string[],
    lines: Array<{
      inventoryItemId: string;
      actualQty: number;
      returnedQty?: number;
      scrapQty?: number;
      scrapReason?: string | null;
      reasonNotes?: string | null;
      isExtra?: boolean;
      sku?: string;
      issueWarehouseId?: string | null;
      returnWarehouseId?: string | null;
    }>,
  ) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (!permissions.includes('production.material-usage.record') && !permissions.includes('production-task.update-any')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Missing production.material-usage.record permission.',
      });
    }
    return this.materialUsage.recordLines(id, userId, lines);
  }

  async complete(
    id: string,
    userId: string,
    permissions: string[],
    dto?: {
      notes?: string;
      photoDocumentIds?: string[];
      idempotencyKey?: string;
      qtyDelta?: number;
      /** Piece 9 — packaging expected labels the worker confirmed (manual N of N). */
      confirmedPackageLabels?: string[];
      packagingProblem?: boolean;
    },
  ) {
    const scope = `task.complete:${id}`;

    if (dto?.idempotencyKey) {
      const cached = await this.idempotency.get(scope, dto.idempotencyKey);
      if (cached != null) return cached;
    }

    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);

    // Piece 9: Inspection is QUALITY — floor complete must not bypass QC submit.
    const executionKind = String(task.stageDefinition?.executionKind ?? '').toUpperCase();
    const stageCode = String(task.stageDefinition?.code ?? '').toUpperCase();
    if (executionKind === 'QUALITY' || stageCode === 'INSPECTION') {
      throw new BadRequestException({
        code: 'USE_QUALITY_SUBMIT',
        message:
          'Inspection is a quality gate. Pass or report a problem from the inspection screen — do not use floor Complete.',
      });
    }

    if (dto?.packagingProblem && (stageCode === 'PACKAGING' || stageCode === 'PACK')) {
      throw new BadRequestException({
        code: 'PACKAGING_PROBLEM_OPEN',
        message: 'Resolve the packaging problem before completing. Finished goods were not posted.',
      });
    }

    // Piece 9: packaging must confirm expected packages before FIN.
    if (stageCode === 'PACKAGING' || stageCode === 'PACK') {
      const snapNode = task.stageInstanceId
        ? await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
            where: { stageInstanceId: task.stageInstanceId },
          })
        : null;
      const labels = pieceLabelsFromMetadata(snapNode?.metadata);
      const expected =
        labels.length > 0
          ? labels.map((l) => l.nameEn)
          : Number(snapNode?.expectedPieceCount) > 0
            ? Array.from(
                { length: Math.floor(Number(snapNode?.expectedPieceCount)) },
                (_, i) => `Package ${i + 1}`,
              )
            : [];
      if (expected.length) {
        const confirmed = (dto?.confirmedPackageLabels ?? []).map((s) => String(s).trim());
        const missing = expected.filter(
          (e) => !confirmed.some((c) => c.toLowerCase() === e.toLowerCase()),
        );
        if (missing.length) {
          throw new BadRequestException({
            code: 'PACKAGES_INCOMPLETE',
            message: `Confirm all packages before completing packaging (${confirmed.length} of ${expected.length}).`,
            expected,
            confirmed,
            missing,
          });
        }
      }
    }

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

    {
      const claim = await this.wipKits.claimRequirementsForTask(id);
      if (claim.required && !claim.allReceived && !claim.allClaimed) {
        throw new BadRequestException({
          code: 'WIP_RECEIVE_REQUIRED',
          message: 'Some required pieces have not been received.',
          lines: claim.lines?.map((l) => ({
            fromStageCode: l.fromStageCode,
            fromStageNameEn: l.fromStageNameEn,
            received: l.received,
            expected: l.expected,
            statusKey: l.statusKey,
          })),
        });
      }
    }

    {
      const snapNode = task.stageInstanceId
        ? await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
            where: { stageInstanceId: task.stageInstanceId },
          })
        : null;
      const photosRequired =
        snapNode?.requiresPhotos ?? task.stageDefinition?.requiresPhotos ?? false;
      if (photosRequired) {
        const expectedPieces =
          snapNode && Number(snapNode.expectedPieceCount) > 0
            ? Math.floor(Number(snapNode.expectedPieceCount))
            : 1;
        const linked = dto?.photoDocumentIds?.length
          ? dto.photoDocumentIds.length
          : await this.prisma.document.count({
              where: {
                productionOrderId: task.productionOrderId,
                category: `TASK_PHOTO:${id}`,
                archivedAt: null,
              },
            });

        // Produce-semi: soft target — ≥1 kit piece with photo (or legacy TASK_PHOTO).
        if (snapNode && WipKitService.producesWipKit(snapNode)) {
          const kit = task.stageInstanceId
            ? await this.prisma.wipKit.findUnique({
                where: { stageInstanceId: task.stageInstanceId },
                include: {
                  pieces: { select: { id: true, photoDocumentId: true } },
                },
              })
            : null;
          const piecePhotos =
            kit?.pieces.filter((p) => Boolean(p.photoDocumentId)).length ?? 0;
          if (piecePhotos < 1 && linked < 1) {
            throw new BadRequestException({
              code: 'WIP_PIECES_REQUIRED',
              message:
                'Add at least one semi-finished piece with a photo before completion.',
              expectedPieceCount: expectedPieces,
              photoCount: Math.max(piecePhotos, linked),
            });
          }
        } else if (linked < expectedPieces) {
          throw new BadRequestException({
            code: 'PHOTOS_REQUIRED',
            message: `This stage requires at least ${expectedPieces} photo(s) before completion.`,
            expectedPieceCount: expectedPieces,
            photoCount: linked,
          });
        }
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

      const poQty = Number(task.productionOrder?.quantity) || 1;
      const targetQty = Number(task.targetQty) > 0 ? Number(task.targetQty) : poQty;
      const priorCompleted = Number(task.completedQty) || 0;
      const remainingQty = Math.max(0, targetQty - priorCompleted);
      if (remainingQty <= 0) {
        throw new ConflictException({
          code: 'TASK_QTY_COMPLETE',
          message: 'This task already has its full quantity posted.',
        });
      }
      const requested =
        dto?.qtyDelta != null && Number.isFinite(Number(dto.qtyDelta))
          ? Number(dto.qtyDelta)
          : remainingQty;
      if (!(requested > 0)) {
        throw new BadRequestException({
          code: 'INVALID_QTY_DELTA',
          message: 'qtyDelta must be a positive number.',
        });
      }
      const qtyDelta = Math.min(requested, remainingQty);
      const completedQtyAfter = priorCompleted + qtyDelta;
      const fullyDone = completedQtyAfter + 1e-9 >= targetQty;
      const progressPercent = Math.min(
        100,
        Math.max(1, Math.round((completedQtyAfter / Math.max(targetQty, 1e-9)) * 100)),
      );

      let skipRawConsume = false;
      if (await this.materialUsage.hasUsageRows(id, tx)) {
        const scale = targetQty > 0 ? qtyDelta / targetQty : 1;
        await this.materialUsage.finalizeForTask({
          taskId: id,
          userId,
          tx,
          idempotencyKey: `usage-finalize:${id}:${completedQtyAfter}`,
          qtyScale: scale,
          markFinal: fullyDone,
        });
        // Usage rows own inventory posting — never also run blind BOM/stage consume.
        skipRawConsume = true;
      }

      await this.productionInventory.onStageQtyProgress({
        productionOrderId: task.productionOrderId,
        stageInstanceId: task.stageInstanceId,
        userId,
        tx,
        qtyDelta,
        taskId: id,
        completedQtyAfter,
        skipRawConsume,
      });

      if (fullyDone && task.stageInstanceId) {
        const snapNode = await tx.productionOrderWorkflowSnapshotNode.findFirst({
          where: { stageInstanceId: task.stageInstanceId },
        });
        if (snapNode && WipKitService.producesWipKit(snapNode)) {
          const nextEdges = await tx.productionOrderWorkflowSnapshotEdge.findMany({
            where: { fromSnapshotNodeId: snapNode.id },
            select: { toSnapshotNodeId: true },
          });
          const usages = await tx.productionTaskMaterialUsage.findMany({
            where: { taskId: id },
            select: { sku: true, expectedQty: true, actualQty: true, varianceQty: true, isExtra: true },
          });
          const overage = usages
            .filter(
              (u) =>
                u.isExtra ||
                (u.actualQty != null &&
                  u.expectedQty != null &&
                  Number(u.actualQty) > Number(u.expectedQty) + 1e-9),
            )
            .map((u) => {
              const actual = Number(u.actualQty ?? 0);
              const expected = Number(u.expectedQty ?? 0);
              return `${u.sku}: expected ${expected}, actual ${actual}`;
            });
          await this.wipKits.registerFromTaskComplete({
            tx,
            productionOrderId: task.productionOrderId,
            stageInstanceId: task.stageInstanceId,
            taskId: id,
            userId,
            snapshotNode: {
              id: snapNode.id,
              inventoryTracking: snapNode.inventoryTracking,
              requiresPhotos: snapNode.requiresPhotos,
              expectedPieceCount: snapNode.expectedPieceCount,
              outputQtyPerUnit: snapNode.outputQtyPerUnit,
              metadata: snapNode.metadata,
            },
            photoDocumentIds: dto?.photoDocumentIds ?? [],
            nextSnapshotNodeIds: nextEdges.map((e) => e.toSnapshotNodeId),
            warehouseId: snapNode.defaultWarehouseId,
            materialOverageNotes: overage.length ? overage.join('; ') : null,
          });
        }

        if (snapNode?.consumesSemiFinished) {
          await this.wipKits.markConsumedForStage({
            tx,
            productionOrderId: task.productionOrderId,
            consumingStageInstanceId: task.stageInstanceId,
          });
        }
      }

      const row = await tx.productionTask.update({
        where: { id },
        data: {
          targetQty,
          completedQty: completedQtyAfter,
          progressPercent: fullyDone ? 100 : progressPercent,
          status: fullyDone ? 'COMPLETED' : 'IN_PROGRESS',
          actualCompletion: fullyDone ? new Date() : undefined,
          ...(dto?.notes ? { notes: dto.notes } : {}),
        },
        include: {
          stageDefinition: true,
          productionOrder: {
            select: { id: true, number: true, progressPercent: true, status: true, quantity: true },
          },
        },
      });

      if (fullyDone) {
        // Completes stage when all tasks done, unlocks next READY stages, rolls up PO %.
        await this.pipeline.onTaskComplete(task.productionOrderId, task.stageInstanceId, tx);
        await this.productionInventory.onStageTaskComplete({
          productionOrderId: task.productionOrderId,
          stageInstanceId: task.stageInstanceId,
          userId,
          tx,
        });
      }

      const po = await tx.productionOrder.findUnique({
        where: { id: task.productionOrderId },
        select: { id: true, number: true, progressPercent: true, status: true },
      });

      return {
        ...row,
        productionOrder: po ?? row.productionOrder,
        orderProgressPercent: po?.progressPercent ?? row.productionOrder.progressPercent,
        qtyDelta,
        completedQty: completedQtyAfter,
        targetQty,
        remainingQty: Math.max(0, targetQty - completedQtyAfter),
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

    this.notifyScheduleLifecycle(id, 'complete');

    return updated;
  }
}
