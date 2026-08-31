import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
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
import { releasedToFactoryWhere } from './factory-release';
import {
  intervalsOverlap,
  recommendWorkerBand,
  sortRecommendedWorkers,
} from './worker-recommend';
import { listMissingExecutableTaskSpecs } from './ensure-executable-tasks';
import { ManufacturingCostService } from './manufacturing-cost.service';

/** Executable floor task missing an assignee (excludes logistics/delivery/rework). */
const UNASSIGNED_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  assignedEmployeeId: null,
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
};

const HAS_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
};

/** Executable floor task missing planned timing (no end, or start without end). */
const UNDATED_EXECUTABLE: Prisma.ProductionTaskWhereInput = {
  status: { not: 'CANCELLED' },
  isRework: false,
  stageDefinition: {
    executionKind: { not: 'LOGISTICS' },
    code: { not: 'DELIVERY' },
  },
  OR: [
    { plannedStart: null, plannedCompletion: null },
    { plannedStart: { not: null }, plannedCompletion: null },
  ],
};

const OPEN_BLOCKER_ON_TASK: Prisma.ProductionTaskWhereInput = {
  blockers: { some: { resolvedAt: null } },
};

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
    private readonly sequences: SequenceService,
    private readonly manufacturingCost: ManufacturingCostService,
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

    const now = new Date();
    const inProductionStatuses = [
      'IN_PROGRESS',
      'READY_FOR_PACKAGING',
      'READY_FOR_DELIVERY',
      'WAITING_FOR_MATERIALS',
      'READY',
    ] as const;

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    /** Factory board buckets only include Released-to-factory POs (not Orders Preparing). */
    const factoryOnly = releasedToFactoryWhere();

    let bucketWhere: Prisma.ProductionOrderWhereInput = {};
    if (query.bucket === 'in_production') {
      bucketWhere = { ...factoryOnly, status: { in: [...inProductionStatuses] } };
    } else if (query.bucket === 'late') {
      bucketWhere = {
        ...factoryOnly,
        requiredDeliveryDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      };
    } else if (query.bucket === 'completed') {
      bucketWhere = {
        ...factoryOnly,
        status: { in: ['COMPLETED', 'READY_FOR_DELIVERY'] },
      };
    } else if (query.bucket === 'daily') {
      bucketWhere = {
        ...factoryOnly,
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfDay },
      };
    } else if (query.bucket === 'weekly') {
      bucketWhere = {
        ...factoryOnly,
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfWeek },
      };
    } else if (query.bucket === 'monthly') {
      bucketWhere = {
        ...factoryOnly,
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfMonth },
      };
    } else if (query.bucket === 'needs_setup') {
      // Post-release only — unreleased prep lives under Orders → Preparing.
      bucketWhere = {
        ...factoryOnly,
        status: { in: ['DRAFT', 'PLANNED', 'READY'] },
        OR: [
          { tasks: { none: HAS_EXECUTABLE } },
          { tasks: { some: UNASSIGNED_EXECUTABLE } },
          { tasks: { some: UNDATED_EXECUTABLE } },
        ],
      };
    } else if (query.bucket === 'ready_to_start') {
      // Ready for factory = released + locked plan, no executable task started yet.
      bucketWhere = {
        ...factoryOnly,
        status: { in: ['DRAFT', 'PLANNED', 'READY'] },
        actualStartDate: null,
        tasks: { some: HAS_EXECUTABLE },
        NOT: {
          OR: [
            { tasks: { some: UNASSIGNED_EXECUTABLE } },
            { tasks: { some: UNDATED_EXECUTABLE } },
          ],
        },
      };
    } else if (query.bucket === 'on_floor') {
      bucketWhere = {
        ...factoryOnly,
        status: 'IN_PROGRESS',
        OR: [
          { currentStageCode: null },
          {
            currentStageCode: {
              notIn: ['INSPECTION', 'PACKAGING', 'DELIVERY'],
            },
          },
        ],
      };
    } else if (query.bucket === 'blocked') {
      bucketWhere = {
        ...factoryOnly,
        OR: [
          { status: { in: ['ON_HOLD', 'WAITING_FOR_MATERIALS'] } },
          {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            tasks: { some: OPEN_BLOCKER_ON_TASK },
          },
          {
            requiredDeliveryDate: { lt: now },
            status: { notIn: ['COMPLETED', 'CANCELLED', 'READY_FOR_DELIVERY'] },
          },
        ],
      };
    } else if (query.bucket === 'inspection_packaging') {
      bucketWhere = {
        ...factoryOnly,
        OR: [
          { status: { in: ['QUALITY_CHECK', 'READY_FOR_PACKAGING'] } },
          {
            status: 'IN_PROGRESS',
            currentStageCode: { in: ['INSPECTION', 'PACKAGING'] },
          },
        ],
      };
    }

    const where: Prisma.ProductionOrderWhereInput = {
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
            select: {
              id: true,
              status: true,
              isRework: true,
              assignedEmployeeId: true,
              stageInstanceId: true,
              stageDefinition: {
                select: {
                  id: true,
                  code: true,
                  nameEn: true,
                  nameAr: true,
                  nameHe: true,
                  executionKind: true,
                },
              },
              blockers: {
                where: { resolvedAt: null },
                select: { id: true, category: true, reason: true, resolvedAt: true },
              },
            },
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
      });
      return {
        ...rest,
        customer,
        imageUrl,
        isLate,
        readiness,
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

    return { data: enriched, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async getById(id: string, user?: AuthUser) {
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
    if (windowOk && ids.length > 0) {
      const excludeTaskId = opts?.taskId?.trim() || undefined;
      const overlapping = await this.prisma.productionTask.findMany({
        where: {
          assignedEmployeeId: { in: ids },
          ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
          status: { in: [...openStatuses] },
          productionOrder: { archivedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          plannedCompletion: { not: null },
        },
        select: {
          assignedEmployeeId: true,
          name: true,
          plannedStart: true,
          plannedCompletion: true,
          productionOrder: { select: { number: true } },
        },
      });
      for (const t of overlapping) {
        if (!t.assignedEmployeeId || !t.plannedCompletion) continue;
        const oStart = t.plannedStart ?? new Date(t.plannedCompletion.getTime() - 3600_000);
        if (intervalsOverlap(windowStart!, windowEnd!, oStart, t.plannedCompletion)) {
          overlapByWorker.add(t.assignedEmployeeId);
          const list = overlapWindowsByWorker.get(t.assignedEmployeeId) ?? [];
          list.push({
            start: oStart.toISOString(),
            end: t.plannedCompletion.toISOString(),
            label: `${t.productionOrder?.number ?? ''} ${t.name}`.trim(),
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
      return {
        ...w,
        activeTaskCount,
        recommendBand: rec.band,
        recommendReason: rec.reason,
        recommendReasonCode: rec.reasonCode,
        overlapWindows: overlapWindows.length > 0 ? overlapWindows : undefined,
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
   * unlocks eligible stages for workers. Does **not** mark the PO IN_PROGRESS;
   * first real task start does that via StagePipelineService.onTaskStart.
   */
  async start(id: string, actorUserId?: string) {
    const order = await this.getById(id);

    if (order.releasedToFactoryAt) {
      return order;
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
      });

    const hardBlock = readiness.reasons.filter(
      (r: { code: string }) =>
        r.code === 'MISSING_ASSIGNMENT' ||
        r.code === 'MISSING_DATE' ||
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
          // Stay pre-floor until a real task starts; READY marks released plan.
          status: order.status === 'WAITING_FOR_MATERIALS' ? 'WAITING_FOR_MATERIALS' : 'READY',
          releasedToFactoryAt: now,
          releasedToFactoryById: actorUserId ?? order.createdById ?? null,
        },
      });
      // Do NOT set SalesOrder IN_PRODUCTION here — that waits for first executable task start.
      // Keep commercial SO on READY_FOR_PRODUCTION (or WAITING_FOR_MATERIALS) until then.
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
          },
        },
      });
    });

    return this.getById(id);
  }

  /**
   * Edit plan — Ready to start → Preparing.
   * Clears factory release, unlocks the plan for admin edits, keeps SO in a Preparing-compatible status.
   * Rejected once any executable task has started.
   */
  async returnToPreparing(id: string, actorUserId?: string) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'PLANNED',
          releasedToFactoryAt: null,
          releasedToFactoryById: null,
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
          newValues: {
            releasedToFactoryAt: null,
            salesOrderId: order.salesOrderId,
            salesOrderStatus: 'READY_FOR_PRODUCTION',
          },
        },
      });
    });

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
