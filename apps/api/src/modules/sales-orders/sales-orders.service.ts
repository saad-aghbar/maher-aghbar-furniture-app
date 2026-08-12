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
  calculateOrderCosts,
  type CostLine,
  type MaterialCostMap,
  type OrderCostResult,
} from '../../common/helpers/order-costing.util';
import { buildStageTaskInstructions } from '../../common/helpers/stage-task-instructions';
import { ListSalesOrdersDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { firstImageDocument } from '../../common/helpers/document-image.util';
import { buildSalesOrderSearchOr } from './build-sales-order-search-or';

function stripSalesOrderCosts<T extends object>(order: T, user?: AuthUser): T {
  if (!user?.customerId) return order;
  const copy = { ...(order as Record<string, unknown>) };

  delete copy.manufacturingCost;
  delete copy.costBreakdown;
  delete copy.productionPrice;
  delete copy.profit;
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
  ) {}

  /** Short-lived download URL for list thumbnails from request attachments. */
  private documentImageUrl(doc: { storageKey: string } | null | undefined): string | null {
    if (!doc?.storageKey) return null;
    const token = this.storage.createAccessToken(doc.storageKey, 3600);
    return `/api/v1/uploads/download?token=${token}`;
  }

  /** Latest purchase/stock unit cost per material SKU (inventory stays in sync with order costing). */
  async loadMaterialCosts(): Promise<MaterialCostMap> {
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: { unitCost: { not: null } },
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      select: {
        type: true,
        unitCost: true,
        inventoryItem: { select: { sku: true } },
      },
      take: 800,
    });
    const map: MaterialCostMap = new Map();
    // Prefer purchase receipts, then any later costed movement
    const ranked = [...txs].sort((a, b) => {
      const rank = (t: string) => (t === 'PURCHASE_RECEIPT' ? 0 : 1);
      return rank(a.type) - rank(b.type);
    });
    for (const tx of ranked) {
      const sku = tx.inventoryItem.sku;
      if (!map.has(sku) && tx.unitCost != null) {
        map.set(sku, Number(tx.unitCost));
      }
    }
    return map;
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
            },
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
            reason: true,
            productDesc: true,
            quantity: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
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
      const mapped = {
        id: po.id,
        number: po.number,
        status: po.status,
        currentStageCode: po.currentStageCode,
        progressPercent: po.progressPercent,
        stages,
        // PO-level flat photo list stays admin-only; dealers get stage.photos instead.
        photos: isDealer ? [] : photos,
      };
      return isDealer ? mapProgressForDealer(mapped) : mapped;
    });

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
    };
    const withProgress = user?.customerId ? mapProgressForDealer(result) : result;

    return stripSalesOrderCosts(withProgress, user);
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

    return this.prisma.salesOrder.update({
      where: { id },
      data: {
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
      include: {
        customer: true,
        quotation: { select: { id: true, number: true, status: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        productionOrders: {
          select: {
            id: true,
            number: true,
            status: true,
            currentStageCode: true,
            progressPercent: true,
          },
        },
      },
    });
  }

  async confirm(id: string, userId: string) {
    const order = await this.getById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft sales orders can be confirmed.',
      });
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
            stages: {
              create: stages.map((stage) => ({
                stageDefinitionId: stage.id,
                status: 'PENDING',
              })),
            },
          },
          include: { stages: true },
        });

        for (const stageInstance of productionOrder.stages) {
          const stageDef = stages.find((s) => s.id === stageInstance.stageDefinitionId)!;
          const taskNumber = await this.sequences.next('TASK', 'TSK');
          await tx.productionTask.create({
            data: {
              number: taskNumber,
              productionOrderId: productionOrder.id,
              stageDefinitionId: stageDef.id,
              stageInstanceId: stageInstance.id,
              name: stageDef.nameEn,
              description: buildStageTaskInstructions({
                stageCode: stageDef.code,
                stageNameEn: stageDef.nameEn,
                productDescription: line.description,
                quantity: Number(line.quantity),
                specifications: line.specifications,
              }),
              status: 'NOT_STARTED',
            },
          });
        }
      }

      return tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.READY_FOR_PRODUCTION },
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

      for (const productionOrder of updated.productionOrders ?? []) {
        await this.scheduling
          .generateForProductionOrder(productionOrder.id, userId)
          .catch((err) => this.scheduling.markNeedsReview(productionOrder.id, userId, err).catch(() => undefined));
      }

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

  async cancel(id: string, userId: string, reason?: string) {
    const order = await this.getById(id);
    const cancellable: SalesOrderStatus[] = [
      SalesOrderStatus.DRAFT,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.READY_FOR_PRODUCTION,
      SalesOrderStatus.ON_HOLD,
      SalesOrderStatus.WAITING_FOR_PAYMENT,
      SalesOrderStatus.WAITING_FOR_MATERIALS,
    ];
    if (!cancellable.includes(order.status as SalesOrderStatus)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot cancel sales order in status ${order.status}.`,
      });
    }
    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.CANCELLED,
        cancellationReason: reason ?? 'Cancelled',
      },
    });
    await this.prisma.productionOrder.updateMany({
      where: {
        salesOrderId: id,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'CANCELLED' },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'sales-order.cancel',
        entityType: 'SalesOrder',
        entityId: id,
        newValues: { reason: reason ?? null },
      },
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
