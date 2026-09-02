import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { ListProductionOrdersDto, UpdateProductionOrderDto, type ProductionListBucket } from './dto/production.dto';
import { StagePipelineService } from './stage-pipeline.service';
import {
  mapWorkflowStageAdmin,
  mapWorkflowStageSafe,
} from '../../common/helpers/production-workflow-stages.util';
import { buildTaskTimingSummary, closedSecondsFromTimeEntries } from '../../common/helpers/task-timing.util';
import {
  assessProductionReadiness,
  productionNotReadyException,
  type ExecutableTaskInput,
} from './production-readiness';
import {
  HAS_EXECUTABLE,
  UNASSIGNED_EXECUTABLE,
  UNDATED_EXECUTABLE,
  productionBoardBucketWhere,
  type ProductionBoardBucketKey,
} from './production-board-buckets';
import { releasedToFactoryWhere } from './factory-release';
import {
  DEFAULT_FACTORY_TIMEZONE,
  assertValidOnDate,
  intervalOverlapsFactoryDay,
  plannedTasksOverlapDayWhere,
  productionDayLensWhere,
  resolveFactoryDayBounds,
  type FactoryDayBounds,
  type ProductionDateMode,
} from './production-day-lens';
import {
  intervalsOverlap,
  recommendWorkerBand,
  sortRecommendedWorkers,
} from './worker-recommend';
import { listMissingExecutableTaskSpecs } from './ensure-executable-tasks';
import { ManufacturingCostService } from './manufacturing-cost.service';
import { SchedulingService } from '../scheduling/scheduling.service';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
    private readonly sequences: SequenceService,
    private readonly manufacturingCost: ManufacturingCostService,
    @Inject(forwardRef(() => SchedulingService))
    private readonly scheduling: SchedulingService,
  ) {}

  /**
   * Create missing floor ProductionTasks for non-LOGISTICS stage instances.
   * Idempotent — used when snapshot/PO exists but tasks were never created (legacy P2-F).
   */
  async ensureExecutableTasks(productionOrderId: string): Promise<{ created: number }> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: {
        id: true,
        quantity: true,
        productDescription: true,
        status: true,
        stages: {
          include: {
            stageDefinition: {
              select: { code: true, nameEn: true, executionKind: true },
            },
            tasks: { select: { id: true }, where: { status: { not: 'CANCELLED' } } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { created: 0 };
    }

    const missing = listMissingExecutableTaskSpecs(
      order.stages.map((s) => ({
        id: s.id,
        stageDefinitionId: s.stageDefinitionId,
        stageDefinition: s.stageDefinition,
        tasks: s.tasks,
      })),
      order.productDescription ?? '',
      Number(order.quantity) || 1,
    );
    if (missing.length === 0) return { created: 0 };

    let created = 0;
    for (const spec of missing) {
      const taskNumber = await this.sequences.next('TASK', 'TSK');
      await this.prisma.productionTask.create({
        data: {
          number: taskNumber,
          productionOrderId: order.id,
          stageDefinitionId: spec.stageDefinitionId,
          stageInstanceId: spec.stageInstanceId,
          name: spec.name,
          description: spec.description,
          status: 'NOT_STARTED',
          progressPercent: 0,
          estimatedMinutes: 120,
          targetQty: order.quantity,
          completedQty: 0,
        },
      });
      created += 1;
    }
    return { created };
  }

  async list(query: ListProductionOrdersDto, user?: AuthUser) {
    const now = new Date();
    const dayLens = await this.resolveDayLensFromQuery(query.onDate, query.dateMode, now);
    const where = await this.buildProductionListWhere(query, user, now, dayLens?.bounds ?? null, dayLens?.mode ?? null);

    const taskSelect = {
      id: true,
      status: true,
      isRework: true,
      assignedEmployeeId: true,
      stageInstanceId: true,
      plannedStart: true,
      plannedCompletion: true,
      actualStart: true,
      actualCompletion: true,
      estimatedMinutes: true,
      name: true,
      number: true,
      assignedEmployee: {
        select: { id: true, firstName: true, lastName: true },
      },
      stageDefinition: {
        select: {
          id: true,
          code: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          executionKind: true,
          responsibleDepartment: true,
        },
      },
      blockers: {
        where: { resolvedAt: null },
        select: { id: true, category: true, reason: true, resolvedAt: true },
      },
    } as const;

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.productionOrder.count({ where }),
      this.prisma.productionOrder.findMany({
        where,
        include: {
          salesOrder: {
            select: {
              id: true,
              number: true,
              externalOrderNumber: true,
              customerId: true,
              customer: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  nameAr: true,
                  nameEn: true,
                  nameHe: true,
                },
              },
            },
          },
          product: {
            select: {
              id: true,
              sku: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              imageUrl: true,
            },
          },
          salesOrderLine: {
            select: {
              description: true,
              product: {
                select: {
                  id: true,
                  sku: true,
                  nameEn: true,
                  nameAr: true,
                  nameHe: true,
                  imageUrl: true,
                },
              },
            },
          },
          // Lightweight stage refs for currentStage only — not a stages UI payload
          stages: {
            include: { stageDefinition: true },
            orderBy: { stageDefinition: { sortOrder: 'asc' } },
          },
          tasks: {
            where: { status: { not: 'CANCELLED' } },
            select: taskSelect,
          },
          _count: {
            select: {
              schedules: true,
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { requiredDeliveryDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const orphanCustomerIds = [
      ...new Set(
        data
          .filter((row) => row.customerId && !row.salesOrder?.customer)
          .map((row) => row.customerId as string),
      ),
    ];
    const orphanCustomers =
      orphanCustomerIds.length > 0
        ? await this.prisma.customer.findMany({
            where: { id: { in: orphanCustomerIds } },
            select: {
              id: true,
              code: true,
              name: true,
              nameAr: true,
              nameEn: true,
              nameHe: true,
            },
          })
        : [];
    const orphanById = new Map(orphanCustomers.map((c) => [c.id, c]));

    const catalogImages = await this.loadCatalogImageIndex();

    // Actual-mode activity enrichment (read-only queries — no writes).
    const actualEventsByOrder =
      dayLens?.mode === 'actual' && dayLens.bounds
        ? await this.loadActualDayEvents(
            data.map((r) => r.id),
            dayLens.bounds,
          )
        : new Map<string, Array<Record<string, unknown>>>();

    const enriched = data.map((row) => {
      const byCode = row.currentStageCode
        ? row.stages.find((s) => s.stageDefinition.code === row.currentStageCode)
        : null;
      const inProgress = row.stages.find((s) => s.status === 'IN_PROGRESS');
      const stage = byCode ?? inProgress ?? null;
      const def = stage?.stageDefinition;
      const customer =
        row.salesOrder?.customer ??
        (row.customerId ? orphanById.get(row.customerId) ?? null : null);
      const { stages: _stages, tasks, _count, ...rest } = row;
      const due = row.requiredDeliveryDate ? new Date(row.requiredDeliveryDate).getTime() : null;
      const isLate =
        due != null &&
        due < now.getTime() &&
        row.status !== 'COMPLETED' &&
        row.status !== 'CANCELLED';
      const title =
        row.product?.nameEn ||
        row.product?.nameAr ||
        row.salesOrderLine?.product?.nameEn ||
        row.salesOrderLine?.product?.nameAr ||
        row.salesOrderLine?.description ||
        row.productDescription ||
        '';
      const imageUrl =
        row.product?.imageUrl ??
        row.salesOrderLine?.product?.imageUrl ??
        this.matchCatalogImage(title, catalogImages);
      const readiness = assessProductionReadiness({
        status: row.status,
        currentStageCode: row.currentStageCode,
        tasks: tasks as ExecutableTaskInput[],
        schedulePresent: (_count?.schedules ?? 0) > 0,
        isLate,
        plannedStartDate: row.plannedStartDate,
      });

      let dayLensPayload: Record<string, unknown> | null = null;
      if (dayLens?.bounds && dayLens.mode === 'planned') {
        const plannedTasks = tasks
          .filter((t) =>
            intervalOverlapsFactoryDay(
              t.plannedStart,
              t.plannedCompletion,
              dayLens.bounds.start,
              dayLens.bounds.endExclusive,
            ),
          )
          .map((t) => ({
            taskId: t.id,
            taskNumber: t.number,
            stageCode: t.stageDefinition?.code ?? null,
            stageNameEn: t.stageDefinition?.nameEn ?? t.name,
            stageNameAr: t.stageDefinition?.nameAr ?? null,
            stageNameHe: t.stageDefinition?.nameHe ?? null,
            department: t.stageDefinition?.responsibleDepartment ?? null,
            workerName: t.assignedEmployee
              ? `${t.assignedEmployee.firstName} ${t.assignedEmployee.lastName}`.trim()
              : null,
            plannedStart: t.plannedStart,
            plannedCompletion: t.plannedCompletion,
            estimatedMinutes: t.estimatedMinutes,
            status: t.status,
          }));
        dayLensPayload = {
          mode: 'planned',
          onDate: dayLens.bounds.onDate,
          timezone: dayLens.bounds.timezone,
          plannedTasks,
        };
      } else if (dayLens?.bounds && dayLens.mode === 'actual') {
        dayLensPayload = {
          mode: 'actual',
          onDate: dayLens.bounds.onDate,
          timezone: dayLens.bounds.timezone,
          events: actualEventsByOrder.get(row.id) ?? [],
        };
      }

      return {
        ...rest,
        customer,
        imageUrl,
        isLate,
        readiness,
        dayLens: dayLensPayload,
        currentStage: def
          ? {
              code: def.code,
              nameEn: def.nameEn,
              nameAr: def.nameAr,
              nameHe: def.nameHe,
            }
          : row.currentStageCode
            ? {
                code: row.currentStageCode,
                nameEn: row.currentStageCode,
                nameAr: row.currentStageCode,
                nameHe: null,
              }
            : null,
      };
    });

    return {
      data: enriched,
      meta: {
        ...paginatedMeta(query.page, query.pageSize, totalItems),
        ...(dayLens
          ? {
              onDate: dayLens.bounds.onDate,
              dateMode: dayLens.mode,
              timezone: dayLens.bounds.timezone,
              factoryTodayYmd: dayLens.bounds.factoryTodayYmd,
            }
          : {}),
      },
    };
  }

  /**
   * Day lens summary — COUNT === list dataset for same onDate/bucket/customer.
   * Also returns board lane counts for the selected day + dateMode (view/filter only).
   * Read-only.
   */
  async daySummary(
    query: {
      onDate?: string;
      dateMode?: ProductionDateMode;
      bucket?: ProductionListBucket;
      customerId?: string;
    },
    user?: AuthUser,
  ) {
    const now = new Date();
    const timezone = await this.resolveFactoryTimezone();
    let onDate: string;
    try {
      onDate =
        assertValidOnDate(query.onDate) ??
        resolveFactoryDayBounds('2000-01-01', timezone, now).factoryTodayYmd;
    } catch {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'onDate must be YYYY-MM-DD.',
      });
    }
    const bounds = resolveFactoryDayBounds(onDate, timezone, now);
    const dateMode: ProductionDateMode = query.dateMode === 'actual' ? 'actual' : 'planned';

    const listBase = await this.buildProductionListWhere(
      {
        page: 1,
        pageSize: 1,
        bucket: query.bucket,
        customerId: query.customerId,
      } as ListProductionOrdersDto,
      user,
      now,
      null,
      null,
    );

    // Board tiles: day lens + each lane — never scoped by the selected list bucket.
    const boardBase = await this.buildProductionListWhere(
      {
        page: 1,
        pageSize: 1,
        customerId: query.customerId,
      } as ListProductionOrdersDto,
      user,
      now,
      bounds,
      dateMode,
    );

    const plannedWhere: Prisma.ProductionOrderWhereInput = {
      AND: [listBase, productionDayLensWhere(bounds, 'planned')],
    };
    const actualWhere: Prisma.ProductionOrderWhereInput = {
      AND: [listBase, productionDayLensWhere(bounds, 'actual')],
    };

    const plannedTaskWhere = plannedTasksOverlapDayWhere(bounds.start, bounds.endExclusive);

    const boardKeys = [
      'needs_setup',
      'ready_to_start',
      'on_floor',
      'blocked',
      'inspection_packaging',
    ] as const satisfies readonly ProductionBoardBucketKey[];

    const [
      plannedOrders,
      plannedTasks,
      actualOrders,
      plannedTaskRows,
      lateMissed,
      atRisk,
      needsSetup,
      readyToStart,
      onFloor,
      blocked,
      inspectionPackaging,
    ] = await this.prisma.$transaction([
      this.prisma.productionOrder.count({ where: plannedWhere }),
      this.prisma.productionTask.count({
        where: {
          ...plannedTaskWhere,
          productionOrder: plannedWhere,
        },
      }),
      this.prisma.productionOrder.count({ where: actualWhere }),
      this.prisma.productionTask.findMany({
        where: {
          ...plannedTaskWhere,
          productionOrder: plannedWhere,
        },
        select: {
          id: true,
          stageDefinition: {
            select: { code: true, nameEn: true, nameAr: true, responsibleDepartment: true },
          },
        },
      }),
      this.prisma.productionTask.count({
        where: {
          ...plannedTaskWhere,
          productionOrder: plannedWhere,
          actualStart: null,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          plannedCompletion: { lt: now, not: null },
        },
      }),
      this.prisma.productionOrder.count({
        where: {
          AND: [
            plannedWhere,
            {
              OR: [
                {
                  requiredDeliveryDate: { lt: now },
                  status: { notIn: ['COMPLETED', 'CANCELLED'] },
                },
                {
                  tasks: {
                    some: { blockers: { some: { resolvedAt: null } } },
                  },
                },
              ],
            },
          ],
        },
      }),
      ...boardKeys.map((key) =>
        this.prisma.productionOrder.count({
          where: {
            AND: [boardBase, productionBoardBucketWhere(key, now)],
          },
        }),
      ),
    ]);

    const [actualStarts, actualCompletions] = await this.prisma.$transaction([
      this.prisma.productionTask.count({
        where: {
          productionOrder: actualWhere,
          actualStart: { gte: bounds.start, lt: bounds.endExclusive },
        },
      }),
      this.prisma.productionTask.count({
        where: {
          productionOrder: actualWhere,
          actualCompletion: { gte: bounds.start, lt: bounds.endExclusive },
        },
      }),
    ]);

    const byDepartment = new Map<string, { code: string; nameEn: string; taskCount: number }>();
    for (const row of plannedTaskRows) {
      const code =
        row.stageDefinition?.responsibleDepartment ||
        row.stageDefinition?.code ||
        'OTHER';
      const nameEn = row.stageDefinition?.nameEn || code;
      const prev = byDepartment.get(code);
      if (prev) prev.taskCount += 1;
      else byDepartment.set(code, { code, nameEn, taskCount: 1 });
    }

    return {
      onDate: bounds.onDate,
      timezone: bounds.timezone,
      factoryTodayYmd: bounds.factoryTodayYmd,
      isToday: bounds.isToday,
      isFuture: bounds.isFuture,
      dateMode,
      planned: {
        orders: plannedOrders,
        tasks: plannedTasks,
        byDepartment: [...byDepartment.values()].sort((a, b) => b.taskCount - a.taskCount),
      },
      actual: {
        orders: actualOrders,
        taskEvents: actualStarts + actualCompletions,
      },
      lateMissed,
      atRisk,
      board: {
        needsSetup,
        readyToStart,
        onFloor,
        blocked,
        inspectionPackaging,
      },
    };
  }

  /** Read-only factory timezone from calendar (or default Asia/Amman). */
  private async resolveFactoryTimezone(): Promise<string> {
    const row = await this.prisma.factoryCalendar.findFirst({
      where: { isDefault: true },
      select: { timezone: true },
    });
    return row?.timezone?.trim() || DEFAULT_FACTORY_TIMEZONE;
  }

  private async resolveDayLensFromQuery(
    onDate: string | undefined,
    dateMode: ProductionDateMode | undefined,
    now: Date,
  ): Promise<{ bounds: FactoryDayBounds; mode: ProductionDateMode } | null> {
    if (!onDate?.trim() || !dateMode) return null;
    let ymd: string;
    try {
      ymd = assertValidOnDate(onDate)!;
    } catch {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'onDate must be YYYY-MM-DD.',
      });
    }
    const timezone = await this.resolveFactoryTimezone();
    return {
      bounds: resolveFactoryDayBounds(ymd, timezone, now),
      mode: dateMode,
    };
  }

  private async buildProductionListWhere(
    query: ListProductionOrdersDto,
    user: AuthUser | undefined,
    now: Date,
    dayBounds: FactoryDayBounds | null,
    dateMode: ProductionDateMode | null,
  ): Promise<Prisma.ProductionOrderWhereInput> {
    const q = query.q?.trim();
    const and: Prisma.ProductionOrderWhereInput[] = [];
    if (query.customerId) {
      and.push({
        OR: [
          { customerId: query.customerId },
          { salesOrder: { customerId: query.customerId } },
        ],
      });
    }
    if (q) {
      and.push({
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { productDescription: { contains: q, mode: 'insensitive' } },
          { currentStageCode: { contains: q, mode: 'insensitive' } },
          { salesOrder: { number: { contains: q, mode: 'insensitive' } } },
          { product: { nameEn: { contains: q, mode: 'insensitive' } } },
          { product: { nameAr: { contains: q, mode: 'insensitive' } } },
          { product: { nameHe: { contains: q, mode: 'insensitive' } } },
          { product: { sku: { contains: q, mode: 'insensitive' } } },
          { salesOrder: { externalOrderNumber: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const BOARD_BUCKETS = new Set<string>([
      'needs_setup',
      'ready_to_start',
      'on_floor',
      'blocked',
      'inspection_packaging',
    ]);

    let bucketWhere: Prisma.ProductionOrderWhereInput = {};
    if (query.bucket && BOARD_BUCKETS.has(query.bucket)) {
      bucketWhere = productionBoardBucketWhere(
        query.bucket as ProductionBoardBucketKey,
        now,
      );
    } else if (query.bucket === 'in_production') {
      bucketWhere = productionBoardBucketWhere('on_floor', now);
    } else if (query.bucket === 'late') {
      bucketWhere = {
        ...releasedToFactoryWhere(),
        requiredDeliveryDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      };
    } else if (query.bucket === 'completed') {
      bucketWhere = {
        ...releasedToFactoryWhere(),
        status: { in: ['COMPLETED', 'READY_FOR_DELIVERY'] },
      };
    } else if (query.bucket === 'daily') {
      bucketWhere = {
        ...releasedToFactoryWhere(),
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfDay },
      };
    } else if (query.bucket === 'weekly') {
      bucketWhere = {
        ...releasedToFactoryWhere(),
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfWeek },
      };
    } else if (query.bucket === 'monthly') {
      bucketWhere = {
        ...releasedToFactoryWhere(),
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfMonth },
      };
    }

    if (dayBounds && dateMode) {
      and.push(productionDayLensWhere(dayBounds, dateMode));
    }

    return {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...bucketWhere,
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedEmployeeId
        ? { tasks: { some: { assignedEmployeeId: query.assignedEmployeeId } } }
        : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  /** Read-only event feed for Actual day lens cards. */
  private async loadActualDayEvents(
    productionOrderIds: string[],
    bounds: FactoryDayBounds,
  ): Promise<Map<string, Array<Record<string, unknown>>>> {
    const map = new Map<string, Array<Record<string, unknown>>>();
    if (productionOrderIds.length === 0) return map;
    const { start, endExclusive } = bounds;

    const [tasks, materials, kits, handoffs, lots, inspections] = await Promise.all([
      this.prisma.productionTask.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          OR: [
            { actualStart: { gte: start, lt: endExclusive } },
            { actualCompletion: { gte: start, lt: endExclusive } },
          ],
        },
        select: {
          id: true,
          productionOrderId: true,
          actualStart: true,
          actualCompletion: true,
          name: true,
          assignedEmployee: { select: { firstName: true, lastName: true } },
          stageDefinition: {
            select: { code: true, nameEn: true, nameAr: true, nameHe: true },
          },
        },
      }),
      this.prisma.productionTaskMaterialUsage.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          OR: [
            { finalizedAt: { gte: start, lt: endExclusive } },
            {
              AND: [
                { finalizedAt: null },
                { createdAt: { gte: start, lt: endExclusive } },
              ],
            },
          ],
        },
        select: {
          productionOrderId: true,
          sku: true,
          actualQty: true,
          returnedQty: true,
          scrapQty: true,
          finalizedAt: true,
          createdAt: true,
          task: {
            select: {
              stageDefinition: { select: { nameEn: true, code: true } },
              assignedEmployee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.wipKit.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          createdAt: { gte: start, lt: endExclusive },
        },
        select: {
          productionOrderId: true,
          createdAt: true,
          stageInstance: {
            select: { stageDefinition: { select: { nameEn: true, code: true } } },
          },
          producingTask: {
            select: {
              assignedEmployee: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.wipHandoff.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          receivedAt: { gte: start, lt: endExclusive },
        },
        select: {
          productionOrderId: true,
          receivedAt: true,
          receivedBy: { select: { firstName: true, lastName: true } },
          kit: {
            select: {
              stageInstance: {
                select: { stageDefinition: { select: { nameEn: true, code: true } } },
              },
            },
          },
        },
      }),
      this.prisma.inventoryLot.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          producedAt: { gte: start, lt: endExclusive },
        },
        select: {
          productionOrderId: true,
          producedAt: true,
          inventoryItem: { select: { sku: true, nameEn: true, itemClass: true } },
        },
      }),
      this.prisma.qualityInspection.findMany({
        where: {
          productionOrderId: { in: productionOrderIds },
          inspectedAt: { gte: start, lt: endExclusive },
        },
        select: {
          productionOrderId: true,
          inspectedAt: true,
          result: true,
          stageCode: true,
        },
      }),
    ]);

    const push = (orderId: string, event: Record<string, unknown>) => {
      const list = map.get(orderId) ?? [];
      list.push(event);
      map.set(orderId, list);
    };

    for (const t of tasks) {
      const stage = t.stageDefinition?.nameEn ?? t.name;
      const worker = t.assignedEmployee
        ? `${t.assignedEmployee.firstName} ${t.assignedEmployee.lastName}`.trim()
        : null;
      if (
        t.actualStart &&
        t.actualStart >= start &&
        t.actualStart < endExclusive
      ) {
        push(t.productionOrderId, {
          kind: 'task_started',
          at: t.actualStart.toISOString(),
          stage,
          worker,
        });
      }
      if (
        t.actualCompletion &&
        t.actualCompletion >= start &&
        t.actualCompletion < endExclusive
      ) {
        push(t.productionOrderId, {
          kind: 'task_completed',
          at: t.actualCompletion.toISOString(),
          stage,
          worker,
        });
      }
    }

    for (const m of materials) {
      const at = (m.finalizedAt ?? m.createdAt).toISOString();
      const stage = m.task?.stageDefinition?.nameEn ?? null;
      const worker = m.task?.assignedEmployee
        ? `${m.task.assignedEmployee.firstName} ${m.task.assignedEmployee.lastName}`.trim()
        : null;
      if (Number(m.scrapQty) > 0) {
        push(m.productionOrderId, { kind: 'material_scrap', at, sku: m.sku, stage, worker });
      } else if (Number(m.returnedQty) > 0) {
        push(m.productionOrderId, { kind: 'material_returned', at, sku: m.sku, stage, worker });
      } else if (m.actualQty != null) {
        push(m.productionOrderId, { kind: 'material_used', at, sku: m.sku, stage, worker });
      }
    }

    for (const k of kits) {
      const worker = k.producingTask?.assignedEmployee
        ? `${k.producingTask.assignedEmployee.firstName} ${k.producingTask.assignedEmployee.lastName}`.trim()
        : null;
      push(k.productionOrderId, {
        kind: 'semi_produced',
        at: k.createdAt.toISOString(),
        stage: k.stageInstance.stageDefinition.nameEn,
        worker,
      });
    }

    for (const h of handoffs) {
      push(h.productionOrderId, {
        kind: 'semi_received',
        at: h.receivedAt.toISOString(),
        stage: h.kit.stageInstance.stageDefinition.nameEn,
        worker: `${h.receivedBy.firstName} ${h.receivedBy.lastName}`.trim(),
      });
    }

    for (const lot of lots) {
      const cls = String(lot.inventoryItem?.itemClass ?? '').toUpperCase();
      push(lot.productionOrderId!, {
        kind: cls.includes('FINISH') || cls === 'FG' ? 'fg_created' : 'lot_produced',
        at: lot.producedAt.toISOString(),
        sku: lot.inventoryItem?.sku ?? null,
        name: lot.inventoryItem?.nameEn ?? null,
      });
    }

    for (const insp of inspections) {
      const result = String(insp.result ?? '').toUpperCase();
      push(insp.productionOrderId, {
        kind: result === 'FAIL' || result === 'FAILED' ? 'inspection_failed' : 'inspection_passed',
        at: insp.inspectedAt.toISOString(),
        stage: insp.stageCode,
      });
    }

    for (const [orderId, events] of map) {
      events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
      map.set(orderId, events);
    }
    return map;
  }

  async getById(
    id: string,
    user?: AuthUser,
    _opts?: { skipPromote?: boolean },
  ) {
    const loadOrder = () =>
      this.prisma.productionOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            externalOrderNumber: true,
            requiredDeliveryDate: true,
            customer: {
              select: {
                id: true,
                code: true,
                name: true,
                nameAr: true,
                nameEn: true,
                nameHe: true,
              },
            },
          },
        },
        product: true,
        salesOrderLine: {
          select: {
            id: true,
            description: true,
            quantity: true,
            orderSpec: true,
            manufacturingComplexity: true,
            product: {
              select: {
                id: true,
                sku: true,
                nameEn: true,
                nameAr: true,
                nameHe: true,
                imageUrl: true,
              },
            },
            productionSetup: {
              select: {
                manufacturingName: true,
                manufacturingComplexity: true,
                catalogDimensions: true,
                orderDimensions: true,
                requestedFabricLabel: true,
                factoryNotes: true,
                packagingExpectation: true,
                workflowId: true,
                materialRequirements: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    sku: true,
                    displayName: true,
                    category: true,
                    unit: true,
                    expectedQty: true,
                    source: true,
                    requestedFabricLabel: true,
                    inventoryItem: {
                      select: { id: true, sku: true, nameEn: true, category: true, unit: true },
                    },
                  },
                },
              },
            },
          },
        },
        stages: {
          include: {
            stageDefinition: true,
            tasks: {
              include: {
                assignedEmployee: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
                blockers: true,
                timeEntries: {
                  orderBy: { startedAt: 'desc' as const },
                  select: { startedAt: true, endedAt: true },
                },
              },
            },
          },
          orderBy: { stageDefinition: { sortOrder: 'asc' } },
        },
        tasks: {
          include: {
            assignedEmployee: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            stageDefinition: true,
            blockers: true,
            timeEntries: {
              orderBy: { startedAt: 'desc' as const },
              select: { startedAt: true, endedAt: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        documents: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            category: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });
    let order = await loadOrder();
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }
    if (!assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your production order.' });
    }

    // Staff: repair missing floor tasks from stage instances (legacy Piece 2 demos / partial releases).
    if (!user?.customerId) {
      const repaired = await this.ensureExecutableTasks(id);
      if (repaired.created > 0) {
        order = await loadOrder();
        if (!order) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
        }
      }
    }

    const openBlockers = order.tasks.flatMap((task) =>
      (task.blockers ?? [])
        .filter((b) => !b.resolvedAt)
        .map((b) => ({
          ...b,
          taskId: task.id,
          taskName: task.name,
          taskNumber: task.number,
        })),
    );

    const due = order.requiredDeliveryDate
      ? new Date(order.requiredDeliveryDate).getTime()
      : null;
    const isLate =
      due != null &&
      due < Date.now() &&
      order.status !== 'COMPLETED' &&
      order.status !== 'CANCELLED';

    const catalogImages = await this.loadCatalogImageIndex();
    const title =
      order.product?.nameEn ||
      order.product?.nameAr ||
      order.salesOrderLine?.product?.nameEn ||
      order.salesOrderLine?.product?.nameAr ||
      order.salesOrderLine?.description ||
      order.productDescription ||
      '';
    const imageUrl =
      order.product?.imageUrl ??
      order.salesOrderLine?.product?.imageUrl ??
      this.matchCatalogImage(title, catalogImages);

    const scheduleCount = await this.prisma.productionSchedule.count({
      where: { productionOrderId: id },
    });
    const readiness = assessProductionReadiness({
      status: order.status,
      currentStageCode: order.currentStageCode,
      tasks: order.tasks as ExecutableTaskInput[],
      schedulePresent: scheduleCount > 0,
      isLate,
      plannedStartDate: order.plannedStartDate,
      openBlockers: openBlockers.map((b) => ({
        kind: String(b.category ?? 'OTHER'),
        taskId: b.taskId,
        message: b.reason ?? undefined,
      })),
    });

    const lineSetup = order.salesOrderLine?.productionSetup ?? null;
    const productionSpecification = lineSetup
      ? {
          manufacturingName: lineSetup.manufacturingName,
          manufacturingComplexity: lineSetup.manufacturingComplexity,
          catalogDimensions: lineSetup.catalogDimensions,
          orderDimensions: lineSetup.orderDimensions,
          requestedFabricLabel: lineSetup.requestedFabricLabel,
          factoryNotes: user?.customerId ? null : lineSetup.factoryNotes,
          packagingExpectation: lineSetup.packagingExpectation,
          workflowId: lineSetup.workflowId,
          materials: user?.customerId
            ? []
            : lineSetup.materialRequirements.map((m) => ({
                sku: m.sku,
                displayName: m.displayName,
                category: m.category,
                unit: m.unit,
                expectedQty: Number(m.expectedQty),
                source: m.source,
                requestedFabricLabel: m.requestedFabricLabel,
                inventoryItem: m.inventoryItem,
              })),
        }
      : null;

    const base = {
      ...order,
      customer: order.salesOrder?.customer ?? null,
      imageUrl,
      isLate,
      openBlockers,
      readiness,
      productionSpecification,
      workerAssignmentRequired: scheduleCount === 0 && order.status !== 'CANCELLED',
    };

    // Dealers see sanitized stage DAG + completed-stage work photos only.
    if (user?.customerId) {
      const taskPhotos = (order.documents ?? []).filter((d) =>
        (d.category ?? '').startsWith('TASK_PHOTO:'),
      );
      const { stages: _s, tasks: _t, openBlockers: _b, documents: _d, ...rest } = base;
      return {
        ...rest,
        stages: (order.stages ?? []).map((s) => mapWorkflowStageSafe(s, taskPhotos)),
        tasks: [],
        openBlockers: [],
        documents: [],
        manufacturingCosting: null,
      };
    }

    const taskPhotos = (order.documents ?? []).filter((d) =>
      (d.category ?? '').startsWith('TASK_PHOTO:'),
    );
    const tasksWithTiming = (order.tasks ?? []).map((task) => {
      const open = task.timeEntries?.find((e) => !e.endedAt);
      const hasClosed = (task.timeEntries ?? []).some((e) => e.endedAt != null);
      const { timeEntries: _te, ...rest } = task;
      return {
        ...rest,
        timing: buildTaskTimingSummary({
          status: task.status,
          actualMinutes: task.actualMinutes,
          actualSeconds: hasClosed
            ? closedSecondsFromTimeEntries(task.timeEntries)
            : undefined,
          estimatedMinutes: task.estimatedMinutes,
          plannedCompletion: task.plannedCompletion,
          openStartedAt: open?.startedAt ?? null,
        }),
      };
    });
    const manufacturingCosting = await this.manufacturingCost.summaryForProductionOrder(
      id,
      user,
    );
    return {
      ...base,
      tasks: tasksWithTiming,
      manufacturingCosting,
      stages: (order.stages ?? []).map((s) => ({
        ...s,
        ...mapWorkflowStageAdmin(s, taskPhotos),
        tasks: (s.tasks ?? []).map((task) => {
          const entries = (task as { timeEntries?: Array<{ startedAt: Date; endedAt?: Date | null }> })
            .timeEntries;
          const open = entries?.find((e) => !e.endedAt);
          const hasClosed = (entries ?? []).some((e) => e.endedAt != null);
          const { timeEntries: _te, ...rest } = task as typeof task & {
            timeEntries?: unknown;
          };
          return {
            ...rest,
            timing: buildTaskTimingSummary({
              status: (task as { status?: string }).status ?? s.status,
              actualMinutes: (task as { actualMinutes?: number | null }).actualMinutes,
              actualSeconds: hasClosed ? closedSecondsFromTimeEntries(entries) : undefined,
              estimatedMinutes: (task as { estimatedMinutes?: number | null }).estimatedMinutes,
              plannedCompletion: (task as { plannedCompletion?: Date | null }).plannedCompletion,
              openStartedAt: open?.startedAt ?? null,
            }),
          };
        }),
      })),
    };
  }

  async listAssignableWorkers(
    q?: string,
    stageDefinitionId?: string,
    opts?: { taskId?: string; plannedStart?: string; plannedCompletion?: string },
  ) {
    const stageId = stageDefinitionId?.trim() || undefined;
    const where: Prisma.UserWhereInput = {
      archivedAt: null,
      isActive: true,
      roles: { some: { role: { kind: 'PRODUCTION_WORKER' } } },
      ...(stageId
        ? {
            workerSkills: {
              some: { stageDefinitionId: stageId, isActive: true },
            },
          }
        : {}),
      ...(q?.trim()
        ? {
            OR: [
              { firstName: { contains: q.trim(), mode: 'insensitive' } },
              { lastName: { contains: q.trim(), mode: 'insensitive' } },
              { email: { contains: q.trim(), mode: 'insensitive' } },
              { username: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const workers = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        username: true,
        department: { select: { id: true, code: true, nameEn: true, nameAr: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 100,
    });

    const ids = workers.map((w) => w.id);
    const openStatuses = [
      'NOT_STARTED',
      'READY',
      'IN_PROGRESS',
      'PAUSED',
      'BLOCKED',
      'READY_FOR_INSPECTION',
    ] as const;
    const counts =
      ids.length === 0
        ? []
        : await this.prisma.productionTask.groupBy({
            by: ['assignedEmployeeId'],
            where: {
              assignedEmployeeId: { in: ids },
              status: { in: [...openStatuses] },
              productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            },
            _count: { _all: true },
          });
    const countById = new Map(
      counts
        .filter((c) => c.assignedEmployeeId)
        .map((c) => [c.assignedEmployeeId as string, c._count._all]),
    );

    const windowStart = opts?.plannedStart ? new Date(opts.plannedStart) : null;
    const windowEnd = opts?.plannedCompletion ? new Date(opts.plannedCompletion) : null;
    const windowOk =
      windowStart != null &&
      windowEnd != null &&
      !Number.isNaN(windowStart.getTime()) &&
      !Number.isNaN(windowEnd.getTime());

    const overlapByWorker = new Set<string>();
    const overlapWindowsByWorker = new Map<
      string,
      Array<{ start: string; end: string; label: string }>
    >();
    /** All busy blocks on the local calendar day of plannedStart (time-based capacity). */
    const dayWindowsByWorker = new Map<
      string,
      Array<{
        start: string;
        end: string;
        label: string;
        salesOrderNumber: string | null;
        stage: string | null;
      }>
    >();
    if (windowOk && ids.length > 0) {
      const excludeTaskId = opts?.taskId?.trim() || undefined;
      const dayStart = new Date(windowStart!);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayTasks = await this.prisma.productionTask.findMany({
        where: {
          assignedEmployeeId: { in: ids },
          ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
          status: { in: [...openStatuses] },
          productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          plannedCompletion: { not: null },
          OR: [
            {
              plannedStart: { gte: dayStart, lt: dayEnd },
            },
            {
              AND: [
                { plannedStart: null },
                { plannedCompletion: { gte: dayStart, lt: dayEnd } },
              ],
            },
            {
              AND: [
                { plannedStart: { lt: dayEnd } },
                { plannedCompletion: { gt: dayStart } },
              ],
            },
          ],
        },
        select: {
          assignedEmployeeId: true,
          name: true,
          plannedStart: true,
          plannedCompletion: true,
          productionOrder: {
            select: {
              number: true,
              salesOrder: { select: { number: true } },
            },
          },
        },
      });
      for (const t of dayTasks) {
        if (!t.assignedEmployeeId || !t.plannedCompletion) continue;
        const oStart = t.plannedStart ?? new Date(t.plannedCompletion.getTime() - 3600_000);
        const soNumber = t.productionOrder?.salesOrder?.number ?? t.productionOrder?.number ?? null;
        const label = `${soNumber ?? ''} · ${t.name}`.trim();
        const dayList = dayWindowsByWorker.get(t.assignedEmployeeId) ?? [];
        dayList.push({
          start: oStart.toISOString(),
          end: t.plannedCompletion.toISOString(),
          label,
          salesOrderNumber: soNumber,
          stage: t.name,
        });
        dayWindowsByWorker.set(t.assignedEmployeeId, dayList);

        if (intervalsOverlap(windowStart!, windowEnd!, oStart, t.plannedCompletion)) {
          overlapByWorker.add(t.assignedEmployeeId);
          const list = overlapWindowsByWorker.get(t.assignedEmployeeId) ?? [];
          list.push({
            start: oStart.toISOString(),
            end: t.plannedCompletion.toISOString(),
            label,
          });
          overlapWindowsByWorker.set(t.assignedEmployeeId, list);
        }
      }
    }

    const skillRequired =
      stageId != null
        ? (await this.prisma.workerSkill.count({ where: { stageDefinitionId: stageId, isActive: true } })) >
          0
        : false;

    const durationMs =
      windowOk && windowStart && windowEnd
        ? Math.max(30 * 60_000, windowEnd.getTime() - windowStart.getTime())
        : 2 * 60 * 60_000;

    const enriched = workers.map((w) => {
      const activeTaskCount = countById.get(w.id) ?? 0;
      const overlapWindows = overlapWindowsByWorker.get(w.id) ?? [];
      const rec = recommendWorkerBand({
        id: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        activeTaskCount,
        skillMatch: stageId ? true : !skillRequired, // already filtered by skill when stageId set
        hasOverlap: overlapByWorker.has(w.id),
      });
      let suggestedWindow: { plannedStart: string; plannedCompletion: string } | null =
        null;
      if (overlapWindows.length > 0) {
        const latestEndMs = Math.max(
          ...overlapWindows.map((o) => new Date(o.end).getTime()),
        );
        const suggestedStart = new Date(latestEndMs);
        suggestedWindow = {
          plannedStart: suggestedStart.toISOString(),
          plannedCompletion: new Date(latestEndMs + durationMs).toISOString(),
        };
      }
      const dayWindows = dayWindowsByWorker.get(w.id) ?? [];
      return {
        ...w,
        activeTaskCount,
        recommendBand: rec.band,
        recommendReason: rec.reason,
        recommendReasonCode: rec.reasonCode,
        overlapWindows: overlapWindows.length > 0 ? overlapWindows : undefined,
        dayWindows: dayWindows.length > 0 ? dayWindows : undefined,
        suggestedWindow: suggestedWindow ?? undefined,
      };
    });

    return sortRecommendedWorkers(
      enriched.map((w) => ({
        ...w,
        band: w.recommendBand,
        reason: w.recommendReason,
        reasonCode: w.recommendReasonCode,
        skillMatch: true,
        hasOverlap: overlapByWorker.has(w.id),
      })),
    ).map(({ band: _b, reason: _r, reasonCode: _rc, skillMatch: _s, hasOverlap: _h, ...rest }) => rest);
  }

  async update(id: string, dto: UpdateProductionOrderDto) {
    await this.getById(id);
    await this.prisma.productionOrder.update({
      where: { id },
      data: {
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.plannedStartDate
          ? { plannedStartDate: new Date(dto.plannedStartDate) }
          : {}),
        ...(dto.plannedCompletionDate
          ? { plannedCompletionDate: new Date(dto.plannedCompletionDate) }
          : {}),
        ...(dto.requiredDeliveryDate
          ? { requiredDeliveryDate: new Date(dto.requiredDeliveryDate) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    if (dto.estimatedMinutes != null) {
      await this.prisma.productionTask.updateMany({
        where: { productionOrderId: id, estimatedMinutes: null },
        data: { estimatedMinutes: dto.estimatedMinutes },
      });
    }

    return this.getById(id);
  }

  /**
   * Release to factory — hard Preparing → Production boundary.
   * Locks the approved plan, opens Production visibility (Ready for factory),
   * unlocks eligible stages for workers. Does **not** mark the PO IN_PROGRESS
   * or set actualStartDate — that waits for first executable task actual start
   * via StagePipelineService.onTaskStart. Planned start date arriving never
   * flips Ready for Factory → In Production.
   *
   * `plannedStartDateIso` (optional) is persisted before release so Confirm can
   * send the calendar day in one shot without a prior Save.
   */
  async start(id: string, actorUserId?: string, plannedStartDateIso?: string) {
    if (plannedStartDateIso?.trim()) {
      await this.setProductionStartAndSuggestSchedule(
        id,
        plannedStartDateIso.trim(),
        actorUserId ?? 'system',
      );
    }

    const order = await this.getById(id);

    if (order.releasedToFactoryAt) {
      return this.getById(id);
    }

    const allowed = ['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS'];
    if (!allowed.includes(order.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot release production order to factory in status ${order.status}.`,
      });
    }

    const readiness =
      order.readiness ??
      assessProductionReadiness({
        status: order.status,
        currentStageCode: order.currentStageCode,
        tasks: (order.tasks ?? []) as ExecutableTaskInput[],
        plannedStartDate: order.plannedStartDate,
      });

    const hardBlock = readiness.reasons.filter(
      (r: { code: string }) =>
        r.code === 'MISSING_ASSIGNMENT' ||
        r.code === 'MISSING_DATE' ||
        r.code === 'MISSING_PRODUCTION_START' ||
        r.code === 'NO_EXECUTABLE_TASKS' ||
        r.code === 'STATUS_NOT_STARTABLE',
    );
    if (hardBlock.length > 0 || !readiness.canStart) {
      throw new BadRequestException(productionNotReadyException(readiness));
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id },
        data: {
          // Stay Ready for factory until a real executable task starts.
          status: order.status === 'WAITING_FOR_MATERIALS' ? 'WAITING_FOR_MATERIALS' : 'READY',
          releasedToFactoryAt: now,
          releasedToFactoryById: actorUserId ?? order.createdById ?? null,
        },
      });
      // Do NOT set SalesOrder IN_PRODUCTION here — that waits for first
      // executable task start via StagePipelineService.onTaskStart.
      if (order.salesOrderId) {
        await tx.salesOrder.updateMany({
          where: {
            id: order.salesOrderId,
            status: {
              in: ['DRAFT', 'CONFIRMED', 'WAITING_FOR_PAYMENT', 'READY_FOR_PRODUCTION'],
            },
          },
          data: { status: 'READY_FOR_PRODUCTION' },
        });
      }
      await this.pipeline.unlockReadyStages(id, tx);
      await this.pipeline.rollupProgress(id, tx);
      await tx.auditEvent.create({
        data: {
          userId: actorUserId ?? order.createdById ?? null,
          action: 'production-order.release-to-factory',
          entityType: 'ProductionOrder',
          entityId: id,
          newValues: {
            releasedToFactoryAt: now.toISOString(),
            salesOrderId: order.salesOrderId,
            salesOrderStatus: 'READY_FOR_PRODUCTION',
            plannedStartDate: order.plannedStartDate?.toISOString() ?? null,
          },
        },
      });
    });

    // Confirm / release always returns Ready for factory (Ready to start on Orders).
    return this.getById(id);
  }

  /**
   * Explicit Admin Replan — Ready for Factory → Needs Planning.
   * Clears factory release, unlocks the plan for admin edits.
   * Retains previous approved plan snapshot in audit (does not wipe task assignments/dates).
   * Committed dealer delivery date is never modified.
   * Rejected once any executable task has started.
   */
  async returnToPreparing(id: string, actorUserId?: string, reason?: string) {
    const order = await this.getById(id);

    if (!order.releasedToFactoryAt) {
      return order;
    }

    const status = String(order.status ?? '').toUpperCase();
    const executionStarted =
      Boolean(order.actualStartDate) ||
      ['IN_PROGRESS', 'ON_HOLD', 'QUALITY_CHECK', 'READY_FOR_PACKAGING', 'READY_FOR_DELIVERY', 'COMPLETED'].includes(
        status,
      );
    if (executionStarted) {
      throw new BadRequestException({
        code: 'ALREADY_IN_PRODUCTION',
        message: 'Cannot unlock the plan after production work has started.',
      });
    }

    const planSnapshot = {
      status: order.status,
      releasedToFactoryAt: order.releasedToFactoryAt
        ? new Date(order.releasedToFactoryAt).toISOString()
        : null,
      plannedStartDate: order.plannedStartDate
        ? new Date(order.plannedStartDate).toISOString()
        : null,
      plannedCompletionDate: order.plannedCompletionDate
        ? new Date(order.plannedCompletionDate).toISOString()
        : null,
      requiredDeliveryDate: order.requiredDeliveryDate
        ? new Date(order.requiredDeliveryDate).toISOString()
        : null,
      committedDeliveryDate: order.committedDeliveryDate
        ? new Date(order.committedDeliveryDate).toISOString()
        : null,
      tasks: (order.tasks ?? []).map((t: {
        id: string;
        number?: string;
        name?: string;
        status: string;
        assignedEmployeeId?: string | null;
        assignedEmployee?: { firstName?: string | null; lastName?: string | null } | null;
        plannedStart?: Date | string | null;
        plannedCompletion?: Date | string | null;
        stageDefinition?: { code?: string | null } | null;
      }) => ({
        id: t.id,
        number: t.number ?? null,
        name: t.name ?? null,
        status: t.status,
        assignedEmployeeId: t.assignedEmployeeId ?? null,
        assignedEmployeeName: t.assignedEmployee
          ? `${t.assignedEmployee.firstName ?? ''} ${t.assignedEmployee.lastName ?? ''}`.trim()
          : null,
        plannedStart: t.plannedStart ? new Date(t.plannedStart).toISOString() : null,
        plannedCompletion: t.plannedCompletion
          ? new Date(t.plannedCompletion).toISOString()
          : null,
        stageCode: t.stageDefinition?.code ?? null,
      })),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'PLANNED',
          releasedToFactoryAt: null,
          releasedToFactoryById: null,
          // requiredDeliveryDate / committedDeliveryDate intentionally untouched
        },
      });
      if (order.salesOrderId) {
        await tx.salesOrder.updateMany({
          where: {
            id: order.salesOrderId,
            status: { in: ['READY_FOR_PRODUCTION', 'WAITING_FOR_MATERIALS'] },
          },
          data: { status: 'READY_FOR_PRODUCTION' },
        });
      }
      await tx.auditEvent.create({
        data: {
          userId: actorUserId ?? order.createdById ?? null,
          action: 'production-order.return-to-preparing',
          entityType: 'ProductionOrder',
          entityId: id,
          oldValues: planSnapshot as unknown as Prisma.InputJsonValue,
          newValues: {
            releasedToFactoryAt: null,
            salesOrderId: order.salesOrderId,
            salesOrderStatus: 'READY_FOR_PRODUCTION',
            requiredDeliveryDate: order.requiredDeliveryDate ?? null,
            committedDeliveryDate: order.committedDeliveryDate ?? null,
            reason: reason?.trim() || null,
            note: 'Replan: factory plan reopened; previous approved plan retained in oldValues; dealer delivery unchanged.',
          },
        },
      });
    });

    return this.getById(id);
  }

  /**
   * Persist admin production start date, then run smart scheduling so task windows
   * land on/after that date. Soft-fails schedule generate so the date still saves.
   */
  async setProductionStartAndSuggestSchedule(
    id: string,
    plannedStartDateIso: string,
    actorUserId: string,
  ) {
    const plannedStartDate = new Date(plannedStartDateIso);
    if (Number.isNaN(plannedStartDate.getTime())) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Invalid production start date.',
      });
    }
    await this.update(id, { plannedStartDate: plannedStartDateIso });
    try {
      await this.scheduling.generateForProductionOrder(id, actorUserId, {
        persist: true,
        fromDate: plannedStartDate,
        reason: 'plan-production-start',
        failHard: false,
      });
    } catch {
      // Date is saved; admin can still assign windows manually.
    }
    return this.getById(id);
  }

  private async loadCatalogImageIndex(): Promise<
    Array<{
      sku: string;
      nameEn: string | null;
      nameAr: string | null;
      nameHe: string | null;
      imageUrl: string;
    }>
  > {
    const products = await this.prisma.product.findMany({
      where: { imageUrl: { not: null } },
      select: { sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true },
      take: 400,
    });
    return products.filter(
      (p): p is typeof p & { imageUrl: string } => Boolean(p.imageUrl),
    );
  }

  /** Fuzzy catalog image lookup when the PO has no linked product image. */
  private matchCatalogImage(
    productName: string,
    catalog: Array<{
      sku: string;
      nameEn: string | null;
      nameAr: string | null;
      nameHe: string | null;
      imageUrl: string;
    }>,
  ): string | null {
    const needle = productName.trim().toLowerCase();
    if (!needle || catalog.length === 0) return null;
    const tokens = needle
      .split(/[^a-zA-Z\u0600-\u06FF\u0590-\u05FF0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !/^\d+$/.test(t) && t !== 'custom');

    const exact = catalog.find(
      (p) =>
        p.nameEn?.toLowerCase() === needle ||
        p.nameAr?.toLowerCase() === needle ||
        (p.nameHe && p.nameHe.toLowerCase() === needle) ||
        p.sku.toLowerCase() === needle,
    );
    if (exact?.imageUrl) return exact.imageUrl;

    let best: (typeof catalog)[number] | null = null;
    let bestScore = 0;
    for (const p of catalog) {
      const hay = `${p.nameEn ?? ''} ${p.nameAr ?? ''} ${p.nameHe ?? ''} ${p.sku}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (hay.includes(token) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return bestScore >= 1 ? best?.imageUrl ?? null : null;
  }
}
