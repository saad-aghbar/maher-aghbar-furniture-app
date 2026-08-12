import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  InvoiceStatus,
  Priority,
  Prisma,
  ProductionOrderStatus,
  SalesOrderStatus,
  TaskStatus,
} from '@maher/database';
import { hasPermission, type Permission } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { calculateOrderCosts } from '../../common/helpers/order-costing.util';
import { mapProgressForDealer } from '../../common/helpers/dealer-progress.util';
import { roundMoney } from '../../common/helpers/money.util';
import { buildTaskTimingSummary } from '../../common/helpers/task-timing.util';

const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.NOT_STARTED,
  TaskStatus.READY,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PAUSED,
  TaskStatus.BLOCKED,
  TaskStatus.READY_FOR_INSPECTION,
];

export type SalesReportFilters = {
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
  salesRepId?: string;
};

export type ReportPeriodFilters = {
  from?: string;
  to?: string;
  customerId?: string;
};

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);

    const [
      newOrders,
      ordersInProduction,
      ordersNearingDelivery,
      completedOrders,
      delayedOrders,
      openInvoices,
      outstandingAgg,
      dealersActive,
      pendingReturns,
      inventoryForLowStock,
      recentSalesOrders,
    ] = await Promise.all([
      this.prisma.requestForQuotation.count({
        where: {
          archivedAt: null,
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'READY_FOR_QUOTATION'],
          },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          status: {
            in: [
              SalesOrderStatus.READY_FOR_PRODUCTION,
              SalesOrderStatus.IN_PRODUCTION,
              SalesOrderStatus.WAITING_FOR_MATERIALS,
            ],
          },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lte: soon, gte: now },
          status: {
            notIn: [
              SalesOrderStatus.COMPLETED,
              SalesOrderStatus.CANCELLED,
              SalesOrderStatus.DELIVERED,
            ],
          },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          status: { in: [SalesOrderStatus.COMPLETED, SalesOrderStatus.DELIVERED] },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lt: now },
          status: {
            notIn: [
              SalesOrderStatus.COMPLETED,
              SalesOrderStatus.CANCELLED,
              SalesOrderStatus.DELIVERED,
            ],
          },
        },
      }),
      this.prisma.invoice.count({
        where: {
          archivedAt: null,
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE],
          },
          outstandingAmount: { gt: 0 },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          archivedAt: null,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.customer.count({
        where: { archivedAt: null, status: 'ACTIVE' },
      }),
      this.prisma.returnRequest.count({
        where: { approvalStatus: 'PENDING' },
      }),
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        select: {
          minStock: true,
          balances: { select: { availableQty: true } },
        },
        take: 500,
      }),
      this.prisma.salesOrder.findMany({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          customer: {
            select: { name: true, nameEn: true, nameAr: true, nameHe: true },
          },
          lines: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            include: {
              product: {
                select: {
                  nameEn: true,
                  nameAr: true,
                  nameHe: true,
                  imageUrl: true,
                },
              },
            },
          },
          quotation: {
            select: {
              request: {
                select: {
                  externalOrderNumber: true,
                  endCustomerName: true,
                  items: {
                    orderBy: { sortOrder: 'asc' },
                    take: 1,
                    select: { productName: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const lowStockItems = inventoryForLowStock.filter((item) => {
      const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
      return available <= Number(item.minStock);
    }).length;

    const recentOrders = recentSalesOrders.map((so) => {
      const line = so.lines[0];
      const product = line?.product;
      const title =
        product?.nameEn ||
        product?.nameAr ||
        line?.description ||
        so.quotation?.request?.items?.[0]?.productName ||
        so.number;
      return {
        id: so.id,
        number: so.number,
        status: so.status,
        title,
        imageUrl: product?.imageUrl ?? null,
        customerName:
          so.customer.nameEn || so.customer.nameAr || so.customer.name || so.customer.nameHe || null,
        externalOrderNumber:
          so.externalOrderNumber?.trim() ||
          so.quotation?.request?.externalOrderNumber?.trim() ||
          null,
        endCustomerName: so.quotation?.request?.endCustomerName ?? null,
      };
    });

    return {
      newOrders,
      ordersInProduction,
      ordersNearingDelivery,
      completedOrders,
      delayedOrders,
      openInvoices,
      outstandingReceivables: roundMoney(Number(outstandingAgg._sum.outstandingAmount ?? 0)),
      dealersActive,
      pendingReturns,
      lowStockItems,
      recentOrders,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mobile admin Home aggregate — dashboard metrics plus completed-today,
   * urgent tasks, unread notifications, and optional audit activity.
   */
  async adminHome(user: AuthUser) {
    const perms = user.permissions ?? [];
    const can = (p: Permission) => hasPermission(perms, p);

    const canTasks = can('production-task.read');
    const canNotifications = can('notification.read');
    const canAudit = can('audit.read');

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);

    const closedStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.COMPLETED,
      SalesOrderStatus.CANCELLED,
      SalesOrderStatus.DELIVERED,
    ];
    const productionStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
    ];

    const spotlightSelect = {
      id: true,
      number: true,
      status: true,
      requiredDeliveryDate: true,
      externalOrderNumber: true,
      customer: {
        select: { name: true, nameEn: true, nameAr: true, nameHe: true },
      },
      lines: {
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        select: {
          description: true,
          product: {
            select: {
              nameEn: true,
              nameAr: true,
              nameHe: true,
              imageUrl: true,
            },
          },
        },
      },
      quotation: {
        select: {
          request: {
            select: {
              externalOrderNumber: true,
              endCustomerName: true,
              items: {
                orderBy: { sortOrder: 'asc' as const },
                take: 1,
                select: { productName: true },
              },
            },
          },
        },
      },
    };

    const urgentWhere: Prisma.ProductionTaskWhereInput = {
      priority: { in: ['URGENT', 'HIGH'] },
      status: { in: OPEN_TASK_STATUSES },
    };

    const [
      dashboard,
      completedToday,
      urgentTasksCount,
      urgentTasksRows,
      unreadNotifications,
      activityRows,
      lateSpotlight,
      nearSpotlight,
      prodSpotlight,
    ] =
      await Promise.all([
        this.dashboard(),
        this.prisma.productionOrder.count({
          where: {
            archivedAt: null,
            status: ProductionOrderStatus.COMPLETED,
            actualCompletionDate: { gte: startOfDay },
          },
        }),
        canTasks ? this.prisma.productionTask.count({ where: urgentWhere }) : Promise.resolve(0),
        canTasks
          ? this.prisma.productionTask.findMany({
              where: urgentWhere,
              orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
              take: 3,
              select: {
                id: true,
                number: true,
                name: true,
                priority: true,
                status: true,
                plannedCompletion: true,
                assignedEmployee: {
                  select: { firstName: true, lastName: true },
                },
              },
            })
          : Promise.resolve([]),
        canNotifications
          ? this.prisma.notification.count({
              where: { userId: user.id, readAt: null },
            })
          : Promise.resolve(0),
        canAudit
          ? this.prisma.auditEvent.findMany({
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                action: true,
                entityType: true,
                entityId: true,
                createdAt: true,
                user: { select: { firstName: true, lastName: true } },
              },
            })
          : Promise.resolve([]),
        // Floor spotlight candidates — priority decided after fetch (late > near > production).
        this.prisma.salesOrder.findFirst({
          where: {
            archivedAt: null,
            requiredDeliveryDate: { lt: now },
            status: { notIn: closedStatuses },
          },
          orderBy: { requiredDeliveryDate: 'asc' },
          select: spotlightSelect,
        }),
        this.prisma.salesOrder.findFirst({
          where: {
            archivedAt: null,
            requiredDeliveryDate: { lte: soon, gte: now },
            status: { notIn: closedStatuses },
          },
          orderBy: { requiredDeliveryDate: 'asc' },
          select: spotlightSelect,
        }),
        this.prisma.salesOrder.findFirst({
          where: {
            archivedAt: null,
            status: { in: productionStatuses },
          },
          orderBy: [{ requiredDeliveryDate: 'asc' }, { createdAt: 'asc' }],
          select: spotlightSelect,
        }),
      ]);

    const mapSpotlightOrder = (so: NonNullable<typeof lateSpotlight>) => {
      const line = so.lines[0];
      const product = line?.product;
      const title =
        product?.nameEn ||
        product?.nameAr ||
        line?.description ||
        so.quotation?.request?.items?.[0]?.productName ||
        so.number;
      return {
        id: so.id,
        number: so.number,
        status: so.status,
        title,
        imageUrl: product?.imageUrl ?? null,
        customerName:
          so.customer.nameEn || so.customer.nameAr || so.customer.name || so.customer.nameHe || null,
        externalOrderNumber:
          so.externalOrderNumber?.trim() ||
          so.quotation?.request?.externalOrderNumber?.trim() ||
          null,
        endCustomerName: so.quotation?.request?.endCustomerName ?? null,
        requiredDeliveryDate: so.requiredDeliveryDate?.toISOString() ?? null,
      };
    };

    /**
     * One exemplar from the hottest open queue — never “newest of 8 recent”.
     * late (soonest overdue) → nearing (soonest due) → in production (oldest due / oldest created).
     */
    let floorSpotlight:
      | {
          order: ReturnType<typeof mapSpotlightOrder>;
          reason: 'late' | 'nearing' | 'in_production';
          peerCount: number;
        }
      | null = null;

    if (lateSpotlight && dashboard.delayedOrders > 0) {
      floorSpotlight = {
        order: mapSpotlightOrder(lateSpotlight),
        reason: 'late',
        peerCount: dashboard.delayedOrders,
      };
    } else if (nearSpotlight && dashboard.ordersNearingDelivery > 0) {
      floorSpotlight = {
        order: mapSpotlightOrder(nearSpotlight),
        reason: 'nearing',
        peerCount: dashboard.ordersNearingDelivery,
      };
    } else if (prodSpotlight && dashboard.ordersInProduction > 0) {
      floorSpotlight = {
        order: mapSpotlightOrder(prodSpotlight),
        reason: 'in_production',
        peerCount: dashboard.ordersInProduction,
      };
    }

    return {
      ...dashboard,
      completedToday,
      urgentTasksCount,
      urgentTasks: urgentTasksRows.map((t) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        priority: t.priority,
        status: t.status,
        plannedCompletion: t.plannedCompletion?.toISOString() ?? null,
        assigneeName: t.assignedEmployee
          ? `${t.assignedEmployee.firstName} ${t.assignedEmployee.lastName}`.trim()
          : null,
      })),
      unreadNotifications,
      recentActivity: canAudit
        ? activityRows.map((e) => ({
            id: e.id,
            action: e.action,
            entityType: e.entityType,
            entityId: e.entityId,
            createdAt: e.createdAt.toISOString(),
            actorName: e.user ? `${e.user.firstName} ${e.user.lastName}`.trim() : null,
          }))
        : null,
      floorSpotlight,
    };
  }

  /**
   * Mobile dealer Home — customer-scoped only. Never includes costs, workers, or stages.
   */
  async dealerHome(user: AuthUser) {
    if (!user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealer home requires a linked customer account.',
      });
    }

    const customerId = user.customerId;
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);

    const closed: SalesOrderStatus[] = [
      SalesOrderStatus.COMPLETED,
      SalesOrderStatus.CANCELLED,
      SalesOrderStatus.DELIVERED,
    ];
    const productionStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
    ];
    const openInvoiceStatuses: InvoiceStatus[] = [
      InvoiceStatus.ISSUED,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ];

    const baseSo: Prisma.SalesOrderWhereInput = { archivedAt: null, customerId };
    const canNotifications = hasPermission(user.permissions ?? [], 'notification.read');

    const [
      activeOrders,
      ordersInProduction,
      ordersNearingDelivery,
      completedOrders,
      outstandingAgg,
      dueInvoice,
      unreadNotifications,
      recentSalesOrders,
      recentInvoiceRows,
    ] = await Promise.all([
      this.prisma.salesOrder.count({
        where: { ...baseSo, status: { notIn: closed } },
      }),
      this.prisma.salesOrder.count({
        where: { ...baseSo, status: { in: productionStatuses } },
      }),
      this.prisma.salesOrder.count({
        where: {
          ...baseSo,
          requiredDeliveryDate: { lte: soon, gte: now },
          status: { notIn: closed },
        },
      }),
      this.prisma.salesOrder.count({
        where: {
          ...baseSo,
          status: { in: [SalesOrderStatus.COMPLETED, SalesOrderStatus.DELIVERED] },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          archivedAt: null,
          customerId,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT] },
        },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.invoice.findFirst({
        where: {
          archivedAt: null,
          customerId,
          status: { in: openInvoiceStatuses },
          outstandingAmount: { gt: 0 },
          dueDate: { not: null },
        },
        orderBy: { dueDate: 'asc' },
        select: { dueDate: true },
      }),
      canNotifications
        ? this.prisma.notification.count({
            where: { userId: user.id, readAt: null },
          })
        : Promise.resolve(0),
      this.prisma.salesOrder.findMany({
        where: { ...baseSo, status: { notIn: [SalesOrderStatus.CANCELLED] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          requiredDeliveryDate: true,
          externalOrderNumber: true,
          lines: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: {
              description: true,
              product: {
                select: {
                  nameEn: true,
                  nameAr: true,
                  nameHe: true,
                  imageUrl: true,
                },
              },
            },
          },
          quotation: {
            select: {
              request: {
                select: {
                  externalOrderNumber: true,
                  endCustomerName: true,
                  items: {
                    orderBy: { sortOrder: 'asc' },
                    take: 1,
                    select: { productName: true },
                  },
                },
              },
            },
          },
          productionOrders: {
            select: { progressPercent: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          archivedAt: null,
          customerId,
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.VOID] },
        },
        orderBy: { invoiceDate: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          outstandingAmount: true,
          invoiceDate: true,
          dueDate: true,
        },
      }),
    ]);

    const outstandingBalance = Number(outstandingAgg._sum.outstandingAmount ?? 0);
    let balanceDueInDays: number | null = null;
    if (dueInvoice?.dueDate && outstandingBalance > 0) {
      const ms = dueInvoice.dueDate.getTime() - now.getTime();
      balanceDueInDays = Math.ceil(ms / (1000 * 60 * 60 * 24));
    }

    const recentOrders = recentSalesOrders.map((so) => {
      const line = so.lines[0];
      const product = line?.product;
      const title =
        product?.nameEn ||
        product?.nameAr ||
        line?.description ||
        so.quotation?.request?.items?.[0]?.productName ||
        so.number;
      const rawProgress = so.productionOrders.reduce(
        (max, po) => Math.max(max, po.progressPercent ?? 0),
        so.status === SalesOrderStatus.DELIVERED || so.status === SalesOrderStatus.COMPLETED
          ? 100
          : 0,
      );
      const coarse = mapProgressForDealer({ progressPercent: rawProgress });
      return {
        id: so.id,
        number: so.number,
        status: so.status,
        title,
        imageUrl: product?.imageUrl ?? null,
        progressPercent: coarse.progressPercent,
        progressLabel: coarse.progressLabel,
        externalOrderNumber:
          so.externalOrderNumber?.trim() ||
          so.quotation?.request?.externalOrderNumber?.trim() ||
          null,
        endCustomerName: so.quotation?.request?.endCustomerName ?? null,
        requiredDeliveryDate: so.requiredDeliveryDate?.toISOString() ?? null,
      };
    });

    return {
      activeOrders,
      ordersInProduction,
      ordersNearingDelivery,
      completedOrders,
      outstandingBalance: roundMoney(outstandingBalance),
      balanceDueInDays,
      unreadNotifications,
      recentOrders,
      recentInvoices: recentInvoiceRows.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        total: roundMoney(Number(inv.total)),
        outstandingAmount: roundMoney(Number(inv.outstandingAmount)),
        issuedAt: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Mobile worker Home — always scoped to assignedEmployeeId = user.id.
   * Never honors update-any; never returns progress %, costs, or other workers.
   */
  async workerHome(user: AuthUser, localeOverride?: string | null) {
    const assigneeId = user.id;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const mine: Prisma.ProductionTaskWhereInput = { assignedEmployeeId: assigneeId };
    const openMine: Prisma.ProductionTaskWhereInput = {
      ...mine,
      status: { in: OPEN_TASK_STATUSES },
    };
    const canNotifications = hasPermission(user.permissions ?? [], 'notification.read');
    const rawLang = String(localeOverride || user.preferredLanguage || 'en').toLowerCase();
    const lang = rawLang.startsWith('ar') ? 'ar' : rawLang.startsWith('he') ? 'he' : 'en';

    const taskSelect = {
      id: true,
      number: true,
      name: true,
      priority: true,
      status: true,
      plannedCompletion: true,
      estimatedMinutes: true,
      actualMinutes: true,
      timeEntries: {
        where: { endedAt: null },
        orderBy: { startedAt: 'desc' as const },
        take: 1,
        select: { startedAt: true },
      },
      stageDefinition: {
        select: {
          estimatedHours: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
        },
      },
      productionOrder: {
        select: {
          number: true,
          productDescription: true,
          salesOrder: { select: { number: true } },
          product: {
            select: {
              nameEn: true,
              nameAr: true,
              nameHe: true,
              imageUrl: true,
            },
          },
        },
      },
    } as const;

    const [
      completedTodayCount,
      unreadNotifications,
      openTasks,
      notificationRows,
    ] = await Promise.all([
      this.prisma.productionTask.count({
        where: {
          ...mine,
          status: TaskStatus.COMPLETED,
          actualCompletion: { gte: startOfDay, lte: endOfDay },
        },
      }),
      canNotifications
        ? this.prisma.notification.count({
            where: { userId: assigneeId, readAt: null },
          })
        : Promise.resolve(0),
      this.prisma.productionTask.findMany({
        where: openMine,
        orderBy: [{ priority: 'desc' }, { plannedCompletion: 'asc' }, { createdAt: 'desc' }],
        take: 12,
        select: taskSelect,
      }),
      canNotifications
        ? this.prisma.notification.findMany({
            where: { userId: assigneeId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              titleEn: true,
              titleAr: true,
              bodyEn: true,
              bodyAr: true,
              createdAt: true,
              readAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const mapTask = (t: (typeof openTasks)[number]) => {
      const product = t.productionOrder.product;
      const stage = t.stageDefinition;
      const productTitle =
        (lang === 'ar' ? product?.nameAr : lang === 'he' ? product?.nameHe : product?.nameEn) ||
        product?.nameEn ||
        product?.nameAr ||
        product?.nameHe ||
        t.productionOrder.productDescription ||
        t.name;
      const stageName =
        (lang === 'ar' ? stage?.nameAr : lang === 'he' ? stage?.nameHe : stage?.nameEn) ||
        stage?.nameEn ||
        stage?.nameAr ||
        stage?.nameHe ||
        t.name;
      const fromHours = stage?.estimatedHours
        ? Math.round(Number(stage.estimatedHours) * 60)
        : null;
      const estimatedMinutes =
        typeof t.estimatedMinutes === 'number' && t.estimatedMinutes > 0
          ? t.estimatedMinutes
          : fromHours && fromHours > 0
            ? fromHours
            : null;
      const timing = buildTaskTimingSummary({
        status: t.status,
        actualMinutes: t.actualMinutes,
        estimatedMinutes,
        plannedCompletion: t.plannedCompletion,
        openStartedAt: t.timeEntries?.[0]?.startedAt ?? null,
      });
      return {
        id: t.id,
        number: t.number,
        /** Localized stage label (legacy). Prefer nameEn/Ar/He on the client. */
        name: stageName,
        nameEn: stage?.nameEn ?? null,
        nameAr: stage?.nameAr ?? null,
        nameHe: stage?.nameHe ?? null,
        priority: t.priority,
        status: t.status,
        orderNumber:
          t.productionOrder.salesOrder?.number ?? t.productionOrder.number,
        productTitle,
        productNameEn: product?.nameEn ?? null,
        productNameAr: product?.nameAr ?? null,
        productNameHe: product?.nameHe ?? null,
        imageUrl: product?.imageUrl ?? null,
        deadline: t.plannedCompletion?.toISOString() ?? null,
        estimatedMinutes,
        timing,
      };
    };

    const urgentRaw =
      openTasks.find((t) => t.priority === Priority.URGENT) ??
      openTasks.find((t) => t.priority === Priority.HIGH) ??
      null;
    const urgentTask = urgentRaw ? mapTask(urgentRaw) : null;
    const todaysTasks = openTasks
      .filter((t) => t.id !== urgentRaw?.id)
      .slice(0, 10)
      .map(mapTask);

    return {
      completedTodayCount,
      unreadNotifications,
      urgentTask,
      todaysTasks,
      notifications: notificationRows.map((n) => ({
        id: n.id,
        title:
          lang === 'ar' ? n.titleAr : lang === 'he' ? n.titleEn : n.titleEn,
        body: lang === 'ar' ? n.bodyAr : lang === 'he' ? n.bodyEn : n.bodyEn,
        titleEn: n.titleEn,
        titleAr: n.titleAr,
        bodyEn: n.bodyEn,
        bodyAr: n.bodyAr,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private salesOrderWhere(filters: SalesReportFilters = {}): Prisma.SalesOrderWhereInput {
    const orderDate = dateRange(filters.from, filters.to);
    return {
      archivedAt: null,
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(orderDate ? { orderDate } : {}),
      ...(filters.productId ? { lines: { some: { productId: filters.productId } } } : {}),
      ...(filters.salesRepId ? { quotation: { is: { salesRepId: filters.salesRepId } } } : {}),
    };
  }

  async sales(filters: SalesReportFilters = {}) {
    const where = this.salesOrderWhere(filters);

    const [byStatus, topCustomersRaw, recentQuotes, byProductRaw, byRepRaw] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.salesOrder.groupBy({
        by: ['customerId'],
        where,
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
        take: 10,
      }),
      this.prisma.quotation.findMany({
        where: {
          archivedAt: null,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.salesRepId ? { salesRepId: filters.salesRepId } : {}),
          ...(dateRange(filters.from, filters.to)
            ? { createdAt: dateRange(filters.from, filters.to) }
            : {}),
        },
        include: {
          customer: true,
          salesRep: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.salesOrderLine.groupBy({
        by: ['productId'],
        where: {
          productId: { not: null },
          ...(filters.productId ? { productId: filters.productId } : {}),
          salesOrder: where,
        },
        _sum: { lineTotal: true, quantity: true },
        _count: true,
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10,
      }),
      this.prisma.quotation.groupBy({
        by: ['salesRepId'],
        where: {
          archivedAt: null,
          salesRepId: { not: null },
          ...(filters.salesRepId ? { salesRepId: filters.salesRepId } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          salesOrders: { some: where },
        },
        _count: true,
        orderBy: { _count: { salesRepId: 'desc' } },
        take: 10,
      }),
    ]);

    const customerIds = topCustomersRaw.map((c) => c.customerId);
    const productIds = byProductRaw.map((p) => p.productId).filter(Boolean) as string[];
    const repIds = byRepRaw.map((r) => r.salesRepId).filter(Boolean) as string[];

    const [customers, products, reps] = await Promise.all([
      this.prisma.customer.findMany({ where: { id: { in: customerIds } } }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, nameEn: true, nameAr: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: repIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);
    const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const repMap = Object.fromEntries(reps.map((r) => [r.id, r]));

    return {
      filters,
      ordersByStatus: byStatus.map((row) => ({
        status: row.status,
        count: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
      })),
      topCustomers: topCustomersRaw.map((row) => ({
        customerId: row.customerId,
        customerName: customerMap[row.customerId]?.name ?? row.customerId,
        orderCount: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
      })),
      topProducts: byProductRaw.map((row) => {
        const product = row.productId ? productMap[row.productId] : null;
        return {
          productId: row.productId,
          sku: product?.sku ?? null,
          name: product?.nameEn || product?.nameAr || row.productId,
          lineCount: row._count,
          quantity: roundMoney(Number(row._sum.quantity ?? 0)),
          total: roundMoney(Number(row._sum.lineTotal ?? 0)),
        };
      }),
      bySalesRep: byRepRaw.map((row) => {
        const rep = row.salesRepId ? repMap[row.salesRepId] : null;
        const name = rep
          ? `${rep.firstName} ${rep.lastName}`.trim() || rep.email || row.salesRepId
          : row.salesRepId;
        return {
          salesRepId: row.salesRepId,
          name,
          quotationCount: row._count,
        };
      }),
      recentQuotes: recentQuotes.map((q) => ({
        id: q.id,
        number: q.number,
        version: q.version,
        status: q.status,
        total: q.total,
        customer: q.customer.name,
        salesRep: q.salesRep
          ? `${q.salesRep.firstName} ${q.salesRep.lastName}`.trim() || q.salesRep.email
          : null,
        createdAt: q.createdAt.toISOString(),
      })),
    };
  }

  async production(filters: ReportPeriodFilters = {}) {
    const now = new Date();
    const requiredDeliveryDate = dateRange(filters.from, filters.to);
    const baseWhere: Prisma.ProductionOrderWhereInput = {
      archivedAt: null,
      ...(filters.customerId ? { salesOrder: { customerId: filters.customerId } } : {}),
    };

    const [byStatus, delayed, open, stageThroughput] = await Promise.all([
      this.prisma.productionOrder.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.productionOrder.findMany({
        where: {
          ...baseWhere,
          requiredDeliveryDate: {
            lt: now,
            ...(requiredDeliveryDate?.gte ? { gte: requiredDeliveryDate.gte } : {}),
            ...(requiredDeliveryDate?.lte ? { lte: requiredDeliveryDate.lte } : {}),
          },
          status: {
            notIn: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
          },
        },
        include: {
          salesOrder: {
            select: {
              id: true,
              number: true,
              customer: {
                select: { id: true, name: true, nameEn: true, nameAr: true },
              },
            },
          },
        },
        orderBy: { requiredDeliveryDate: 'asc' },
        take: 100,
      }),
      this.prisma.productionOrder.findMany({
        where: {
          ...baseWhere,
          status: {
            notIn: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
          },
          ...(requiredDeliveryDate ? { requiredDeliveryDate } : {}),
        },
        include: {
          salesOrder: {
            select: {
              id: true,
              number: true,
              customer: {
                select: { id: true, name: true, nameEn: true, nameAr: true },
              },
            },
          },
        },
        orderBy: [{ requiredDeliveryDate: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.productionTask.groupBy({
        by: ['status'],
        where: filters.customerId
          ? { productionOrder: { salesOrder: { customerId: filters.customerId } } }
          : undefined,
        _count: true,
      }),
    ]);

    const [plannedVsActual, onTimeRate] = await Promise.all([
      this.taskPlannedVsActual(filters, requiredDeliveryDate),
      this.productionOnTimeRate(baseWhere, requiredDeliveryDate),
    ]);

    const mapPo = (po: (typeof delayed)[number], opts: { late?: boolean } = {}) => {
      const due = po.requiredDeliveryDate ? new Date(po.requiredDeliveryDate).getTime() : null;
      const daysLate =
        opts.late && due != null ? Math.max(0, Math.floor((now.getTime() - due) / 86_400_000)) : 0;
      const customer = po.salesOrder?.customer;
      return {
        id: po.id,
        number: po.number,
        status: po.status,
        currentStageCode: po.currentStageCode,
        progressPercent: po.progressPercent,
        requiredDeliveryDate: po.requiredDeliveryDate,
        daysLate,
        salesOrderId: po.salesOrderId,
        salesOrder: po.salesOrder ? { id: po.salesOrder.id, number: po.salesOrder.number } : null,
        customerName: customer?.nameEn || customer?.nameAr || customer?.name || null,
        customerId: customer?.id ?? null,
      };
    };

    return {
      filters,
      ordersByStatus: byStatus,
      delayedOrders: delayed.map((po) => mapPo(po, { late: true })),
      openOrders: open.map((po) => mapPo(po)),
      openCount: open.length,
      delayedCount: delayed.length,
      tasksByStatus: stageThroughput,
      plannedVsActual,
      onTimeRate,
    };
  }

  /**
   * Estimated vs actual minutes for completed tasks in the period — a
   * placeholder scheduling-accuracy signal until enough production history
   * has accumulated for richer analytics (see StageEstimateStat).
   */
  private async taskPlannedVsActual(
    filters: ReportPeriodFilters,
    completedRange?: Prisma.DateTimeFilter,
  ) {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        status: TaskStatus.COMPLETED,
        estimatedMinutes: { not: null },
        actualMinutes: { not: null },
        ...(completedRange ? { actualCompletion: completedRange } : {}),
        ...(filters.customerId
          ? { productionOrder: { salesOrder: { customerId: filters.customerId } } }
          : {}),
      },
      select: { estimatedMinutes: true, actualMinutes: true },
      take: 5000,
    });

    if (tasks.length === 0) {
      return {
        sampleSize: 0,
        avgPlannedMinutes: null,
        avgActualMinutes: null,
        varianceMinutes: null,
        variancePercent: null,
      };
    }

    const plannedTotal = tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
    const actualTotal = tasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);
    const avgPlannedMinutes = Math.round(plannedTotal / tasks.length);
    const avgActualMinutes = Math.round(actualTotal / tasks.length);
    const varianceMinutes = avgActualMinutes - avgPlannedMinutes;
    const variancePercent =
      avgPlannedMinutes > 0 ? Math.round((varianceMinutes / avgPlannedMinutes) * 1000) / 10 : null;

    return {
      sampleSize: tasks.length,
      avgPlannedMinutes,
      avgActualMinutes,
      varianceMinutes,
      variancePercent,
    };
  }

  /**
   * Share of completed production orders finished by their committed (or
   * required) delivery date — a placeholder until ScheduleAllocation history
   * is deep enough to break this down per department/stage.
   */
  private async productionOnTimeRate(
    baseWhere: Prisma.ProductionOrderWhereInput,
    completedRange?: Prisma.DateTimeFilter,
  ) {
    const completed = await this.prisma.productionOrder.findMany({
      where: {
        ...baseWhere,
        status: ProductionOrderStatus.COMPLETED,
        actualCompletionDate: { not: null, ...(completedRange ?? {}) },
      },
      select: {
        actualCompletionDate: true,
        committedDeliveryDate: true,
        requiredDeliveryDate: true,
        plannedCompletionDate: true,
      },
      take: 5000,
    });

    const withDueDate = completed.filter(
      (po) => po.committedDeliveryDate || po.requiredDeliveryDate || po.plannedCompletionDate,
    );
    if (withDueDate.length === 0) {
      return { sampleSize: 0, onTimeCount: 0, onTimeRate: null };
    }

    const onTimeCount = withDueDate.filter((po) => {
      const due = po.committedDeliveryDate ?? po.requiredDeliveryDate ?? po.plannedCompletionDate;
      return due && po.actualCompletionDate && po.actualCompletionDate.getTime() <= due.getTime();
    }).length;

    return {
      sampleSize: withDueDate.length,
      onTimeCount,
      onTimeRate: Math.round((onTimeCount / withDueDate.length) * 1000) / 10,
    };
  }

  async orderProfit(filters: ReportPeriodFilters = {}) {
    const where = this.salesOrderWhere(filters);
    const orders = await this.prisma.salesOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, nameEn: true, nameAr: true } },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                manufacturingCost: true,
                basePrice: true,
                bomDefaults: true,
              },
            },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 200,
    });

    const materialRows = await this.prisma.inventoryTransaction.findMany({
      where: { unitCost: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        unitCost: true,
        type: true,
        inventoryItem: { select: { sku: true } },
      },
      take: 800,
    });
    const materialCosts = new Map<string, number>();
    const ranked = [...materialRows].sort((a, b) => {
      const rank = (t: string) => (t === 'PURCHASE_RECEIPT' ? 0 : 1);
      return rank(a.type) - rank(b.type);
    });
    for (const tx of ranked) {
      const sku = tx.inventoryItem.sku;
      if (!materialCosts.has(sku) && tx.unitCost != null) {
        materialCosts.set(sku, Number(tx.unitCost));
      }
    }

    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    const dealerPriceRows = await this.prisma.dealerPrice.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true, productId: true, price: true },
    });
    const dealerByCustomer = new Map<string, Map<string, number>>();
    for (const row of dealerPriceRows) {
      let map = dealerByCustomer.get(row.customerId);
      if (!map) {
        map = new Map();
        dealerByCustomer.set(row.customerId, map);
      }
      map.set(row.productId, Number(row.price));
    }

    const rows = orders.map((order) => {
      const storedCost = order.manufacturingCost != null ? Number(order.manufacturingCost) : null;
      const costs = calculateOrderCosts(order.lines, {
        customerId: order.customerId,
        dealerPrices: dealerByCustomer.get(order.customerId),
        materialCosts,
        fallbackSellerTotal: order.total,
      });
      const sellerPrice = costs.sellerPrice || Number(order.total);
      const productionPrice =
        storedCost != null && storedCost > 0 ? storedCost : costs.productionPrice;
      const profit = roundMoney(sellerPrice - productionPrice);
      const customer = order.customer;
      return {
        id: order.id,
        number: order.number,
        status: order.status,
        orderDate: order.orderDate.toISOString(),
        customerId: order.customerId,
        customerName: customer.nameEn || customer.nameAr || customer.name,
        sellerPrice: roundMoney(sellerPrice),
        productionPrice: roundMoney(productionPrice),
        profit,
        marginPercent: sellerPrice > 0 ? roundMoney((Number(profit) / sellerPrice) * 100) : 0,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.sellerPrice += Number(row.sellerPrice);
        acc.productionPrice += Number(row.productionPrice);
        acc.profit += Number(row.profit);
        return acc;
      },
      { sellerPrice: 0, productionPrice: 0, profit: 0 },
    );

    return {
      filters,
      totals: {
        sellerPrice: roundMoney(totals.sellerPrice),
        productionPrice: roundMoney(totals.productionPrice),
        profit: roundMoney(totals.profit),
        orderCount: rows.length,
      },
      orders: rows,
    };
  }

  async productivity(filters: ReportPeriodFilters = {}) {
    const startedAt = dateRange(filters.from, filters.to);
    const entries = await this.prisma.taskTimeEntry.findMany({
      where: {
        ...(startedAt ? { startedAt } : {}),
        ...(filters.customerId
          ? {
              task: {
                productionOrder: { salesOrder: { customerId: filters.customerId } },
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        task: {
          select: {
            id: true,
            status: true,
            productionOrder: {
              select: {
                number: true,
                currentStageCode: true,
                salesOrder: {
                  select: {
                    number: true,
                    customer: { select: { name: true, nameEn: true, nameAr: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 1000,
    });

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        minutes: number;
        entries: number;
        completedTasks: number;
      }
    >();

    for (const entry of entries) {
      const minutes =
        entry.minutes != null
          ? entry.minutes
          : entry.endedAt
            ? Math.max(
                0,
                Math.round((entry.endedAt.getTime() - entry.startedAt.getTime()) / 60_000),
              )
            : 0;
      const existing = byUser.get(entry.userId) ?? {
        userId: entry.userId,
        name:
          `${entry.user.firstName} ${entry.user.lastName}`.trim() ||
          entry.user.email ||
          entry.userId,
        minutes: 0,
        entries: 0,
        completedTasks: 0,
      };
      existing.minutes += minutes;
      existing.entries += 1;
      if (entry.task.status === 'COMPLETED') existing.completedTasks += 1;
      byUser.set(entry.userId, existing);
    }

    const workers = [...byUser.values()]
      .map((w) => ({
        ...w,
        hours: roundMoney(w.minutes / 60),
        score: roundMoney(w.completedTasks * 10 + w.minutes / 30),
      }))
      .sort((a, b) => Number(b.score) - Number(a.score));

    return {
      filters,
      totals: {
        workers: workers.length,
        minutes: workers.reduce((s, w) => s + w.minutes, 0),
        completedTasks: workers.reduce((s, w) => s + w.completedTasks, 0),
      },
      workers,
      recentEntries: entries.slice(0, 40).map((e) => ({
        id: e.id,
        userId: e.userId,
        userName:
          `${e.user.firstName} ${e.user.lastName}`.trim() || e.user.email || e.userId,
        minutes:
          e.minutes ??
          (e.endedAt
            ? Math.max(0, Math.round((e.endedAt.getTime() - e.startedAt.getTime()) / 60_000))
            : null),
        startedAt: e.startedAt.toISOString(),
        endedAt: e.endedAt?.toISOString() ?? null,
        taskStatus: e.task.status,
        productionOrder: e.task.productionOrder.number,
        stageCode: e.task.productionOrder.currentStageCode,
        salesOrder: e.task.productionOrder.salesOrder?.number ?? null,
        customerName:
          e.task.productionOrder.salesOrder?.customer?.nameEn ||
          e.task.productionOrder.salesOrder?.customer?.nameAr ||
          e.task.productionOrder.salesOrder?.customer?.name ||
          null,
      })),
    };
  }

  async productionSummary() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedFilter = {
      archivedAt: null,
      status: ProductionOrderStatus.COMPLETED,
    } as const;

    const inProductionStatuses = [
      ProductionOrderStatus.IN_PROGRESS,
      ProductionOrderStatus.READY_FOR_PACKAGING,
      ProductionOrderStatus.READY_FOR_DELIVERY,
      ProductionOrderStatus.WAITING_FOR_MATERIALS,
      ProductionOrderStatus.READY,
    ];

    const [
      completedToday,
      completedThisWeek,
      completedThisMonth,
      completedOrders,
      inProduction,
      lateOrders,
      inProductionProgress,
    ] = await Promise.all([
      this.prisma.productionOrder.count({
        where: { ...completedFilter, actualCompletionDate: { gte: startOfDay } },
      }),
      this.prisma.productionOrder.count({
        where: { ...completedFilter, actualCompletionDate: { gte: startOfWeek } },
      }),
      this.prisma.productionOrder.count({
        where: { ...completedFilter, actualCompletionDate: { gte: startOfMonth } },
      }),
      this.prisma.productionOrder.count({ where: completedFilter }),
      this.prisma.productionOrder.count({
        where: {
          archivedAt: null,
          status: { in: inProductionStatuses },
        },
      }),
      this.prisma.productionOrder.count({
        where: {
          archivedAt: null,
          requiredDeliveryDate: { lt: now },
          status: {
            notIn: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
          },
        },
      }),
      this.prisma.productionOrder.aggregate({
        where: {
          archivedAt: null,
          status: { in: inProductionStatuses },
        },
        _avg: { progressPercent: true },
      }),
    ]);

    const overallProgress = Math.round(Number(inProductionProgress._avg.progressPercent ?? 0));

    return {
      /** Alias for daily completed */
      dailyProduction: completedToday,
      /** Alias for weekly completed */
      weeklyProduction: completedThisWeek,
      /** Alias for monthly completed */
      monthlyProduction: completedThisMonth,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      completedOrders,
      inProduction,
      lateOrders,
      overallProgress,
    };
  }

  async inventory() {
    const [items, transfers, lowStock] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        include: { balances: { include: { warehouse: true } } },
        take: 200,
      }),
      this.prisma.warehouseTransfer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { fromWarehouse: true, toWarehouse: true },
      }),
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null },
        include: { balances: true },
      }),
    ]);

    return {
      onHand: items.map((item) => ({
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        minStock: item.minStock,
        balances: item.balances.map((b) => ({
          warehouse: b.warehouse.code,
          availableQty: b.availableQty,
        })),
      })),
      recentTransfers: transfers,
      lowStock: lowStock
        .map((item) => {
          const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
          return {
            sku: item.sku,
            nameEn: item.nameEn,
            nameAr: item.nameAr,
            available,
            minStock: Number(item.minStock),
          };
        })
        .filter((i) => i.available <= i.minStock),
    };
  }

  async financial() {
    const [invoices, payments, aging] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
        _sum: { total: true, outstandingAmount: true },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where: {
          archivedAt: null,
          outstandingAmount: { gt: 0 },
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        },
        include: { customer: true },
        orderBy: { dueDate: 'asc' },
        take: 100,
      }),
    ]);

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    for (const inv of aging) {
      const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now;
      const days = Math.floor((now - due) / 86_400_000);
      const amt = Number(inv.outstandingAmount);
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.d30 += amt;
      else if (days <= 60) buckets.d60 += amt;
      else if (days <= 90) buckets.d90 += amt;
      else buckets.older += amt;
    }

    return {
      invoicesByStatus: invoices.map((row) => ({
        status: row.status,
        count: row._count,
        total: roundMoney(Number(row._sum.total ?? 0)),
        outstanding: roundMoney(Number(row._sum.outstandingAmount ?? 0)),
      })),
      paymentsTotal: roundMoney(Number(payments._sum.amount ?? 0)),
      paymentCount: payments._count,
      aging: {
        current: roundMoney(buckets.current),
        d1_30: roundMoney(buckets.d30),
        d31_60: roundMoney(buckets.d60),
        d61_90: roundMoney(buckets.d90),
        older: roundMoney(buckets.older),
      },
      openInvoices: aging.map((inv) => ({
        id: inv.id,
        number: inv.number,
        customer: inv.customer.name,
        dueDate: inv.dueDate,
        outstanding: inv.outstandingAmount,
      })),
    };
  }

  async apLedger(filters: ReportPeriodFilters = {}) {
    const invoiceDate = dateRange(filters.from, filters.to);
    const open = await this.prisma.supplierInvoice.findMany({
      where: {
        archivedAt: null,
        outstandingAmount: { gt: 0 },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        ...(invoiceDate ? { invoiceDate } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, nameEn: true, nameAr: true } },
        purchaseOrder: { select: { id: true, number: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 200,
    });

    const now = Date.now();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const bySupplier = new Map<
      string,
      { supplierId: string; supplierName: string; count: number; outstanding: number }
    >();

    const rows = open.map((inv) => {
      const due = inv.dueDate ? new Date(inv.dueDate).getTime() : now;
      const days = Math.floor((now - due) / 86_400_000);
      const amt = Number(inv.outstandingAmount);
      if (days <= 0) buckets.current += amt;
      else if (days <= 30) buckets.d30 += amt;
      else if (days <= 60) buckets.d60 += amt;
      else if (days <= 90) buckets.d90 += amt;
      else buckets.older += amt;

      const name =
        inv.supplier.nameEn || inv.supplier.nameAr || inv.supplier.name || inv.supplierId;
      const agg = bySupplier.get(inv.supplierId) ?? {
        supplierId: inv.supplierId,
        supplierName: name,
        count: 0,
        outstanding: 0,
      };
      agg.count += 1;
      agg.outstanding += amt;
      bySupplier.set(inv.supplierId, agg);

      return {
        id: inv.id,
        number: inv.number,
        status: inv.status,
        supplierId: inv.supplierId,
        supplierName: name,
        purchaseOrderId: inv.purchaseOrderId,
        purchaseOrderNumber: inv.purchaseOrder.number,
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        total: roundMoney(Number(inv.total)),
        paidAmount: roundMoney(Number(inv.paidAmount)),
        outstanding: roundMoney(amt),
        daysPastDue: Math.max(0, days),
      };
    });

    const payments = await this.prisma.supplierPayment.aggregate({
      where: invoiceDate ? { paymentDate: invoiceDate } : undefined,
      _sum: { amount: true },
      _count: true,
    });

    return {
      filters,
      aging: {
        current: roundMoney(buckets.current),
        d1_30: roundMoney(buckets.d30),
        d31_60: roundMoney(buckets.d60),
        d61_90: roundMoney(buckets.d90),
        older: roundMoney(buckets.older),
      },
      totals: {
        openInvoices: rows.length,
        outstanding: roundMoney(rows.reduce((s, r) => s + Number(r.outstanding), 0)),
        paymentsTotal: roundMoney(Number(payments._sum.amount ?? 0)),
        paymentCount: payments._count,
      },
      bySupplier: [...bySupplier.values()]
        .map((s) => ({ ...s, outstanding: roundMoney(s.outstanding) }))
        .sort((a, b) => Number(b.outstanding) - Number(a.outstanding)),
      openInvoices: rows,
    };
  }

  async periodPl(filters: ReportPeriodFilters = {}) {
    const orderWhere = this.salesOrderWhere(filters);
    const invoiceDate = dateRange(filters.from, filters.to);

    const [orders, arInvoices, supplierInvoices, timeEntries] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: orderWhere,
        select: {
          id: true,
          total: true,
          manufacturingCost: true,
          status: true,
        },
        take: 500,
      }),
      this.prisma.invoice.aggregate({
        where: {
          archivedAt: null,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT] },
          ...(invoiceDate ? { invoiceDate } : {}),
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.supplierInvoice.aggregate({
        where: {
          archivedAt: null,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.VOID, InvoiceStatus.DRAFT] },
          ...(invoiceDate ? { invoiceDate } : {}),
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.taskTimeEntry.findMany({
        where: {
          ...(dateRange(filters.from, filters.to) ? { startedAt: dateRange(filters.from, filters.to) } : {}),
        },
        select: { minutes: true, startedAt: true, endedAt: true },
        take: 2000,
      }),
    ]);

    const revenueOrders = orders.reduce((s, o) => s + Number(o.total), 0);
    const materialCogs = orders.reduce((s, o) => s + Number(o.manufacturingCost ?? 0), 0);
    const revenueInvoiced = Number(arInvoices._sum.total ?? 0);
    const supplierSpend = Number(supplierInvoices._sum.total ?? 0);

    const laborMinutes = timeEntries.reduce((s, e) => {
      if (e.minutes != null) return s + e.minutes;
      if (e.endedAt) {
        return s + Math.max(0, Math.round((e.endedAt.getTime() - e.startedAt.getTime()) / 60_000));
      }
      return s;
    }, 0);

    const laborRateSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'company' },
    });
    const company = (laborRateSetting?.value ?? {}) as Record<string, unknown>;
    const laborRate =
      typeof company.defaultLaborRateJod === 'number'
        ? company.defaultLaborRateJod
        : Number(process.env.DEFAULT_LABOR_RATE_JOD ?? 5);

    const laborCost = (laborMinutes / 60) * laborRate;
    const grossProfit = revenueOrders - materialCogs;
    const contribution = grossProfit - laborCost;

    return {
      filters,
      laborRateJod: roundMoney(laborRate),
      totals: {
        orderCount: orders.length,
        revenueOrders: roundMoney(revenueOrders),
        revenueInvoiced: roundMoney(revenueInvoiced),
        materialCogs: roundMoney(materialCogs),
        supplierSpend: roundMoney(supplierSpend),
        laborMinutes,
        laborHours: roundMoney(laborMinutes / 60),
        laborCost: roundMoney(laborCost),
        grossProfit: roundMoney(grossProfit),
        contribution: roundMoney(contribution),
        invoiceCount: arInvoices._count,
        supplierInvoiceCount: supplierInvoices._count,
      },
    };
  }

  /** Cash movement summary from customer + supplier payments (not a full GL). */
  async cashFlow(filters: ReportPeriodFilters = {}) {
    const paymentDate = dateRange(filters.from, filters.to);
    const [customerPayments, supplierPayments] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          ...(paymentDate ? { paymentDate } : {}),
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
        },
        select: {
          id: true,
          number: true,
          amount: true,
          method: true,
          paymentDate: true,
          customer: { select: { name: true, code: true } },
        },
        orderBy: { paymentDate: 'desc' },
        take: 500,
      }),
      this.prisma.supplierPayment.findMany({
        where: paymentDate ? { paymentDate } : undefined,
        select: {
          id: true,
          number: true,
          amount: true,
          method: true,
          paymentDate: true,
          supplier: { select: { name: true, code: true } },
        },
        orderBy: { paymentDate: 'desc' },
        take: 500,
      }),
    ]);

    const inflowByMethod = new Map<string, number>();
    const outflowByMethod = new Map<string, number>();
    let inflow = 0;
    let outflow = 0;
    for (const p of customerPayments) {
      const amt = Number(p.amount);
      inflow += amt;
      inflowByMethod.set(p.method, (inflowByMethod.get(p.method) ?? 0) + amt);
    }
    for (const p of supplierPayments) {
      const amt = Number(p.amount);
      outflow += amt;
      outflowByMethod.set(p.method, (outflowByMethod.get(p.method) ?? 0) + amt);
    }

    return {
      filters,
      totals: {
        inflow: roundMoney(inflow),
        outflow: roundMoney(outflow),
        net: roundMoney(inflow - outflow),
        customerPaymentCount: customerPayments.length,
        supplierPaymentCount: supplierPayments.length,
      },
      inflowByMethod: [...inflowByMethod.entries()].map(([method, amount]) => ({
        method,
        amount: roundMoney(amount),
      })),
      outflowByMethod: [...outflowByMethod.entries()].map(([method, amount]) => ({
        method,
        amount: roundMoney(amount),
      })),
      recentInflows: customerPayments.slice(0, 25).map((p) => ({
        number: p.number,
        party: p.customer.name,
        partyCode: p.customer.code,
        method: p.method,
        amount: roundMoney(Number(p.amount)),
        date: p.paymentDate.toISOString(),
      })),
      recentOutflows: supplierPayments.slice(0, 25).map((p) => ({
        number: p.number,
        party: p.supplier.name,
        partyCode: p.supplier.code,
        method: p.method,
        amount: roundMoney(Number(p.amount)),
        date: p.paymentDate.toISOString(),
      })),
    };
  }

  async purchasing() {
    const [pos, prs, receipts] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { archivedAt: null },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.purchaseRequest.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.goodsReceipt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { purchaseOrder: true, warehouse: true },
      }),
    ]);
    return { purchaseOrdersByStatus: pos, purchaseRequestsByStatus: prs, recentReceipts: receipts };
  }

  toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]!);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
      '\n',
    );
  }
}
