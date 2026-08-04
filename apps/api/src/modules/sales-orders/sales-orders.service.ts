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
import { assertCustomerOwns, customerScopeFilter } from '../../common/helpers/customer-scope';
import { mapProgressForDealer } from '../../common/helpers/dealer-progress.util';
import {
  calculateOrderCosts,
  type CostLine,
  type MaterialCostMap,
  type OrderCostResult,
} from '../../common/helpers/order-costing.util';
import { buildStageTaskInstructions } from '../../common/helpers/stage-task-instructions';
import { ListSalesOrdersDto, UpdateSalesOrderDto } from './dto/sales-order.dto';

function stripSalesOrderCosts<T extends object>(order: T, user?: AuthUser): T {
  if (!user?.customerId) return order;
  const copy = { ...order } as T & {
    manufacturingCost?: unknown;
    costBreakdown?: unknown;
    productionPrice?: unknown;
    profit?: unknown;
  };
  delete copy.manufacturingCost;
  delete copy.costBreakdown;
  delete copy.productionPrice;
  delete copy.profit;
  return copy;
}

function maxProgress(
  productionOrders: Array<{ progressPercent?: number | null }> | undefined,
): number | null {
  if (!productionOrders?.length) return null;
  return Math.max(...productionOrders.map((po) => Number(po.progressPercent ?? 0)));
}

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

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
    const where: Prisma.SalesOrderWhereInput = {
      archivedAt: null,
      ...customerScopeFilter(user),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' } },
              { externalOrderNumber: { contains: query.q, mode: 'insensitive' } },
              { projectName: { contains: query.q, mode: 'insensitive' } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameAr: { contains: query.q, mode: 'insensitive' } } },
              { customer: { nameEn: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
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
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const materialCosts = user?.customerId ? new Map<string, number>() : await this.loadMaterialCosts();
    const dealerPriceCache = new Map<string, Map<string, number>>();

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
        const base = stripSalesOrderCosts(
          {
            ...row,
            manufacturingCost: costs.productionPrice,
            costBreakdown: costs.costBreakdown,
            progressPercent: maxProgress(row.productionOrders),
            title,
            imageUrl,
            lineCount: row.lines.length,
            sellerPrice: costs.sellerPrice,
            productionPrice: costs.productionPrice,
            profit: costs.profit,
          },
          user,
        );
        return user?.customerId ? mapProgressForDealer(base) : base;
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
                    sortOrder: true,
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

    const productionOrders = order.productionOrders.map((po) => {
      const photos = (po.documents ?? []).map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        category: doc.category,
        createdAt: doc.createdAt,
      }));
      const mapped = {
        id: po.id,
        number: po.number,
        status: po.status,
        currentStageCode: po.currentStageCode,
        progressPercent: po.progressPercent,
        stages: po.stages.map((s) => ({
          code: s.stageDefinition.code,
          nameEn: s.stageDefinition.nameEn,
          nameAr: s.stageDefinition.nameAr,
          sortOrder: s.stageDefinition.sortOrder,
          status: s.status,
          progressPercent: s.progressPercent,
          actualStart: s.actualStart,
          actualEnd: s.actualEnd,
        })),
        photos,
      };
      return user?.customerId ? mapProgressForDealer(mapped) : mapped;
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

    if (!user?.customerId) {
      await this.prisma.salesOrder.update({
        where: { id: order.id },
        data: {
          manufacturingCost: costs.productionPrice,
          costBreakdown: costs.costBreakdown as Prisma.InputJsonValue,
        },
      });
    }

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
    const result = {
      ...orderWithoutContracts,
      manufacturingCost: costs.productionPrice,
      costBreakdown: costs.costBreakdown,
      productionOrders,
      progressPercent: maxProgress(productionOrders),
      sellerPrice: costs.sellerPrice,
      productionPrice: costs.productionPrice,
      profit: costs.profit,
      customerRequest,
      /** Alias used by UIs that previously showed ERP "lines" */
      orderedItems: customerRequest.items,
      title,
      imageUrl,
    };
    const withProgress = user?.customerId ? mapProgressForDealer(result) : result;

    return stripSalesOrderCosts(withProgress, user);
  }

  async update(id: string, dto: UpdateSalesOrderDto, user?: AuthUser) {
    if (user?.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot update sales order costs.',
      });
    }
    await this.getById(id, user);
    return this.prisma.salesOrder.update({
      where: { id },
      data: {
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
