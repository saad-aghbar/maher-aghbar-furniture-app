import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesOrderStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { mapProgressForDealer } from '../../common/helpers/dealer-progress.util';
import {
  mapWorkflowStageAdmin,
  mapWorkflowStageSafe,
  sanitizeWorkflowStageForDealer,
} from '../../common/helpers/production-workflow-stages.util';
import {
  buildMaterialCostMap,
  calculateOrderCosts,
  type CostLine,
  type MaterialCostMap,
  type OrderCostResult,
} from '../../common/helpers/order-costing.util';
import { ListSalesOrdersDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { WorkflowSnapshotService } from '../production/workflow/workflow-snapshot.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionInventoryService } from '../production/production-inventory.service';
import { OrderProductionSetupService } from '../production/order-production-setup.service';
import { ManufacturingCostService } from '../production/manufacturing-cost.service';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { firstImageDocument } from '../../common/helpers/document-image.util';
import { buildSalesOrderSearchOr } from './build-sales-order-search-or';
import { assessProductionReadiness, type ExecutableTaskInput } from '../production/production-readiness';
import {
  commercialLinesReady,
  money as moneyN,
} from '../payments/dealer-finance';
import { roundMoney } from '../../common/helpers/money.util';
import {
  CANCEL_TASK_STATUSES,
  OPEN_TASK_STATUSES,
  cancelPhaseCurrentState,
  formatCancellationReason,
  normalizeCancelReasonCode,
  resolveSalesOrderCancelPhase,
  type CancelPhase,
} from './sales-order-cancel-phase';

function stripSalesOrderCosts<T extends object>(order: T, user?: AuthUser): T {
  if (!user?.customerId) return order;
  const copy = { ...(order as Record<string, unknown>) };

  delete copy.manufacturingCost;
  delete copy.costBreakdown;
  delete copy.productionPrice;
  delete copy.profit;
  delete copy.manufacturingCosting;
  delete copy.commercialGrossDifference;
  delete copy.assignedEmployeeId;
  delete copy.assignedEmployee;
  // Floor stage is factory-only; dealers get coarse progressLabel instead.
  delete copy.currentStage;

  const lines = copy.lines;
  if (Array.isArray(lines)) {
    copy.lines = lines.map((line) => {
      if (!line || typeof line !== 'object') return line;
      const lineCopy = { ...(line as Record<string, unknown>) };
      const product = lineCopy.product;
      if (product && typeof product === 'object') {
        const productCopy = { ...(product as Record<string, unknown>) };
        delete productCopy.manufacturingCost;
        delete productCopy.bomDefaults;
        delete productCopy.basePrice;
        lineCopy.product = productCopy;
      }
      return lineCopy;
    });
  }

  const productionOrders = copy.productionOrders;
  if (Array.isArray(productionOrders)) {
    copy.productionOrders = productionOrders.map((po) => {
      if (!po || typeof po !== 'object') return po;
      const poCopy = { ...(po as Record<string, unknown>) };
      delete poCopy.currentStageCode;
      // Dealers keep completed-stage work photos; strip floor ops via sanitize.
      const stages = poCopy.stages;
      if (Array.isArray(stages)) {
        poCopy.stages = stages.map((s) =>
          s && typeof s === 'object'
            ? sanitizeWorkflowStageForDealer(s as Record<string, unknown>)
            : s,
        );
      }
      poCopy.photos = [];
      return poCopy;
    });
  }

  const stripEndCustomer = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    const cr = { ...(value as Record<string, unknown>) };
    delete cr.endCustomerName;
    delete cr.endCustomerPhone;
    delete cr.endCustomerFax;
    delete cr.deliveryLat;
    delete cr.deliveryLng;
    return cr;
  };

  copy.customerRequest = stripEndCustomer(copy.customerRequest);

  const quotation = copy.quotation;
  if (quotation && typeof quotation === 'object') {
    const q = { ...(quotation as Record<string, unknown>) };
    q.request = stripEndCustomer(q.request);
    copy.quotation = q;
  }

  return copy as T;
}

const STATUS_GROUPS: Record<'pending' | 'production' | 'delivered', SalesOrderStatus[]> = {
  pending: [
    SalesOrderStatus.DRAFT,
    SalesOrderStatus.CONFIRMED,
    SalesOrderStatus.WAITING_FOR_PAYMENT,
    SalesOrderStatus.WAITING_FOR_MATERIALS,
    SalesOrderStatus.ON_HOLD,
    SalesOrderStatus.READY_FOR_PRODUCTION,
  ],
  production: [SalesOrderStatus.IN_PRODUCTION, SalesOrderStatus.READY_FOR_DELIVERY],
  delivered: [SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED],
};

function maxProgress(
  productionOrders: Array<{ progressPercent?: number | null }> | undefined,
): number | null {
  if (!productionOrders?.length) return null;
  return Math.max(...productionOrders.map((po) => Number(po.progressPercent ?? 0)));
}

type PoWithStage = {
  progressPercent?: number | null;
  currentStageCode?: string | null;
  stages?: Array<{
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    status?: string;
    progressPercent?: number | null;
    sortOrder?: number;
  }>;
};

export type CurrentStageDto = {
  code: string;
  nameEn: string;
  nameAr: string | null;
  nameHe: string | null;
};

/** PO that drives the sales-order rollup % (same rule as maxProgress). */
function pickMaxProgressPo<T extends PoWithStage>(pos: T[] | undefined): T | null {
  if (!pos?.length) return null;
  return pos.reduce((best, po) =>
    Number(po.progressPercent ?? 0) > Number(best.progressPercent ?? 0) ? po : best,
  );
}

function stageDtoFromDef(def: {
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
}): CurrentStageDto {
  return {
    code: def.code,
    nameEn: def.nameEn,
    nameAr: def.nameAr,
    nameHe: def.nameHe ?? null,
  };
}

