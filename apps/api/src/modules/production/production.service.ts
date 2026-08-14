import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
import { StagePipelineService } from './stage-pipeline.service';
import {
  mapWorkflowStageAdmin,
  mapWorkflowStageSafe,
} from '../../common/helpers/production-workflow-stages.util';
import { buildTaskTimingSummary, closedSecondsFromTimeEntries } from '../../common/helpers/task-timing.util';

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: StagePipelineService,
  ) {}

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

    let bucketWhere: Prisma.ProductionOrderWhereInput = {};
    if (query.bucket === 'in_production') {
      bucketWhere = { status: { in: [...inProductionStatuses] } };
    } else if (query.bucket === 'late') {
      bucketWhere = {
        requiredDeliveryDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      };
    } else if (query.bucket === 'completed') {
      bucketWhere = { status: 'COMPLETED' };
    } else if (query.bucket === 'daily') {
      bucketWhere = {
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfDay },
      };
    } else if (query.bucket === 'weekly') {
      bucketWhere = {
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfWeek },
      };
    } else if (query.bucket === 'monthly') {
      bucketWhere = {
        status: 'COMPLETED',
        actualCompletionDate: { gte: startOfMonth },
      };
    }

    const where: Prisma.ProductionOrderWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.status ? { status: query.status } : {}),
      ...bucketWhere,
      ...(query.priority ? { priority: query.priority } : {}),
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
      const { stages: _stages, ...rest } = row;
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
      return {
        ...rest,
        customer,
        imageUrl,
        isLate,
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
    const order = await this.prisma.productionOrder.findFirst({
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
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }
    if (!assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your production order.' });
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

    const base = {
      ...order,
      customer: order.salesOrder?.customer ?? null,
      imageUrl,
      isLate,
      openBlockers,
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
    return {
      ...base,
      tasks: tasksWithTiming,
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

  async listAssignableWorkers(q?: string, stageDefinitionId?: string) {
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
    return this.prisma.user.findMany({
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

  async start(id: string) {
    const order = await this.getById(id);
    const allowed = ['DRAFT', 'PLANNED', 'READY', 'WAITING_FOR_MATERIALS'];
    if (!allowed.includes(order.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot start production order in status ${order.status}.`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          actualStartDate: new Date(),
        },
      });
      if (order.salesOrderId) {
        await tx.salesOrder.update({
          where: { id: order.salesOrderId },
          data: { status: 'IN_PRODUCTION' },
        });
      }
      // Unlock only stages with no prerequisites (e.g. MATERIAL_PREP)
      await this.pipeline.unlockReadyStages(id, tx);
      await this.pipeline.rollupProgress(id, tx);
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
