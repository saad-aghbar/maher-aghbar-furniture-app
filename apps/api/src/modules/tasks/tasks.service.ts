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
import {
  expectedPackageLabelList,
  loadIncomingPiecesForInspection,
  resolveExpectedPackages,
} from '../quality/prior-stage-packages';
import { InvoicesService } from '../invoices/invoices.service';
import {
  AssignTaskDto,
  ListTasksDto,
  ResolveBlockerDto,
  TaskBlockDto,
  TaskCarryOverDto,
  TaskProgressDto,
} from './dto/task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { PlacementService } from '../scheduling/placement.service';
import { ReturnPieceService } from '../contracts/return-piece.service';
import { ensureTaskTimeEntry } from './ensure-time-entry';
import {
  buildTaskTimingSummary,
  closedSecondsFromTimeEntries,
} from '../../common/helpers/task-timing.util';
import {
  isPrereqLockedForWorker,
  workerAssignedRemainingOrdersWhere,
  workerAssignedRemainingTaskWhere,
  workerFloorOpenClauses,
} from '../production/worker-task-visibility';
import {
  buildWorkerOrderLane,
  orderMatchesSegment,
  parseMyOrderSegment,
  remainingTasksForSegment,
  summarizeAssignedOrderTasks,
  summarizeLane,
  workerOrderMatchesSearch,
  groupMyOrdersBySalesOrder,
  type MyOrderSegment,
  type SnapshotLaneInput,
} from './worker-order-workflow';
import { completedDateWindow, completedOnFactoryDaysWhere } from './completed-date-filter';
import { DEFAULT_FACTORY_TIMEZONE } from '../production/production-day-lens';
import {
  resolveAssignStageMinutes,
  shouldWriteBackStageTime,
} from './assign-stage-time';

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
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
    @Optional() private readonly returnPieces?: ReturnPieceService,
    @Optional() placement?: PlacementService,
  ) {
    this.placement = placement ?? new PlacementService(this.prisma);
  }

  private async resolveFactoryTimezone(): Promise<string> {
    const row = await this.prisma.factoryCalendar.findFirst({
      where: { isDefault: true },
      select: { timezone: true },
    });
    return row?.timezone?.trim() || DEFAULT_FACTORY_TIMEZONE;
  }

  private readonly placement: PlacementService;

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
        // Home / open task rows: only floor-actionable work (released + unlocked).
        // My Tasks orders use listMyOrders — remaining assignedEmployeeId work.
        statusWhere = { AND: workerFloorOpenClauses() };
      } else {
        statusWhere = openBase;
      }
    }

    const completedWindow =
      query.completedFrom || query.completedTo
        ? completedDateWindow(
            query.completedFrom,
            query.completedTo,
            await this.resolveFactoryTimezone(),
          )
        : null;
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

    const searchOr: Prisma.ProductionTaskWhereInput[] | undefined = q
      ? [
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
          {
            productionOrder: {
              variantLabel: { contains: q, mode: 'insensitive' },
            },
          },
          {
            productionOrder: {
              variantSku: { contains: q, mode: 'insensitive' },
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
        ]
      : undefined;
    const completedWhere = completedWindow ? completedOnFactoryDaysWhere(completedWindow) : undefined;
    const dateAndSearch: Prisma.ProductionTaskWhereInput =
      completedWhere && searchOr
        ? { AND: [completedWhere, { OR: searchOr }] }
        : completedWhere
          ? completedWhere
          : searchOr
            ? { OR: searchOr }
            : {};

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
      ...dateAndSearch,
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
              salesOrderId: true,
              salesOrderLineId: true,
              variantLabel: true,
              variantSku: true,
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
        salesOrderId:
          task.productionOrder.salesOrderId ?? task.productionOrder.salesOrder?.id ?? null,
        salesOrderLineId: task.productionOrder.salesOrderLineId ?? null,
        variantLabel: task.productionOrder.variantLabel ?? null,
        variantSku: task.productionOrder.variantSku ?? null,
      };
      if (canSeeAll) return row;
      const { progressPercent: _omit, ...safe } = row;
      return safe;
    });

    return { data: mapped, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  /** Orders where this worker has remaining assigned work, optionally filtered. */
  async listMyOrders(userId: string, segment: MyOrderSegment | string = 'open', q?: string) {
    const assignedRemaining = workerAssignedRemainingTaskWhere(userId);
    const needle = q?.trim() ?? '';
    const searching = needle.length > 0;
    const timezone = await this.resolveFactoryTimezone();
    const orders = await this.prisma.productionOrder.findMany({
      where: workerAssignedRemainingOrdersWhere(userId),
      select: {
        id: true,
        number: true,
        status: true,
        quantity: true,
        productDescription: true,
        salesOrderId: true,
        salesOrderLineId: true,
        variantLabel: true,
        variantSku: true,
        plannedCompletionDate: true,
        requiredDeliveryDate: true,
        priority: true,
        product: {
          select: { id: true, imageUrl: true, nameEn: true, nameAr: true, nameHe: true },
        },
        salesOrder: {
          select: {
            id: true,
            number: true,
            externalOrderNumber: true,
            customer: {
              select: {
                code: true,
                name: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                companyName: true,
              },
            },
          },
        },
        tasks: {
          where: assignedRemaining,
          select: {
            id: true,
            status: true,
            plannedStart: true,
            plannedCompletion: true,
            stageInstance: { select: { status: true } },
            stageDefinition: {
              select: { code: true, nameEn: true, nameAr: true, nameHe: true },
            },
          },
        },
      },
      orderBy: [{ plannedCompletionDate: 'asc' }, { createdAt: 'desc' }],
      ...(searching ? {} : { take: 80 }),
    });

    const now = new Date();
    const parsed = parseMyOrderSegment(typeof segment === 'string' ? segment : 'open');
    const visible = orders.filter((order) => {
      const deadline = order.plannedCompletionDate ?? order.requiredDeliveryDate;
      if (searching) {
        if (!orderMatchesSegment('open', order.tasks, deadline, now, timezone)) return false;
        return workerOrderMatchesSearch(order, needle);
      }
      return orderMatchesSegment(parsed, order.tasks, deadline, now, timezone);
    });

    const items = visible.map((order) => {
      const deadline = order.plannedCompletionDate ?? order.requiredDeliveryDate;
      const scoped = remainingTasksForSegment(
        searching ? 'open' : parsed,
        order.tasks,
        deadline,
        now,
        timezone,
      );
      const { myTaskCount, actionableCount, blockedCount } = summarizeAssignedOrderTasks(scoped);
      return {
        id: order.id,
        number: order.number,
        salesOrderId: order.salesOrderId ?? order.salesOrder?.id ?? null,
        salesOrderLineId: order.salesOrderLineId ?? null,
        salesOrderNumber: order.salesOrder?.number ?? null,
        variantLabel: order.variantLabel ?? null,
        variantSku: order.variantSku ?? null,
        externalOrderNumber: order.salesOrder?.externalOrderNumber ?? null,
        status: order.status,
        quantity: order.quantity,
        productDescription: order.productDescription,
        product: order.product,
        productImageUrl: order.product?.imageUrl?.trim() || null,
        dealer: order.salesOrder?.customer ?? null,
        assignedStages: scoped.map((task) => ({
          code: task.stageDefinition?.code ?? '',
          nameEn: task.stageDefinition?.nameEn ?? null,
          nameAr: task.stageDefinition?.nameAr ?? null,
          nameHe: task.stageDefinition?.nameHe ?? null,
        })),
        priority: order.priority,
        deadline,
        myTaskCount,
        actionableCount,
        blockedCount,
      };
    });
    const grouped = groupMyOrdersBySalesOrder(items);
    return { orders: grouped, data: grouped };
  }

  async getMyOrderWorkflow(productionOrderId: string, userId: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: {
        id: productionOrderId,
        archivedAt: null,
        tasks: { some: { assignedEmployeeId: userId, status: { not: TaskStatus.CANCELLED } } },
      },
      include: {
        product: { select: { id: true, imageUrl: true, nameEn: true, nameAr: true, nameHe: true } },
        salesOrder: { select: { id: true, number: true } },
        stages: { select: { id: true, status: true } },
        workflowSnapshot: {
          include: {
            nodes: {
              include: {
                stageDefinition: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
            edges: true,
          },
        },
        tasks: {
          include: {
            stageDefinition: { select: { code: true, nameEn: true, nameAr: true } },
            stageInstance: { select: { id: true, status: true } },
            timeEntries: {
              orderBy: { startedAt: 'desc' as const },
              select: { startedAt: true, endedAt: true },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found.' });
    }

    const snapshot = order.workflowSnapshot;
    const nodes = snapshot?.nodes ?? [];
    const edges = snapshot?.edges ?? [];
    const instanceById = new Map(order.stages.map((s) => [s.id, s]));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const predsByNode = new Map<
      string,
      { ids: string[]; codes: string[]; names: string[]; unfinishedNames: string[] }
    >();
    for (const edge of edges) {
      const from = nodeById.get(edge.fromSnapshotNodeId);
      const to = nodeById.get(edge.toSnapshotNodeId);
      if (!from || !to) continue;
      const name = from.nameEnSnapshot || from.stageDefinition?.nameEn || from.stageCode;
      const slot = predsByNode.get(to.id) ?? {
        ids: [],
        codes: [],
        names: [],
        unfinishedNames: [],
      };
      slot.ids.push(from.id);
      slot.codes.push(from.stageCode);
      slot.names.push(name);
      const fromStatus = from.stageInstanceId
        ? instanceById.get(from.stageInstanceId)?.status
        : undefined;
      const done = fromStatus === 'COMPLETED' || Boolean(from.isSkipped);
      if (!done) slot.unfinishedNames.push(name);
      predsByNode.set(to.id, slot);
    }

    const laneInputs: SnapshotLaneInput[] = [];
    for (const node of nodes) {
      const task = order.tasks.find(
        (t) =>
          t.stageInstanceId === node.stageInstanceId ||
          t.stageDefinitionId === node.stageDefinitionId,
      );
      const assignedToWorker = task?.assignedEmployeeId === userId;
      const preds = predsByNode.get(node.id) ?? {
        ids: [],
        codes: [],
        names: [],
        unfinishedNames: [],
      };
      const predComplete = preds.unfinishedNames.length === 0;

      let needsReceive = false;
      let receiveFromStageName: string | null = preds.names[0] ?? null;
      if (assignedToWorker && task && !isPrereqLockedForWorker(task) && node.consumesSemiFinished) {
        const claim = await this.wipKits.claimRequirementsForTask(task.id);
        needsReceive = Boolean(claim.required && !claim.allReceived);
        const blocking = claim.lines?.find((l) => l.statusKey !== 'RECEIVED');
        receiveFromStageName = blocking?.fromStageNameEn ?? receiveFromStageName;
      }

      const nameEn = node.nameEnSnapshot || node.stageDefinition?.nameEn || node.stageCode;
      const nameAr = node.nameArSnapshot || node.stageDefinition?.nameAr || null;
      const nameHe = node.stageDefinition?.nameHe ?? null;

      laneInputs.push({
        id: node.id,
        sortOrder: node.sortOrder,
        stageCode: node.stageCode,
        stageName: nameEn,
        nameEn,
        nameAr,
        nameHe,
        stageStatus:
          (node.stageInstanceId
            ? instanceById.get(node.stageInstanceId)?.status
            : undefined) ?? 'PENDING',
        assignedToWorker: Boolean(assignedToWorker && task),
        task: task
          ? {
              id: task.id,
              status: task.status,
              plannedStart: task.plannedStart,
              plannedCompletion: task.plannedCompletion,
              stageInstanceStatus: task.stageInstance?.status ?? null,
              estimatedMinutes: task.estimatedMinutes,
              actualMinutes: task.actualMinutes,
              timeEntries: task.timeEntries,
            }
          : null,
        predecessorIds: preds.ids,
        predecessorCodes: preds.codes,
        predecessorNames: preds.names,
        unfinishedPredecessorNames: preds.unfinishedNames,
        predecessorComplete: predComplete,
        needsReceive,
        receiveFromStageName,
      });
    }

    const lane = buildWorkerOrderLane(laneInputs);
    const counts = summarizeLane(lane);
    return {
      id: order.id,
      number: order.number,
      salesOrderId: order.salesOrderId ?? order.salesOrder?.id ?? null,
      salesOrderLineId: order.salesOrderLineId ?? null,
      salesOrderNumber: order.salesOrder?.number ?? null,
      variantLabel: order.variantLabel ?? null,
      variantSku: order.variantSku ?? null,
      quantity: order.quantity,
      productDescription: order.productDescription,
      product: order.product,
      productImageUrl: order.product?.imageUrl?.trim() || null,
      priority: order.priority,
      deadline: order.plannedCompletionDate ?? order.requiredDeliveryDate,
      ...counts,
      lane,
    };
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
            returnRequestId: true,
            returnPieceId: true,
            originType: true,
            salesOrderId: true,
            salesOrderLineId: true,
            variantLabel: true,
            variantSku: true,
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
            instructionsAr: true,
            instructionsEn: true,
            instructionsHe: true,
            notes: true,
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
      salesOrderId:
        task.productionOrder.salesOrderId ?? task.productionOrder.salesOrder?.id ?? null,
      salesOrderLineId: task.productionOrder.salesOrderLineId ?? null,
      variantLabel: task.productionOrder.variantLabel ?? null,
      variantSku: task.productionOrder.variantSku ?? null,
      producesSemiFinished,
      expectedPieceCount,
      requiresPhotos,
    };

    const carry = this.scheduling
      ? await this.scheduling.getCarryOverEligibility({
          taskId: task.id,
          status: task.status,
          assignedEmployeeId: task.assignedEmployeeId ?? null,
          estimatedMinutes: task.estimatedMinutes ?? null,
          elapsedMinutes: timing.elapsedMinutes,
        })
      : {
          canCarryOver: false,
          leftoverRemainingMinutes: Math.max(
            1,
            (task.estimatedMinutes ?? 30) - (timing.elapsedMinutes ?? 0),
          ),
          carryOverAllowsOvertime: false,
        };

    const withCarry = { ...payload, ...carry };

    if (canSeeAll) return withCarry;
    const { progressPercent: _omit, timeEntries: _te, ...safe } = withCarry;
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
    const snapshotNode = task.stageInstanceId
      ? await this.prisma.productionOrderWorkflowSnapshotNode.findUnique({
          where: { stageInstanceId: task.stageInstanceId },
          select: { id: true, estimatedMinutes: true },
        })
      : null;
    const resolvedMinutes = resolveAssignStageMinutes({
      dtoMinutes: dto.estimatedMinutes,
      taskMinutes: task.estimatedMinutes,
      snapshotMinutes: snapshotNode?.estimatedMinutes,
    });
    if (resolvedMinutes == null) {
      throw new BadRequestException({
        code: 'STAGE_TIME_REQUIRED',
        message: 'Set this stage time in the workflow before assigning a worker.',
      });
    }
    if (
      shouldWriteBackStageTime({
        dtoMinutes: dto.estimatedMinutes,
        snapshotMinutes: snapshotNode?.estimatedMinutes,
        stageStatus: task.stageInstance?.status,
      }) &&
      snapshotNode
    ) {
      await this.prisma.productionOrderWorkflowSnapshotNode.update({
        where: { id: snapshotNode.id },
        data: {
          estimatedMinutes: resolvedMinutes,
          estimateReviewRequired: false,
        },
      });
      if (task.stageInstanceId) {
        await this.prisma.productionTask.updateMany({
          where: { stageInstanceId: task.stageInstanceId },
          data: { estimatedMinutes: resolvedMinutes },
        });
      }
    }

    const placed = await this.placement.placeTask({
      productionTaskId: id,
      employeeId: dto.employeeId,
      plannedStart: dto.plannedStart,
      plannedEnd: dto.plannedCompletion,
      priority: dto.priority,
      estimatedMinutes: resolvedMinutes,
      override: dto.overrideConflict,
      acknowledge: dto.acknowledge,
      actorUserId,
      permissions,
      reason: dto.reason ?? 'task-assign',
    });
    const updated = placed.task as typeof task & {
      assignedEmployee?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
      productionOrder?: { id: string; number: string; releasedToFactoryAt?: Date | null } | null;
    };
    const plannedStart = updated.plannedStart ? new Date(updated.plannedStart as Date) : null;
    const plannedCompletion = updated.plannedCompletion
      ? new Date(updated.plannedCompletion as Date)
      : null;

    if (plannedStart && plannedCompletion) {
      await this.scheduling
        ?.applyAssignmentOvertime({
          overtime: Boolean(dto.overtime),
          start: plannedStart,
          end: plannedCompletion,
          employeeId: dto.employeeId,
          userId: actorUserId,
        })
        .catch(() => undefined);
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
    }).then(async (updated) => {
      await this.scheduling
        ?.applyPauseSlide({ taskId: id, actorUserId: userId })
        .catch(() => undefined);
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
              voiceDocumentId: dto.voiceDocumentId ?? null,
              photoDocumentIds: dto.photoDocumentIds ?? [],
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
      const now = new Date();
      await tx.taskBlocker.updateMany({
        where: { taskId: id, resolvedAt: null },
        data: {
          resolvedAt: now,
          resolutionAt: now,
          resolvedById: userId,
          resolution: 'Unblocked',
        },
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

  async resolveBlocker(
    taskId: string,
    blockerId: string,
    dto: ResolveBlockerDto,
    userId: string,
    permissions: string[],
  ) {
    if (!permissions.includes('production-task.update-any')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only supervisors can answer production problems.',
      });
    }
    const blocker = await this.prisma.taskBlocker.findFirst({
      where: { id: blockerId, taskId },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            assignedEmployeeId: true,
            productionOrder: { select: { id: true, number: true } },
          },
        },
      },
    });
    if (!blocker) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Problem not found.' });

    const now = new Date();
    const resolution = dto.resolution?.trim() || 'Answered';
    const updated = await this.prisma.taskBlocker.update({
      where: { id: blockerId },
      data: {
        resolution,
        resolvedAt: blocker.resolvedAt ?? now,
        resolutionAt: now,
        resolvedById: userId,
        resolutionVoiceDocumentId: dto.resolutionVoiceDocumentId ?? blocker.resolutionVoiceDocumentId,
        resolutionPhotoDocumentIds:
          dto.resolutionPhotoDocumentIds ?? blocker.resolutionPhotoDocumentIds,
      },
    });

    const workerId = blocker.task.assignedEmployeeId;
    if (workerId) {
      await this.notifications.sendFromTemplate({
        templateCode: 'PRODUCTION_PROBLEM_ANSWERED',
        channel: 'IN_APP',
        to: { userId: workerId },
        vars: {
          orderNumber: blocker.task.productionOrder.number,
          taskName: blocker.task.name,
          resolution,
        },
        linkUrl: `/tasks/${blocker.task.id}`,
      });
    }

    if (blocker.task.id && blocker.task.assignedEmployeeId) {
      /* keep floor moving — do not auto-unblock status */
    }
    return updated;
  }

  async listProblems(query: { status?: 'open' | 'answered' | 'all' }) {
    const status = query.status ?? 'open';
    const where =
      status === 'open'
        ? { resolvedAt: null }
        : status === 'answered'
          ? { resolvedAt: { not: null } }
          : {};
    const rows = await this.prisma.taskBlocker.findMany({
      where,
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        task: {
          select: {
            id: true,
            name: true,
            number: true,
            status: true,
            assignedEmployeeId: true,
            assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
            stageDefinition: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
            productionOrder: {
              select: { id: true, number: true, productDescription: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        taskId: row.taskId,
        category: row.category,
        reason: row.reason,
        voiceDocumentId: row.voiceDocumentId,
        photoDocumentIds: row.photoDocumentIds ?? [],
        resolution: row.resolution,
        resolutionVoiceDocumentId: row.resolutionVoiceDocumentId,
        resolutionPhotoDocumentIds: row.resolutionPhotoDocumentIds ?? [],
        resolvedAt: row.resolvedAt,
        resolutionAt: row.resolutionAt,
        resolvedById: row.resolvedById,
        createdAt: row.createdAt,
        elapsedMinutes: Math.max(0, Math.round((Date.now() - row.createdAt.getTime()) / 60_000)),
        worker: row.task.assignedEmployee
          ? {
              id: row.task.assignedEmployee.id,
              name: [row.task.assignedEmployee.firstName, row.task.assignedEmployee.lastName]
                .filter(Boolean)
                .join(' ')
                .trim(),
            }
          : row.reportedBy
            ? {
                id: row.reportedBy.id,
                name: [row.reportedBy.firstName, row.reportedBy.lastName].filter(Boolean).join(' ').trim(),
              }
            : null,
        stage: row.task.stageDefinition,
        order: row.task.productionOrder,
        task: { id: row.task.id, name: row.task.name, number: row.task.number, status: row.task.status },
      })),
    };
  }

  async previewCarryOver(
    id: string,
    mode: 'tomorrow' | 'overtime',
    remainingMinutes: number,
    userId: string,
    permissions: string[],
  ) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (!this.scheduling) {
      throw new BadRequestException({ code: 'UNAVAILABLE', message: 'Scheduling is not available.' });
    }
    return this.scheduling.previewExecutionRipple({ taskId: id, mode, remainingMinutes });
  }

  async carryOver(id: string, dto: TaskCarryOverDto, userId: string, permissions: string[]) {
    const task = await this.getTask(id);
    this.assertCanModify(task, userId, permissions);
    if (!this.scheduling) {
      throw new BadRequestException({ code: 'UNAVAILABLE', message: 'Scheduling is not available.' });
    }
    const worker = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return this.scheduling.applyExecutionRipple({
      taskId: id,
      mode: dto.mode,
      remainingMinutes: dto.remainingMinutes,
      actorUserId: userId,
      workerName: [worker?.firstName, worker?.lastName].filter(Boolean).join(' ').trim() || userId,
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
      issueLocationId?: string | null;
      returnLocationId?: string | null;
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
      const incoming = task.productionOrderId
        ? await loadIncomingPiecesForInspection(this.prisma, task.productionOrderId, 'INSPECTION')
        : [];
      const packages = resolveExpectedPackages({
        incoming,
        snapshotLabels: pieceLabelsFromMetadata(snapNode?.metadata),
        snapshotCount: Number(snapNode?.expectedPieceCount) || 1,
      });
      const expected = expectedPackageLabelList(packages);
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

    const originType = String(task.productionOrder?.originType ?? '').toUpperCase();
    const recoveryPieceId = task.productionOrder?.returnPieceId ?? null;
    if (
      (originType === 'RETURN_RECOVERY' || stageCode === 'DISMANTLE_RECOVER') &&
      recoveryPieceId
    ) {
      await this.returnPieces?.assertRecoveryFinishAllowed(recoveryPieceId);
    }

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
      await ensureTaskTimeEntry(tx, {
        taskId: id,
        userId,
        actualMinutes: task.actualMinutes,
        actualStart: task.actualStart,
        actualCompletion: new Date(),
      });

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

    if (recoveryPieceId) {
      await this.returnPieces?.completeRecoveryIfPosted(recoveryPieceId);
    }

    return updated;
  }
}