/** Resolve floor stage for the PO driving progress (admin surfaces). */
function resolveCurrentStage(
  productionOrders: PoWithStage[] | undefined,
  defsByCode?: Map<string, { code: string; nameEn: string; nameAr: string; nameHe: string | null }>,
): CurrentStageDto | null {
  const po = pickMaxProgressPo(productionOrders);
  if (!po) return null;

  const stages = po.stages ?? [];
  const incomplete = stages.filter(
    (s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED',
  );
  const code =
    po.currentStageCode ??
    stages.find((s) => s.status === 'IN_PROGRESS')?.code ??
    stages.find((s) => s.status === 'READY')?.code ??
    [...incomplete]
      .filter((s) => Number(s.progressPercent ?? 0) > 0)
      .sort((a, b) => Number(b.progressPercent ?? 0) - Number(a.progressPercent ?? 0))[0]
      ?.code ??
    incomplete[0]?.code ??
    null;

  if (!code) return null;

  const fromStages = stages.find((s) => s.code === code);
  if (fromStages) return stageDtoFromDef(fromStages);

  const fromDefs = defsByCode?.get(code);
  if (fromDefs) return stageDtoFromDef(fromDefs);

  return { code, nameEn: code, nameAr: code, nameHe: null };
}

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly notifications: NotificationsService,
    private readonly storage: LocalStorageService,
    private readonly scheduling: SchedulingService,
    private readonly workflowSnapshots: WorkflowSnapshotService,
    private readonly inventory: InventoryService,
    private readonly productionInventory: ProductionInventoryService,
    private readonly orderProductionSetup: OrderProductionSetupService,
    private readonly manufacturingCost: ManufacturingCostService,
  ) {}

  /** Short-lived download URL for list thumbnails from request attachments. */
  private documentImageUrl(doc: { storageKey: string } | null | undefined): string | null {
    if (!doc?.storageKey) return null;
    const token = this.storage.createAccessToken(doc.storageKey, 3600);
    return `/api/v1/uploads/download?token=${token}`;
  }

  /** Catalog unit price, overlaid by latest purchase/stock unit cost per SKU. */
  async loadMaterialCosts(): Promise<MaterialCostMap> {
    const [items, txs] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null, standardCost: { gt: 0 } },
        select: { sku: true, standardCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: { unitCost: { not: null } },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
        select: {
          type: true,
          unitCost: true,
          inventoryItem: { select: { sku: true } },
        },
        take: 800,
      }),
    ]);
    return buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((tx) => ({
        sku: tx.inventoryItem.sku,
        unitCost: tx.unitCost,
        type: tx.type,
      })),
    });
  }

  async loadDealerPrices(customerId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.dealerPrice.findMany({
      where: { customerId },
      select: { productId: true, price: true },
    });
    return new Map(rows.map((r) => [r.productId, Number(r.price)]));
  }

  costsForLines(
    lines: CostLine[],
    opts: {
      customerId?: string | null;
      dealerPrices?: Map<string, number>;
      materialCosts?: MaterialCostMap;
      fallbackSellerTotal?: unknown;
    },
  ): OrderCostResult {
    return calculateOrderCosts(lines, opts);
  }

  /** Attach catalog product (BOM/pricing) when line has no productId — match by name/sku. */
  async hydrateLineProducts<
    T extends {
      productId?: string | null;
      description?: string | null;
      product?: CostLine['product'];
    },
  >(lines: T[]): Promise<Array<T & { product: CostLine['product'] }>> {
    const needsLookup = lines.some((l) => !l.product && !l.productId);
    const byId = new Map<string, NonNullable<CostLine['product']>>();
    const catalog = needsLookup
      ? await this.prisma.product.findMany({
          where: { archivedAt: null, isActive: true },
          select: {
            id: true,
            sku: true,
            nameAr: true,
            nameEn: true,
            nameHe: true,
            manufacturingCost: true,
            basePrice: true,
            bomDefaults: true,
          },
        })
      : [];

    if (!needsLookup) {
      const ids = [...new Set(lines.map((l) => l.productId).filter(Boolean))] as string[];
      if (ids.length) {
        const products = await this.prisma.product.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            sku: true,
            nameAr: true,
            nameEn: true,
            nameHe: true,
            manufacturingCost: true,
            basePrice: true,
            bomDefaults: true,
          },
        });
        for (const p of products) byId.set(p.id, p);
      }
    } else {
      for (const p of catalog) byId.set(p.id, p);
    }

    return lines.map((line) => {
      if (line.product) return { ...line, product: line.product };
      if (line.productId && byId.has(line.productId)) {
        return { ...line, product: byId.get(line.productId)! };
      }
      const desc = (line.description ?? '').toLowerCase();
      const matched =
        catalog.find(
          (p) =>
            desc.includes(p.sku.toLowerCase()) ||
            desc.includes(p.nameEn.toLowerCase()) ||
            (p.nameAr && desc.includes(p.nameAr.toLowerCase())) ||
            // loose match for smoke / free-text lines like "Smoke sofa"
            (desc.includes('sofa') && p.sku === 'SOF-3S') ||
            (desc.includes('arm') && p.sku === 'ARM-01'),
        ) ?? null;
      return { ...line, product: matched };
    });
  }

  /** Persist auto production cost onto the sales order (admin costing). */
  async syncCalculatedCosts(salesOrderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
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
    });
    if (!order) return null;

    const [materialCosts, dealerPrices] = await Promise.all([
      this.loadMaterialCosts(),
      this.loadDealerPrices(order.customerId),
    ]);
    const hydratedLines = await this.hydrateLineProducts(order.lines);
    const costs = this.costsForLines(hydratedLines, {
      customerId: order.customerId,
      dealerPrices,
      materialCosts,
      fallbackSellerTotal: order.total,
    });

    return this.prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        manufacturingCost: costs.productionPrice,
        costBreakdown: costs.costBreakdown as Prisma.InputJsonValue,
      },
    });
  }

  async list(query: ListSalesOrdersDto, user?: AuthUser) {
    const isDealer = Boolean(user?.customerId);
    const scopedCustomerId = isDealer
      ? user!.customerId!
      : query.customerId;

    const deliveryDate: Prisma.DateTimeFilter | undefined =
      query.deliveryFrom || query.deliveryTo
        ? {
            ...(query.deliveryFrom
              ? { gte: new Date(`${query.deliveryFrom}T00:00:00.000Z`) }
              : {}),
            ...(query.deliveryTo
              ? { lte: new Date(`${query.deliveryTo}T23:59:59.999Z`) }
              : {}),
          }
        : undefined;

    const statusFilter = query.status
      ? { status: query.status }
      : query.statusGroup
        ? { status: { in: STATUS_GROUPS[query.statusGroup] } }
        : {};

    const where: Prisma.SalesOrderWhereInput = {
      archivedAt: null,
      ...(scopedCustomerId ? { customerId: scopedCustomerId } : {}),
      ...statusFilter,
      ...(deliveryDate ? { requiredDeliveryDate: deliveryDate } : {}),
      ...(query.q
        ? {
            OR: buildSalesOrderSearchOr(query.q),
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'createdAt';
    const sortDir = query.sortDir ?? 'desc';
    const orderBy: Prisma.SalesOrderOrderByWithRelationInput = {
      [sortBy]: sortDir,
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, nameAr: true, nameEn: true, nameHe: true, code: true },
          },
          quotation: {
            select: {
              id: true,
              number: true,
              request: {
                select: {
                  id: true,
                  number: true,
                  endCustomerName: true,
                  endCustomerPhone: true,
                  endCustomerFax: true,
                  externalOrderNumber: true,
                  documents: {
                    where: { archivedAt: null },
                    select: {
                      id: true,
                      fileName: true,
                      mimeType: true,
                      storageKey: true,
                    },
                    orderBy: { createdAt: 'asc' },
                    take: 8,
                  },
                },
              },
            },
          },
          lines: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              productId: true,
              product: {
                select: {
                  id: true,
                  sku: true,
                  nameAr: true,
                  nameEn: true,
                  nameHe: true,
                  imageUrl: true,
                  manufacturingCost: true,
                  basePrice: true,
                  bomDefaults: true,
                },
              },
            },
          },
          productionOrders: {
            select: {
              id: true,
              number: true,
              status: true,
              currentStageCode: true,
              progressPercent: true,
              tasks: {
                where: {
                  status: { not: 'CANCELLED' },
                  isRework: false,
                },
                select: {
                  id: true,
                  assignedEmployeeId: true,
                  stageDefinition: {
                    select: { code: true, executionKind: true, nameEn: true },
                  },
                },
              },
            },
          },
          deliveries: {
            select: { id: true, status: true, deliveryDate: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const materialCosts = isDealer ? new Map<string, number>() : await this.loadMaterialCosts();
    const dealerPriceCache = new Map<string, Map<string, number>>();

    // Resolve floor stage names for the page (admin only — dealers strip currentStage).
    const stageCodes = [
      ...new Set(
        data
          .flatMap((row) => row.productionOrders ?? [])
          .map((po) => po.currentStageCode)
          .filter((c): c is string => Boolean(c)),
      ),
    ];
    const stageDefs =
      !isDealer && stageCodes.length > 0
        ? await this.prisma.productionStageDefinition.findMany({
            where: { code: { in: stageCodes } },
            select: { code: true, nameEn: true, nameAr: true, nameHe: true },
          })
        : [];
    const defsByCode = new Map(stageDefs.map((d) => [d.code, d]));

    const enriched = await Promise.all(
      data.map(async (row) => {
        let dealerPrices = dealerPriceCache.get(row.customerId);
        if (!dealerPrices) {
          dealerPrices = await this.loadDealerPrices(row.customerId);
          dealerPriceCache.set(row.customerId, dealerPrices);
        }
        const hydratedLines = await this.hydrateLineProducts(row.lines);
        const costs = this.costsForLines(hydratedLines, {
          customerId: row.customerId,
          dealerPrices,
          materialCosts,
          fallbackSellerTotal: row.total,
        });
        const primaryLine = hydratedLines[0] ?? row.lines[0];
        const title = primaryLine?.product
          ? primaryLine.product.nameEn ||
            primaryLine.product.nameAr ||
            primaryLine.description
          : primaryLine?.description ?? null;
        let imageUrl =
          (primaryLine?.product as { imageUrl?: string | null } | null | undefined)?.imageUrl ??
          null;
        if (!imageUrl && title) {
          imageUrl = await this.resolveCatalogImage(title);
        }
        if (!imageUrl) {
          imageUrl = this.documentImageUrl(
            firstImageDocument(row.quotation?.request?.documents),
          );
        }
        const requestWithoutStorageKeys = row.quotation?.request
          ? {
              ...row.quotation.request,
              documents: (row.quotation.request.documents ?? []).map(
                ({ storageKey: _k, ...doc }) => doc,
              ),
            }
          : null;
        const latestDelivery = row.deliveries?.[0] ?? null;
        const poReadiness = !isDealer
          ? row.productionOrders.map((po) => {
              const readiness = assessProductionReadiness({
                status: po.status,
                currentStageCode: po.currentStageCode,
                tasks: (po.tasks ?? []) as ExecutableTaskInput[],
              });
              return { id: po.id, number: po.number, status: po.status, readiness };
            })
          : [];
        const required = poReadiness.reduce((n, po) => n + po.readiness.assignment.required, 0);
        const assigned = poReadiness.reduce((n, po) => n + po.readiness.assignment.assigned, 0);
        const missingCount = poReadiness.reduce(
          (n, po) => n + po.readiness.assignment.missing.length,
          0,
        );
        const needsSetup = poReadiness.some(
          (po) =>
            po.readiness.boardBucket === 'needs_setup' || po.readiness.assignment.missing.length > 0,
        );
        const canStartAll =
          poReadiness.length > 0 && poReadiness.every((po) => po.readiness.canStart);
        const actionHint = !isDealer
          ? missingCount > 0
            ? `${missingCount} worker${missingCount === 1 ? '' : 's'} still need assignment`
            : canStartAll
              ? 'Ready to start'
              : poReadiness.some((po) => po.readiness.boardBucket === 'on_floor')
                ? 'In production'
                : poReadiness.some((po) => po.readiness.boardBucket === 'inspection_packaging')
                  ? 'Inspection / packaging'
                  : null
          : null;

        const base = stripSalesOrderCosts(
          {
            ...row,
            quotation: row.quotation
              ? {
                  ...row.quotation,
                  request: requestWithoutStorageKeys,
                }
              : row.quotation,
            manufacturingCost: costs.productionPrice,
            costBreakdown: costs.costBreakdown,
            progressPercent: maxProgress(row.productionOrders),
            currentStage: isDealer
              ? null
              : resolveCurrentStage(row.productionOrders, defsByCode),
            title,
            imageUrl,
            lineCount: row.lines.length,
            sellerPrice: costs.sellerPrice,
            productionPrice: costs.productionPrice,
            profit: costs.profit,
            deliveryStatus: latestDelivery?.status ?? null,
            productionReadinessSummary: !isDealer
              ? {
                  productionOrderCount: poReadiness.length,
                  canStart: canStartAll,
                  needsSetup,
                  materialsReady: poReadiness.every((po) => po.readiness.materialsReady),
                  assignment: { required, assigned, missingCount },
                  actionHint,
                  primaryProductionOrderId: poReadiness[0]?.id ?? null,
                }
              : null,
            productionOrders: row.productionOrders.map(({ tasks: _t, ...po }) => po),
          },
          user,
        );
        return isDealer ? mapProgressForDealer(base) : base;
      }),
    );

    return {
      data: enriched,
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
  }

  async getById(id: string, user?: AuthUser) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: true,
        quotation: {
          select: {
            id: true,
            number: true,
            status: true,
            customerNotes: true,
            request: {
              select: {
                id: true,
                number: true,
                status: true,
                source: true,
                notes: true,
                projectName: true,
                contactName: true,
                deliveryAddress: true,
                requiredDeliveryDate: true,
                externalOrderNumber: true,
                endCustomerName: true,
                endCustomerPhone: true,
                endCustomerFax: true,
                deliveryLat: true,
                deliveryLng: true,
                priority: true,
                createdAt: true,
                items: { orderBy: { sortOrder: 'asc' } },
                documents: {
                  where: { archivedAt: null },
                  select: {
                    id: true,
                    fileName: true,
                    mimeType: true,
                    storageKey: true,
                    category: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 20,
                },
                aiJobs: {
                  select: {
                    id: true,
                    number: true,
                    originalText: true,
                    translatedText: true,
                    detectedLanguage: true,
                    targetLanguage: true,
                    sourceType: true,
                    storageKey: true,
                    status: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 5,
                },
              },
            },
          },
        },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                nameAr: true,
                nameEn: true,
                nameHe: true,
                imageUrl: true,
                manufacturingCost: true,
                basePrice: true,
                bomDefaults: true,
              },
            },
          },
        },
        productionOrders: {
          include: {
            stages: {
              include: {
                stageDefinition: {
                  select: {
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    nameHe: true,
                    sortOrder: true,
                    dependsOnCodes: true,
                  },
                },
                tasks: {
                  include: {
                    assignedEmployee: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                    blockers: true,
                    timeEntries: {
                      where: { endedAt: null },
                      orderBy: { startedAt: 'desc' as const },
                      take: 1,
                      select: { startedAt: true, endedAt: true },
                    },
                  },
                },
              },
              orderBy: { stageDefinition: { sortOrder: 'asc' } },
            },
            tasks: {
              include: {
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
                blockers: { where: { resolvedAt: null } },
              },
            },
            documents: {
              where: {
                archivedAt: null,
                category: { startsWith: 'TASK_PHOTO:' },
              },
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                category: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 40,
            },
          },
        },
        invoices: {
          select: { id: true, number: true, status: true, total: true, outstandingAmount: true },
        },
        deliveries: {
          select: {
            id: true,
            number: true,
            status: true,
            deliveryDate: true,
            deliveryWindow: true,
            recipientName: true,
            deliveryAddress: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        returns: {
          select: {
            id: true,
            number: true,
            approvalStatus: true,
            physicalStatus: true,
            needInfoNote: true,
            inventoryFate: true,
            reason: true,
            productDesc: true,
            quantity: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        productionSetup: {
          select: {
            id: true,
            status: true,
            releasedAt: true,
            lines: {
              select: {
                id: true,
                salesOrderLineId: true,
                status: true,
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
                    id: true,
                    sku: true,
                    displayName: true,
                    category: true,
                    unit: true,
                    expectedQty: true,
                    source: true,
                    inventoryItemId: true,
                    requestedFabricLabel: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    if (!assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your sales order.' });
    }

    const isDealer = Boolean(user?.customerId);
    const productionOrders = order.productionOrders.map((po) => {
      const photos = (po.documents ?? []).map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        category: doc.category,
        createdAt: doc.createdAt,
      }));
      const stages = po.stages.map((s) =>
        isDealer ? mapWorkflowStageSafe(s, photos) : mapWorkflowStageAdmin(s, photos),
      );
      const readiness = isDealer
        ? undefined
        : assessProductionReadiness({
            status: po.status,
            currentStageCode: po.currentStageCode,
            tasks: (po.tasks ?? []) as ExecutableTaskInput[],
          });
      const mapped = {
        id: po.id,
        number: po.number,
        status: po.status,
        currentStageCode: po.currentStageCode,
        progressPercent: po.progressPercent,
        stages,
        // PO-level flat photo list stays admin-only; dealers get stage.photos instead.
        photos: isDealer ? [] : photos,
        ...(readiness ? { readiness } : {}),
      };
      return isDealer ? mapProgressForDealer(mapped) : mapped;
    });

    const productionReadinessSummary = !isDealer
      ? (() => {
          const withReadiness = productionOrders.filter(
            (po): po is typeof po & { readiness: NonNullable<(typeof po)['readiness']> } =>
              Boolean((po as { readiness?: unknown }).readiness),
          );
          const required = withReadiness.reduce((n, po) => n + po.readiness.assignment.required, 0);
          const assigned = withReadiness.reduce((n, po) => n + po.readiness.assignment.assigned, 0);
          const missing = withReadiness.flatMap((po) =>
            po.readiness.assignment.missing.map((m) => ({
              ...m,
              productionOrderId: po.id,
              productionOrderNumber: po.number,
            })),
          );
          const anyCanStart = withReadiness.some((po) => po.readiness.canStart);
          const allReady =
            withReadiness.length > 0 && withReadiness.every((po) => po.readiness.canStart);
          const needsSetup = withReadiness.some(
            (po) => po.readiness.boardBucket === 'needs_setup' || po.readiness.assignment.missing.length > 0,
          );
          const materialsReady = withReadiness.every((po) => po.readiness.materialsReady);
          const actionHint = needsSetup
            ? missing.length > 0
              ? `${missing.length} worker${missing.length === 1 ? '' : 's'} still need assignment`
              : 'Finish production setup'
            : allReady
              ? 'Ready to start'
              : anyCanStart
                ? 'Some lines ready to start'
                : withReadiness.some((po) => po.readiness.boardBucket === 'on_floor')
                  ? 'In production'
                  : null;
          return {
            productionOrderCount: withReadiness.length,
            canStart: allReady,
            needsSetup,
            materialsReady,
            assignment: { required, assigned, missing },
            actionHint,
            primaryProductionOrderId: withReadiness[0]?.id ?? null,
          };
        })()
      : null;

    // Seller price is always per-dealer; production cost stays factory-global (hidden from portal).
    const [materialCosts, dealerPrices] = await Promise.all([
      user?.customerId ? Promise.resolve(new Map<string, number>()) : this.loadMaterialCosts(),
      this.loadDealerPrices(order.customerId),
    ]);
    const hydratedLines = await this.hydrateLineProducts(order.lines);
    const costs = this.costsForLines(hydratedLines, {
      customerId: order.customerId,
      dealerPrices,
      materialCosts,
      fallbackSellerTotal: order.total,
    });

    if (!user?.customerId && order.status !== SalesOrderStatus.DRAFT) {
      await this.prisma.salesOrder.update({
        where: { id: order.id },
        data: {
          manufacturingCost: costs.productionPrice,
          costBreakdown: costs.costBreakdown as Prisma.InputJsonValue,
        },
      });
    }

    // Draft: prefer factory-edited costs when present; otherwise use live BOM calc.
    const storedBreakdown =
      order.status === SalesOrderStatus.DRAFT && order.costBreakdown != null
        ? (order.costBreakdown as OrderCostResult['costBreakdown'])
        : null;
    const storedMfg =
      order.status === SalesOrderStatus.DRAFT && order.manufacturingCost != null
        ? Number(order.manufacturingCost)
        : null;
    const productionPrice =
      storedMfg != null && Number.isFinite(storedMfg)
        ? storedMfg
        : costs.productionPrice;
    const costBreakdown = storedBreakdown ?? costs.costBreakdown;
    const profit =
      storedMfg != null && Number.isFinite(storedMfg)
        ? Number(costs.sellerPrice) - productionPrice
        : costs.profit;

    const request = order.quotation?.request ?? null;
    const aiJob = request?.aiJobs?.[0] ?? null;
    const customerRequest = request
      ? {
          id: request.id,
          number: request.number,
          status: request.status,
          source: request.source,
          projectName: request.projectName,
          contactName: request.contactName,
          notes: request.notes,
          deliveryAddress: request.deliveryAddress ?? order.deliveryAddress,
          requiredDeliveryDate: request.requiredDeliveryDate ?? order.requiredDeliveryDate,
          externalOrderNumber: request.externalOrderNumber,
          endCustomerName: request.endCustomerName,
          endCustomerPhone: request.endCustomerPhone,
          endCustomerFax: request.endCustomerFax,
          deliveryLat: request.deliveryLat,
          deliveryLng: request.deliveryLng,
          priority: request.priority,
          createdAt: request.createdAt,
          items: request.items.map((item) => ({
            id: item.id,
            productId: item.productId ?? null,
            productName: item.productName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            width: item.width,
            height: item.height,
            depth: item.depth,
            material: item.material,
            fabricType: item.fabricType,
            fabricColor: item.fabricColor,
            woodType: item.woodType,
            foamDensity: item.foamDensity,
            finish: item.finish,
            accessories: item.accessories,
            notes: item.notes,
            customMeasurements: item.customMeasurements ?? null,
            fabricCode: item.fabricCode ?? null,
          })),
          documents: request.documents,
          originalText: aiJob?.originalText ?? null,
          translatedText: aiJob?.translatedText ?? request.notes ?? null,
          detectedLanguage: aiJob?.detectedLanguage ?? null,
          targetLanguage: aiJob?.targetLanguage ?? null,
        }
      : {
          notes: order.notes,
          deliveryAddress: order.deliveryAddress,
          requiredDeliveryDate: order.requiredDeliveryDate,
          projectName: order.projectName,
          items: order.lines.map((line) => ({
            id: line.id,
            productId: line.productId ?? null,
            productName: line.description,
            description: line.specifications,
            quantity: line.quantity,
            unit: 'pcs',
            notes: null,
          })),
          documents: [],
          originalText: null,
          translatedText: null,
          detectedLanguage: null,
          targetLanguage: null,
        };

    const { contracts: _contracts, ...orderWithoutContracts } = order as typeof order & {
      contracts?: unknown;
    };

    const primaryProduct = hydratedLines[0]?.product ?? order.lines[0]?.product ?? null;
    const titleFromRequest = customerRequest.items?.[0]?.productName?.trim() || null;
    const title =
      (primaryProduct
        ? primaryProduct.nameEn || primaryProduct.nameAr || order.lines[0]?.description
        : order.lines[0]?.description ?? titleFromRequest) || null;
    let imageUrl = primaryProduct?.imageUrl ?? null;
    if (!imageUrl && title) {
      imageUrl = await this.resolveCatalogImage(title);
    }
    if (!imageUrl) {
      const docs = (customerRequest.documents ?? []) as Array<{
        id: string;
        fileName?: string | null;
        mimeType?: string | null;
        storageKey: string;
      }>;
      imageUrl = this.documentImageUrl(firstImageDocument(docs));
    }

    let assignedEmployee: { id: string; name: string } | null = null;
    if (!user?.customerId && order.assignedEmployeeId) {
      const emp = await this.prisma.user.findUnique({
        where: { id: order.assignedEmployeeId },
        select: { id: true, firstName: true, lastName: true },
      });
      if (emp) {
        assignedEmployee = {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
        };
      }
    }

    const result = {
      ...orderWithoutContracts,
      manufacturingCost: productionPrice,
      costBreakdown,
      productionOrders,
      productionReadinessSummary,
      progressPercent: maxProgress(productionOrders),
      currentStage: user?.customerId ? null : resolveCurrentStage(productionOrders),
      sellerPrice: costs.sellerPrice,
      productionPrice,
      profit,
      customerRequest,
      /** Alias used by UIs that previously showed ERP "lines" */
      orderedItems: customerRequest.items,
      title,
      imageUrl,
      assignedEmployee,
      /** Piece 1: commercially accepted SO awaiting Prepare production */
      productionSetupRequired:
        order.status === 'DRAFT' &&
        (!productionOrders || productionOrders.length === 0),
      productionSetupStatus: order.productionSetup?.status ?? null,
      workerAssignmentRequired:
        order.productionSetup?.status === 'RELEASED' &&
        (productionOrders?.length ?? 0) > 0,
      productionSetup: user?.customerId
        ? order.productionSetup
          ? {
              status: order.productionSetup.status,
              releasedAt: order.productionSetup.releasedAt,
            }
          : null
        : order.productionSetup,
      manufacturingCosting: user?.customerId
        ? null
        : await this.manufacturingCost.summaryForSalesOrder(order.id, user),
      commercialSummary: this.buildCommercialSummaryPayload(order),
      commercialGrossDifference: user?.customerId
        ? null
        : await this.commercialVsMfgDifference(order.id, costs.sellerPrice, user),
    };
    const withProgress = user?.customerId ? mapProgressForDealer(result) : result;

    return stripSalesOrderCosts(withProgress, user);
  }

  private buildCommercialSummaryPayload(order: {
    id: string;
    number: string;
    total: unknown;
    lines: Array<{
      id: string;
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      lineTotal: unknown;
      manufacturingComplexity: string | null;
      commercialPriceStatus: string;
      commercialPriceSource: string | null;
      commercialPriceNote: string | null;
    }>;
  }) {
    const gate = commercialLinesReady(order.lines);
    return {
      salesOrderId: order.id,
      number: order.number,
      orderTotal: moneyN(order.total as number | string),
      commercialComplete: gate.ok,
      commercialBlock: gate.ok ? null : gate,
      lines: order.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: moneyN(l.quantity as number | string),
        unitPrice: moneyN(l.unitPrice as number | string),
        lineTotal: moneyN(l.lineTotal as number | string),
        manufacturingComplexity: l.manufacturingComplexity,
        commercialPriceStatus: l.commercialPriceStatus,
        commercialPriceSource: l.commercialPriceSource,
        commercialPriceNote: l.commercialPriceNote,
      })),
    };
  }

  /** Sale vs mfg gross difference only when Piece 5 cost status is FINAL. */
  private async commercialVsMfgDifference(
    salesOrderId: string,
    sellerPrice: number,
    user?: AuthUser,
  ) {
    const costing = await this.manufacturingCost.summaryForSalesOrder(salesOrderId, user);
    if (!costing || costing.status !== 'FINAL') {
      return {
        available: false,
        reason: 'MANUFACTURING_COST_NOT_FINAL',
        saleTotal: sellerPrice,
        manufacturingCost: null,
        grossDifference: null,
      };
    }
    const mfg = Number(costing.actualTotal ?? costing.estimatedTotal ?? 0);
    return {
      available: true,
      reason: null,
      saleTotal: sellerPrice,
      manufacturingCost: mfg,
      grossDifference: Number(roundMoney(sellerPrice - mfg)),
    };
  }

  /**
   * Staff confirms / sets final commercial sale price on SO lines (MODIFIED/CUSTOM or missing).
   * Does not rewrite issued invoice lines.
   */
  async confirmCommercialPrices(
    salesOrderId: string,
    lines: Array<{ lineId: string; unitPrice: number; note?: string }>,
    user: AuthUser,
  ) {
    if (user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot confirm commercial prices.',
      });
    }
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: {
        lines: true,
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { id: true, status: true },
        },
      },
    });
    if (!so) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });

    const issued = so.invoices.some((i) => i.status !== 'DRAFT');
    if (issued) {
      throw new BadRequestException({
        code: 'INVOICE_ISSUED',
        message: 'Cannot change commercial prices after an invoice has been issued.',
      });
    }

    for (const patch of lines) {
      const line = so.lines.find((l) => l.id === patch.lineId);
      if (!line) {
        throw new BadRequestException({
          code: 'LINE_NOT_FOUND',
          message: `Line ${patch.lineId} not on this sales order.`,
        });
      }
      const unitPrice = Number(patch.unitPrice);
      if (!(unitPrice > 0)) {
        throw new BadRequestException({
          code: 'COMMERCIAL_PRICE_REQUIRED',
          message: 'Final commercial unit price must be greater than zero.',
        });
      }
      const qty = Number(line.quantity);
      const discount = Number(line.discountValue ?? 0);
      const taxRate = Number(line.taxRate ?? 0);
      const gross = qty * unitPrice - discount;
      const tax = gross * (taxRate / 100);
      const lineTotal = Number(roundMoney(gross + tax));

      await this.prisma.salesOrderLine.update({
        where: { id: line.id },
        data: {
          unitPrice: unitPrice as unknown as Prisma.Decimal,
          lineTotal: lineTotal as unknown as Prisma.Decimal,
          commercialPriceStatus: 'CONFIRMED',
          commercialPriceSource: 'STAFF_CONFIRMED',
          commercialPriceNote: patch.note ?? line.commercialPriceNote,
        },
      });
    }

    // Recompute SO totals from lines.
    const refreshed = await this.prisma.salesOrderLine.findMany({
      where: { salesOrderId },
      orderBy: { sortOrder: 'asc' },
    });
    let subtotal = 0;
    let taxTotal = 0;
    for (const l of refreshed) {
      const qty = Number(l.quantity);
      const up = Number(l.unitPrice);
      const disc = Number(l.discountValue ?? 0);
      const rate = Number(l.taxRate ?? 0);
      const gross = qty * up - disc;
      subtotal += gross;
      taxTotal += gross * (rate / 100);
    }
    await this.prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        subtotal: Number(roundMoney(subtotal)) as unknown as Prisma.Decimal,
        taxTotal: Number(roundMoney(taxTotal)) as unknown as Prisma.Decimal,
        total: Number(roundMoney(subtotal + taxTotal)) as unknown as Prisma.Decimal,
      },
    });

    return this.getById(salesOrderId, user);
  }

  async update(id: string, dto: UpdateSalesOrderDto, user?: AuthUser) {
    if (user?.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot update sales orders.',
      });
    }
    const order = await this.getById(id, user);
    if (order.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft sales orders can be edited.',
      });
    }

    let requiredDeliveryDate: Date | null | undefined;
    if (dto.requiredDeliveryDate !== undefined) {
      if (!dto.requiredDeliveryDate) {
        requiredDeliveryDate = null;
      } else {
        const parsed = new Date(dto.requiredDeliveryDate);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException({
            code: 'BAD_REQUEST',
            message: 'Invalid requiredDeliveryDate.',
          });
        }
        requiredDeliveryDate = parsed;
      }
    }

    let nextNumber: string | undefined;
    if (dto.number !== undefined) {
      const trimmed = dto.number.trim();
      if (!trimmed) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Factory order number cannot be empty.',
        });
      }
      if (trimmed !== order.number) {
        const clash = await this.prisma.salesOrder.findFirst({
          where: { number: trimmed, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          throw new BadRequestException({
            code: 'BAD_REQUEST',
            message: 'Factory order number is already in use.',
          });
        }
        nextNumber = trimmed;
      }
    }

    const requestId =
      (order as { customerRequest?: { id?: string } | null }).customerRequest?.id ?? null;
    const patchRequest =
      requestId &&
      (dto.endCustomerName !== undefined ||
        dto.endCustomerPhone !== undefined ||
        dto.endCustomerFax !== undefined ||
        dto.projectName !== undefined ||
        dto.externalOrderNumber !== undefined ||
        dto.deliveryAddress !== undefined ||
        requiredDeliveryDate !== undefined);

    if (patchRequest && requestId) {
      await this.prisma.requestForQuotation.update({
        where: { id: requestId },
        data: {
          ...(dto.endCustomerName !== undefined
            ? { endCustomerName: dto.endCustomerName }
            : {}),
          ...(dto.endCustomerPhone !== undefined
            ? { endCustomerPhone: dto.endCustomerPhone }
            : {}),
          ...(dto.endCustomerFax !== undefined
            ? { endCustomerFax: dto.endCustomerFax }
            : {}),
          ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
          ...(dto.externalOrderNumber !== undefined
            ? { externalOrderNumber: dto.externalOrderNumber }
            : {}),
          ...(dto.deliveryAddress !== undefined
            ? { deliveryAddress: dto.deliveryAddress }
            : {}),
          ...(requiredDeliveryDate !== undefined
            ? { requiredDeliveryDate }
            : {}),
        },
      });
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: {
        ...(nextNumber !== undefined ? { number: nextNumber } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.projectName !== undefined ? { projectName: dto.projectName } : {}),
        ...(dto.externalOrderNumber !== undefined
          ? { externalOrderNumber: dto.externalOrderNumber }
          : {}),
        ...(requiredDeliveryDate !== undefined
          ? { requiredDeliveryDate }
          : {}),
        ...(dto.deliveryAddress !== undefined
          ? { deliveryAddress: dto.deliveryAddress }
          : {}),
        ...(dto.manufacturingCost !== undefined
          ? { manufacturingCost: dto.manufacturingCost }
          : {}),
        ...(dto.costBreakdown !== undefined
          ? { costBreakdown: dto.costBreakdown as Prisma.InputJsonValue }
          : {}),
      },
    });

    return this.getById(id, user);
  }

  /** Piece 2: lazy-create production setup without releasing to factory. */
  async ensureProductionSetup(salesOrderId: string, user?: AuthUser) {
    return this.orderProductionSetup.ensureSetup(salesOrderId, user);
  }

  async confirm(id: string, userId: string) {
    const order = await this.getById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft sales orders can be confirmed.',
      });
    }

    const setupReleased = await this.orderProductionSetup.isReleased(id);
    if (!setupReleased) {
      throw new BadRequestException({
        code: 'SETUP_INCOMPLETE',
        message:
          'Complete Production Setup and release before confirming. Use POST /sales-orders/:id/production-setup/release.',
      });
    }

    // Setup already created POs on release — confirm is a no-op alias after Piece 2.
    const existing = await this.prisma.productionOrder.count({ where: { salesOrderId: id } });
    if (existing > 0) {
      return this.getById(id);
    }

    const productionLines = order.lines.filter((l) => l.productionRequired);
    if (!productionLines.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Sales order has no production-required lines.',
      });
    }

    const stages = await this.prisma.productionStageDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (!stages.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'No active production stage definitions configured.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of productionLines) {
        const poNumber = await this.sequences.next('PO', 'PO');
        const productionOrder = await tx.productionOrder.create({
          data: {
            number: poNumber,
            salesOrderId: order.id,
            salesOrderLineId: line.id,
            customerId: order.customerId,
            productId: line.productId ?? undefined,
            productDescription: line.description,
            quantity: line.quantity,
            specifications: line.specifications ?? undefined,
            requiredDeliveryDate: order.requiredDeliveryDate ?? undefined,
            status: 'PLANNED',
            createdById: userId,
          },
        });

        await this.workflowSnapshots.createSnapshotForProductionOrder(
          {
            productionOrderId: productionOrder.id,
            productId: line.productId,
            productDescription: line.description,
            quantity: Number(line.quantity),
            specifications: line.specifications,
            createdById: userId,
          },
          tx,
        );
      }

      const readiness = await this.inventory.tryReserveForSalesOrder(id, userId, tx);
      if (!readiness.ready) {
        await tx.productionOrder.updateMany({
          where: { salesOrderId: id, status: 'PLANNED' },
          data: { status: 'WAITING_FOR_MATERIALS' },
        });
      }

      return tx.salesOrder.update({
        where: { id },
        data: {
          status: readiness.ready
            ? SalesOrderStatus.READY_FOR_PRODUCTION
            : SalesOrderStatus.WAITING_FOR_MATERIALS,
        },
        include: {
          lines: true,
          productionOrders: { include: { stages: true, tasks: true } },
        },
      });
    }).then(async (updated) => {
      await this.notifications
        .notifyCustomerUsers(order.customerId, {
          templateCode: 'ORDER_CONFIRMED',
          vars: { number: order.number },
          linkUrl: `/sales-orders/${order.id}`,
        })
        .catch(() => undefined);

      // Piece 2: do not auto-schedule — worker assignment is Piece 3.
      return updated;
    });
  }

  async hold(id: string, userId: string, reason?: string) {
    const order = await this.getById(id);
    const holdable: SalesOrderStatus[] = [
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.IN_PRODUCTION,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
      SalesOrderStatus.WAITING_FOR_PAYMENT,
    ];
    if (!holdable.includes(order.status as SalesOrderStatus)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot hold sales order in status ${order.status}.`,
      });
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.ON_HOLD,
        notes: reason
          ? [order.notes, `Hold: ${reason}`].filter(Boolean).join('\n')
          : order.notes,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'sales-order.hold',
        entityType: 'SalesOrder',
        entityId: id,
        newValues: { reason: reason ?? null },
      },
    });
    return updated;
  }

  /**
   * Piece 11 — phase-aware cancel impact preview (materials, SEMI/FIN, tasks, purchasing, finance).
   * Does not mutate. Purchase commitments are informational only (never auto-cancelled).
   */
  async getCancelImpact(id: string, user?: AuthUser) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, archivedAt: null },
      include: {
        customer: { select: { id: true, name: true, nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          take: 3,
          select: {
            description: true,
            quantity: true,
            product: { select: { sku: true, nameEn: true, nameAr: true } },
          },
        },
        deliveries: { select: { id: true, status: true } },
        productionOrders: { select: { id: true, status: true } },
        invoices: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            payments: { select: { id: true }, take: 1 },
            allocations: { select: { id: true }, take: 1 },
          },
        },
        productionSetup: {
          include: {
            lines: {
              include: {
                materialRequirements: {
                  select: { sku: true, inventoryItemId: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    }
    if (user && !assertCustomerOwns(user, order.customerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot access this sales order.',
      });
    }

    const phase = resolveSalesOrderCancelPhase({
      status: order.status,
      deliveryStatuses: order.deliveries.map((d) => d.status),
    });
    const alreadyCancelled = order.status === SalesOrderStatus.CANCELLED;
    const canCancel = !alreadyCancelled && phase >= 1 && phase <= 4;
    const blockReason = alreadyCancelled
      ? 'ALREADY_CANCELLED'
      : phase === 5
        ? 'USE_RETURN'
        : undefined;

    const productSummary = order.lines
      .map((l) => {
        const name =
          l.product?.nameEn ||
          l.product?.nameAr ||
          l.description;
        const sku = l.product?.sku ? ` (${l.product.sku})` : '';
        return `${name}${sku} × ${Number(l.quantity)}`;
      })
      .join('; ');

    const dealerName =
      order.customer.nameEn ||
      order.customer.name ||
      order.customer.nameAr ||
      order.customer.nameHe ||
      '';

    const poIds = order.productionOrders.map((p) => p.id);

    const [issueTxs, semiLots, finishedLots, taskGroups, paymentsOnCustomer] =
      await Promise.all([
        poIds.length
          ? this.prisma.inventoryTransaction.findMany({
              where: {
                type: 'PRODUCTION_ISSUE',
                referenceType: 'ProductionOrder',
                referenceId: { in: poIds },
              },
              select: {
                quantity: true,
                unitCost: true,
                inventoryItem: { select: { sku: true, nameEn: true, standardCost: true } },
              },
            })
          : Promise.resolve([]),
        this.prisma.inventoryLot.findMany({
          where: {
            OR: [
              { salesOrderId: id },
              ...(poIds.length ? [{ productionOrderId: { in: poIds } }] : []),
            ],
            inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' },
            status: {
              in: ['AVAILABLE', 'RESERVED', 'REQUIRES_REVIEW', 'PARTIALLY_CONSUMED'],
            },
          },
          include: {
            inventoryItem: { select: { sku: true } },
            warehouse: { select: { code: true, nameEn: true } },
          },
        }),
        this.prisma.inventoryLot.findMany({
          where: {
            salesOrderId: id,
            inventoryItem: { itemClass: 'FINISHED_GOOD' },
            status: { in: ['AVAILABLE', 'RESERVED', 'REQUIRES_REVIEW'] },
          },
          include: {
            inventoryItem: { select: { sku: true } },
          },
        }),
        poIds.length
          ? this.prisma.productionTask.groupBy({
              by: ['status'],
              where: { productionOrderId: { in: poIds } },
              _count: { _all: true },
            })
          : Promise.resolve([] as Array<{ status: string; _count: { _all: number } }>),
        this.prisma.payment.count({
          where: {
            OR: [
              { invoice: { salesOrderId: id } },
              {
                allocations: {
                  some: { invoice: { salesOrderId: id } },
                },
              },
            ],
          },
        }),
      ]);

    let materialsConsumedAmount = 0;
    const materialParts: string[] = [];
    for (const tx of issueTxs) {
      const qty = Math.abs(Number(tx.quantity));
      const unit =
        tx.unitCost != null && Number(tx.unitCost) > 0
          ? Number(tx.unitCost)
          : tx.inventoryItem.standardCost != null
            ? Number(tx.inventoryItem.standardCost)
            : 0;
      materialsConsumedAmount += qty * unit;
      const label = tx.inventoryItem.sku || tx.inventoryItem.nameEn || 'material';
      materialParts.push(`${label} ${qty}`);
    }
    materialsConsumedAmount = Number(roundMoney(materialsConsumedAmount));

    const statusCount = new Map<string, number>();
    for (const row of taskGroups) {
      statusCount.set(row.status, row._count._all);
    }
    let openTasks = 0;
    for (const s of OPEN_TASK_STATUSES) {
      openTasks += statusCount.get(s) ?? 0;
    }
    const inProgressTasks = statusCount.get('IN_PROGRESS') ?? 0;
    const completedTasksPreserved = statusCount.get('COMPLETED') ?? 0;

    const demandItemIds = new Set<string>();
    const demandSkus = new Set<string>();
    for (const line of order.productionSetup?.lines ?? []) {
      for (const m of line.materialRequirements) {
        if (m.inventoryItemId) demandItemIds.add(m.inventoryItemId);
        if (m.sku?.trim()) demandSkus.add(m.sku.trim().toUpperCase());
      }
    }

    const purchaseCommitments: Array<{ number: string; sku: string; note: string }> = [];
    if (demandItemIds.size || demandSkus.size) {
      const openPos = await this.prisma.purchaseOrder.findMany({
        where: {
          archivedAt: null,
          status: { in: ['DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'] },
          lines: {
            some: {
              OR: [
                ...(demandItemIds.size
                  ? [{ inventoryItemId: { in: [...demandItemIds] } }]
                  : []),
                ...(demandSkus.size
                  ? [
                      {
                        inventoryItem: {
                          sku: { in: [...demandSkus], mode: 'insensitive' as const },
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
        },
        include: {
          lines: {
            include: { inventoryItem: { select: { sku: true } } },
          },
        },
        take: 40,
      });
      for (const po of openPos) {
        for (const line of po.lines) {
          const sku = line.inventoryItem?.sku?.toUpperCase() ?? '';
          const match =
            (line.inventoryItemId && demandItemIds.has(line.inventoryItemId)) ||
            (sku && demandSkus.has(sku));
          if (!match) continue;
          purchaseCommitments.push({
            number: po.number,
            sku: line.inventoryItem?.sku || sku || '—',
            note: 'Shared supplier PO — will not be auto-cancelled',
          });
        }
      }
    }

    const invoiceRow = order.invoices[0] ?? null;
    const paymentsPresent =
      paymentsOnCustomer > 0 ||
      Boolean(invoiceRow?.payments?.length) ||
      Boolean(invoiceRow?.allocations?.length);
    const financialAttention =
      Boolean(invoiceRow) ||
      paymentsPresent ||
      (invoiceRow != null &&
        ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(invoiceRow.status));

    const finDispositionRequired =
      finishedLots.some((l) => l.status === 'AVAILABLE' || l.status === 'RESERVED') ||
      phase === 4;
    const semiDispositionRequired =
      semiLots.length > 0 || phase === 3;

    return {
      phase: phase as CancelPhase,
      canCancel,
      ...(blockReason ? { blockReason } : {}),
      salesOrder: {
        id: order.id,
        number: order.number,
        status: order.status,
        productSummary,
        dealerName,
      },
      currentState: cancelPhaseCurrentState(phase, order.status),
      impact: {
        materialsConsumedAmount,
        materialsConsumedSummary: materialParts.length
          ? materialParts.slice(0, 8).join(', ')
          : 'No raw materials consumed',
        semiLots: semiLots.map((l) => ({
          id: l.id,
          sku: l.inventoryItem.sku,
          qty: Number(l.quantity),
          status: l.status,
          warehouse: l.warehouse.code || l.warehouse.nameEn || '',
        })),
        finishedLots: finishedLots.map((l) => ({
          id: l.id,
          sku: l.inventoryItem.sku,
          qty: Number(l.quantity),
          status: l.status,
        })),
        openTasks,
        inProgressTasks,
        completedTasksPreserved,
        purchaseCommitments,
        invoice: invoiceRow
          ? {
              id: invoiceRow.id,
              number: invoiceRow.number,
              status: invoiceRow.status,
              total: Number(invoiceRow.total),
            }
          : null,
        paymentsPresent,
        financialAttention,
      },
      finDispositionRequired,
      semiDispositionRequired,
    };
  }

  async cancel(
    id: string,
    userId: string,
    opts: { reasonCode: string; reason?: string },
  ) {
    if (!opts?.reasonCode?.trim()) {
      throw new BadRequestException({
        code: 'CANCEL_REASON_REQUIRED',
        message: 'reasonCode is required.',
      });
    }
    const reasonCode = normalizeCancelReasonCode(opts.reasonCode);
    if (!reasonCode) {
      throw new BadRequestException({
        code: 'CANCEL_REASON_REQUIRED',
        message: `Invalid reasonCode. Allowed: Dealer requested, Duplicate, Spec error, Unable to manufacture, Material unavailable, Commercial agreement, Administrative error, Other.`,
      });
    }

    const impact = await this.getCancelImpact(id);
    if (impact.phase === 5 || impact.blockReason === 'USE_RETURN') {
      throw new BadRequestException({
        code: 'USE_RETURN',
        message: 'Order is shipped or delivered. Use a Return request instead of cancel.',
      });
    }
    if (!impact.canCancel) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot cancel sales order in status ${impact.salesOrder.status}.`,
      });
    }

    const cancellationReason = formatCancellationReason(reasonCode, opts.reason);

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CANCELLED,
          cancellationReason,
        },
      });

      // Cancel open production orders (not COMPLETED). Do NOT cancel supplier PurchaseOrders.
      await tx.productionOrder.updateMany({
        where: {
          salesOrderId: id,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        data: { status: 'CANCELLED' },
      });

      const cancelledPos = await tx.productionOrder.findMany({
        where: { salesOrderId: id, status: 'CANCELLED' },
        select: { id: true },
      });
      const poIds = cancelledPos.map((row) => row.id);

      // Cancel unstarted + in-progress tasks; preserve COMPLETED history.
      if (poIds.length) {
        const inProgress = await tx.productionTask.findMany({
          where: {
            productionOrderId: { in: poIds },
            status: 'IN_PROGRESS',
          },
          select: { id: true },
        });
        await tx.productionTask.updateMany({
          where: {
            productionOrderId: { in: poIds },
            status: { in: [...CANCEL_TASK_STATUSES] },
          },
          data: { status: 'CANCELLED' },
        });
        for (const task of inProgress) {
          await tx.auditEvent.create({
            data: {
              userId,
              action: 'production-task.cancel',
              entityType: 'ProductionTask',
              entityId: task.id,
              newValues: {
                reason: 'sales-order.cancel',
                note: 'In-progress task cancelled with sales order',
              },
            },
          });
        }
      }

      // SEMI → REQUIRES_REVIEW; do not reverse consumed RAW; leave FIN AVAILABLE (disposition later).
      await this.productionInventory.onProductionOrdersCancelled({
        productionOrderIds: poIds,
        userId,
        tx,
      });
      await this.inventory.releaseForSalesOrder(id, tx);

      await tx.auditEvent.create({
        data: {
          userId,
          action: 'sales-order.cancel',
          entityType: 'SalesOrder',
          entityId: id,
          newValues: {
            reasonCode,
            reason: opts.reason ?? null,
            cancellationReason,
            phase: impact.phase,
            financialAttention: impact.impact.financialAttention,
            finDispositionRequired: impact.finDispositionRequired,
            semiDispositionRequired: impact.semiDispositionRequired,
          },
        },
      });
      return cancelled;
    });
    return updated;
  }

  async setStatus(id: string, status: SalesOrderStatus) {
    return this.prisma.salesOrder.update({
      where: { id },
      data: { status },
    });
  }

  /** Fuzzy catalog image lookup when the SO line has no linked product image. */
  private async resolveCatalogImage(productName: string): Promise<string | null> {
    const needle = productName.trim().toLowerCase();
    if (!needle) return null;
    const tokens = needle
      .split(/[^a-zA-Z\u0600-\u06FF\u0590-\u05FF0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !/^\d+$/.test(t));

    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { nameEn: { equals: productName, mode: 'insensitive' } },
          { nameAr: { equals: productName, mode: 'insensitive' } },
          { nameHe: { equals: productName, mode: 'insensitive' } },
          { sku: { equals: productName, mode: 'insensitive' } },
          { imageUrl: { not: null } },
        ],
      },
      select: { sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true },
      take: 300,
    });

    const exact = products.find(
      (p) =>
        p.nameEn?.toLowerCase() === needle ||
        p.nameAr?.toLowerCase() === needle ||
        (p.nameHe && p.nameHe.toLowerCase() === needle) ||
        p.sku.toLowerCase() === needle,
    );
    if (exact?.imageUrl) return exact.imageUrl;

    let best: (typeof products)[number] | null = null;
    let bestScore = 0;
    for (const p of products) {
      if (!p.imageUrl) continue;
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
