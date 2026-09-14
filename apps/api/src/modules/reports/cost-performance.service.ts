import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTxType, Prisma } from '@maher/database';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { lineVisualIdentity } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { applyReceiptPrices, coverageSummary, receiptPriceByItem } from '../inventory/cost-coverage';
import { rollupLaborCost, summarizeLaborEntries } from '../production/labor-costing';
import { ensureTaskTimeEntry } from '../tasks/ensure-time-entry';
import { freezePlannedCostAtRelease } from '../production/planned-cost-snapshot';
import {
  actualMaterialFromTransactions,
  averagePerUnit,
  marginFrom,
  skuLedgerFromTransactions,
  costVariance,
} from './order-cost-ledger';
import { aggregateFactoryTime } from './order-time';
import { deriveKeyedStats, deriveProductStats, sortProductStats } from './product-cost-analytics';
import {
  lifetimeCost,
  originBucket,
  recoveryOutcomeValue,
} from './return-cost-rollup';
import {
  assembleActualProduction,
  collectionFromInvoices,
  saleValueFromCommercial,
  type ClassifiedTx,
} from './production-cost';
import {
  addFlowMoney,
  classifyInventoryFlow,
  consumptionFromFlow,
  currentInventoryValue,
  emptyFlowMoney,
  rawGroupFromCategory,
} from './inventory-economics';
import {
  costOrdersWhere,
  costProductsSearch,
  costReturnsWhere,
  dateRange,
  parseDateBasis,
} from './cost-query';

const ISSUE_TYPES: InventoryTxType[] = [
  InventoryTxType.PRODUCTION_ISSUE,
  InventoryTxType.PRODUCTION_RETURN,
  InventoryTxType.SCRAP,
  InventoryTxType.DAMAGE,
];

const ACTIVITY_TX_TYPES: InventoryTxType[] = [
  ...ISSUE_TYPES,
  InventoryTxType.PURCHASE_RECEIPT,
  InventoryTxType.WAREHOUSE_TRANSFER,
  InventoryTxType.SEMI_FINISHED_RECEIPT,
  InventoryTxType.FINISHED_GOODS_RECEIPT,
  InventoryTxType.INVENTORY_ADJUSTMENT,
  InventoryTxType.CUSTOMER_RETURN,
];

@Injectable()
export class CostPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCostRead(user?: AuthUser) {
    if (user?.customerId || !can(user, 'inventory.cost.read')) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' });
    }
  }

  async listOrders(    query: {
      from?: string;
      to?: string;
      dateBasis?: string;
      customerId?: string;
      productId?: string;
      variantId?: string;
      optionValueId?: string;
      status?: string;
      q?: string;
      complexity?: string;
      delivered?: string;
      hasReturn?: string | boolean;
      hasRework?: string | boolean;
      coverage?: string;
      marginHealth?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
      user?: AuthUser;
    }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = costOrdersWhere(query);
    const needsComputed =
      Boolean(query.coverage || query.marginHealth) ||
      ['highestCost', 'lowestMargin', 'highestMargin', 'longestTime', 'largestSale'].includes(
        String(query.sort ?? ''),
      );

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: needsComputed ? 0 : (page - 1) * pageSize,
        take: needsComputed ? 500 : pageSize,
        include: {
          customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
          lines: {
            select: {
              id: true,
              description: true,
              quantity: true,
              lineTotal: true,
              manufacturingComplexity: true,
              variantLabel: true,
              product: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true } },
            },
          },
          invoices: {
            where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
            select: { subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
            orderBy: { createdAt: 'desc' },
          },
          returns: { select: { id: true } },
          productionOrders: {
            where: { archivedAt: null, originType: 'SALES_ORDER' },
            select: {
              id: true,
              salesOrderLineId: true,
              quantity: true,
              actualStartDate: true,
              actualCompletionDate: true,
              plannedMaterialCost: true,
              plannedCostFrozenAt: true,
              tasks: {
                select: {
                  id: true,
                  actualMinutes: true,
                  isRework: true,
                  assignedEmployeeId: true,
                  stageDefinitionId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const rows = await this.assembleOrderRows(orders);
    const filtered = rows.filter((row) => {
      if (query.coverage === 'full' && !row.complete) return false;
      if (query.coverage === 'partial' && row.coverage !== 'PARTIAL') return false;
      if (query.coverage === 'unpriced' && row.coverage !== 'UNPRICED') return false;
      if (query.marginHealth === 'negative' && !(row.grossMargin != null && row.grossMargin < 0)) return false;
      if (query.marginHealth === 'low' && !(row.marginPct != null && row.marginPct < 15)) return false;
      if (query.marginHealth === 'healthy' && !(row.marginPct != null && row.marginPct >= 15)) return false;
      return true;
    });
    const sorted = sortCostOrders(filtered, query.sort);
    const pageRows = needsComputed
      ? sorted.slice((page - 1) * pageSize, page * pageSize)
      : sorted;
    return { data: pageRows, meta: paginatedMeta(page, pageSize, needsComputed ? filtered.length : total) };
  }

  private async assembleOrderRows(
    orders: Array<{
      id: string;
      number: string;
      status: string;
      orderDate: Date;
      subtotal?: unknown;
      manufacturingCost?: unknown;
      plannedCostFrozenAt?: Date | null;
      customer: { nameEn: string | null; nameAr: string | null; nameHe: string | null };
      lines: Array<{
        id: string;
        description: string;
        quantity: unknown;
        lineTotal?: unknown;
        manufacturingComplexity?: string | null;
        variantLabel?: string | null;
        product?: { sku: string; nameEn?: string | null; nameAr?: string | null } | null;
      }>;
      invoices: Array<{
        subtotal: unknown;
        paidAmount?: unknown;
        outstandingAmount?: unknown;
        status?: string;
      }>;
      returns?: Array<{ id: string }>;
      productionOrders: Array<{
        id: string;
        salesOrderLineId?: string | null;
        quantity: unknown;
        actualStartDate: Date | null;
        actualCompletionDate: Date | null;
        plannedMaterialCost: unknown;
        plannedCostFrozenAt: Date | null;
        tasks: Array<{
          id?: string;
          actualMinutes: number | null;
          isRework: boolean;
          assignedEmployeeId: string | null;
          stageDefinitionId: string | null;
        }>;
      }>;
    }>,
  ) {
    const poIds = orders.flatMap((o) => o.productionOrders.map((po) => po.id));
    const txs = poIds.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            type: { in: ISSUE_TYPES },
            OR: [{ productionOrderId: { in: poIds } }, { referenceType: 'ProductionOrder', referenceId: { in: poIds } }],
          },
          select: {
            type: true,
            quantity: true,
            unitCost: true,
            productionOrderId: true,
            productionTaskId: true,
            referenceType: true,
            referenceId: true,
            inventoryItem: { select: { category: true, materialGroup: true } },
          },
        })
      : [];

    const txsByPo = new Map<string, typeof txs>();
    for (const tx of txs) {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      if (!poId) continue;
      const list = txsByPo.get(poId) ?? [];
      list.push(tx);
      txsByPo.set(poId, list);
    }

    const taskById = new Map(
      orders.flatMap((order) =>
        order.productionOrders.flatMap((po) => po.tasks.map((task) => [task.id ?? '', task] as const)),
      ),
    );
    const taskIds = [...taskById.keys()].filter(Boolean);
    const [rates, entries] = await Promise.all([
      typeof this.prisma.laborRate?.findMany === 'function'
        ? this.prisma.laborRate.findMany()
        : Promise.resolve([]),
      taskIds.length && typeof this.prisma.taskTimeEntry?.findMany === 'function'
        ? this.prisma.taskTimeEntry.findMany({
            where: { taskId: { in: taskIds } },
            select: { id: true, taskId: true, userId: true, minutes: true, startedAt: true, endedAt: true },
          })
        : Promise.resolve([]),
    ]);

    return orders.map((order) => {
      const reworkByTask = new Map(
        order.productionOrders.flatMap((po) => po.tasks.map((task) => [task.id, task.isRework] as const)),
      );
      const classified: ClassifiedTx[] = order.productionOrders.flatMap((po) =>
        (txsByPo.get(po.id) ?? []).map((tx) => ({
          type: String(tx.type),
          quantity: tx.quantity,
          unitCost: tx.unitCost,
          category: tx.inventoryItem?.category,
          materialGroup: tx.inventoryItem?.materialGroup,
          isRework: tx.productionTaskId ? Boolean(reworkByTask.get(tx.productionTaskId)) : false,
        })),
      );
      const orderTasks = order.productionOrders.flatMap((po) => po.tasks);
      const labor = summarizeLaborEntries({
        rates,
        tasks: orderTasks
          .filter((task) => task.id)
          .map((task) => ({
            id: task.id!,
            stageDefinitionId: task.stageDefinitionId,
            isRework: task.isRework,
          })),
        entries: entries.filter((entry) =>
          order.productionOrders.some((po) => po.tasks.some((task) => task.id === entry.taskId)),
        ),
      });
      const mix = assembleActualProduction({ txs: classified, labor });
      const time = aggregateFactoryTime(order.productionOrders.flatMap((po) => po.tasks), {
        start: earliest(order.productionOrders.map((po) => po.actualStartDate)),
        end: latest(order.productionOrders.map((po) => po.actualCompletionDate)),
      });
      const lineTotals = order.lines.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0);
      const saleValue = saleValueFromCommercial({
        invoiceSubtotal: order.invoices[0]?.subtotal,
        lineTotalsSum: lineTotals,
        orderSubtotal: order.subtotal,
      });
      const cash = collectionFromInvoices(order.invoices);
      const planned = order.plannedCostFrozenAt
        ? positiveUnitCost(order.manufacturingCost)
        : order.productionOrders.some((po) => po.plannedCostFrozenAt)
          ? order.productionOrders.reduce((sum, po) => sum + (positiveUnitCost(po.plannedMaterialCost) ?? 0), 0) || null
          : positiveUnitCost(order.manufacturingCost);
      const { grossMargin, marginPct, incomplete } = marginFrom(saleValue, mix.total, mix.complete);
      const qty = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
      return {
        id: order.id,
        number: order.number,
        status: order.status,
        orderDate: order.orderDate,
        dealer: order.customer,
        productSummary: order.lines
          .map((line) => line.product?.sku || line.variantLabel || line.description)
          .filter(Boolean)
          .slice(0, 3)
          .join(' · '),
        items: order.lines.length,
        quantity: qty,
        actualCost: mix.total,
        materials: mix.materials,
        fabric: mix.fabric,
        waste: mix.waste,
        rework: mix.rework,
        afterSaleCost: null as number | null,
        averageCostPerUnit: averagePerUnit(mix.total, qty),
        saleValue,
        invoiced: cash.invoiced,
        collected: cash.collected,
        outstanding: cash.outstanding,
        plannedCost: planned,
        variance: costVariance(planned, mix.total),
        grossMargin,
        marginPct,
        marginIncomplete: incomplete,
        complete: mix.complete,
        coverage: mix.coverage,
        coveragePct: mix.coveragePct,
        labor: mix.labor,
        laborTimeKnown: mix.laborTimeKnown,
        laborCostPriced: mix.laborCostPriced,
        fabricCoverage: mix.fabricCoverage,
        laborCoverage: mix.laborCoverage,
        workerEffortMinutes: labor.timedMinutes || time.workerEffortMinutes,
        wallClockMinutes: time.wallClockMinutes,
        hasReturn: Boolean(order.returns?.length),
        hasRework: order.productionOrders.some((po) => po.tasks.some((task) => task.isRework)),
      };
    });
  }

  async dossier(salesOrderId: string, user?: AuthUser) {
    this.assertCostRead(user);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, archivedAt: null },
      include: {
        customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: { select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true } },
            productionOrders: {
              where: { archivedAt: null },
              select: {
                id: true,
                originType: true,
                quantity: true,
                plannedMaterialCost: true,
                plannedLaborCost: true,
                plannedCostFrozenAt: true,
                salesOrderLineId: true,
              },
            },
          },
        },
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { id: true, number: true, subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        productionOrders: {
          where: { archivedAt: null },
          include: {
            tasks: {
              select: {
                id: true,
                actualMinutes: true,
                isRework: true,
                assignedEmployeeId: true,
                stageDefinitionId: true,
                stageDefinition: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
              },
            },
            materialUsages: {
              select: {
                sku: true,
                expectedQty: true,
                actualQty: true,
                scrapQty: true,
                returnedQty: true,
                unitCost: true,
                extendedCost: true,
                finalizedAt: true,
                task: { select: { isRework: true } },
              },
            },
          },
        },
        returns: { select: { id: true, number: true, lifecycleState: true } },
      },
    });
    if (!order) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });

    const originalPos = order.productionOrders.filter((po) => po.originType === 'SALES_ORDER');
    const returnPos = order.productionOrders.filter((po) => po.originType !== 'SALES_ORDER');
    const allPoIds = order.productionOrders.map((po) => po.id);
    const txs = allPoIds.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            type: { in: ISSUE_TYPES },
            OR: [
              { productionOrderId: { in: allPoIds } },
              { referenceType: 'ProductionOrder', referenceId: { in: allPoIds } },
              { salesOrderId: order.id },
            ],
          },
          include: { inventoryItem: { select: { sku: true, nameEn: true, nameAr: true, category: true, materialGroup: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const originalIds = new Set(originalPos.map((po) => po.id));
    const originalTxs = txs.filter((tx) => {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      return poId != null && originalIds.has(poId);
    });
    const ledger = actualMaterialFromTransactions(originalTxs);
    const materials = skuLedgerFromTransactions(
      originalTxs.map((tx) => ({
        type: tx.type,
        quantity: tx.quantity,
        unitCost: tx.unitCost,
        inventoryItemId: tx.inventoryItemId,
        sku: tx.inventoryItem.sku,
      })),
    );
    const time = aggregateFactoryTime(
      originalPos.flatMap((po) =>
        po.tasks.map((task) => ({
          actualMinutes: task.actualMinutes,
          isRework: task.isRework,
          stageCode: task.stageDefinition?.code ?? null,
        })),
      ),
      {
        start: earliest(originalPos.map((po) => po.actualStartDate)),
        end: latest(originalPos.map((po) => po.actualCompletionDate)),
      },
    );

    const lineTotals = order.lines.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0);
    const saleValue = saleValueFromCommercial({
      invoiceSubtotal: order.invoices[0]?.subtotal,
      lineTotalsSum: lineTotals,
      orderSubtotal: order.subtotal,
    });
    const cash = collectionFromInvoices(order.invoices);
    const plannedFromPos = originalPos.reduce((sum, po) => {
      return (
        sum +
        (positiveUnitCost(po.plannedMaterialCost) ?? 0) +
        (positiveUnitCost(po.plannedLaborCost) ?? 0)
      );
    }, 0);
    const planned = order.plannedCostFrozenAt
      ? plannedFromPos > 0
        ? plannedFromPos
        : positiveUnitCost(order.manufacturingCost)
      : null;
    const labor = await this.laborForTasks(
      originalPos.flatMap((po) => po.tasks),
    );
    const classifiedOriginal: ClassifiedTx[] = originalTxs.map((tx) => ({
      type: String(tx.type),
      quantity: tx.quantity,
      unitCost: tx.unitCost,
      category: tx.inventoryItem?.category,
      isRework: tx.productionTaskId
        ? Boolean(originalPos.flatMap((po) => po.tasks).find((t) => t.id === tx.productionTaskId)?.isRework)
        : false,
    }));
    const mix = assembleActualProduction({
      txs: classifiedOriginal,
      usages: originalPos.flatMap((po) => po.materialUsages).map((row) => ({
        sku: row.sku,
        scrapQty: Number(row.scrapQty),
        unitCost: positiveUnitCost(row.unitCost),
        isRework: row.task.isRework,
      })),
      labor: {
        actual: labor.total,
        pricedMinutes: labor.pricedMinutes,
        unpricedMinutes: labor.unpricedMinutes,
        timedMinutes: labor.timedMinutes,
        reworkActual: labor.reworkActual,
        reworkMinutes: labor.reworkMinutes,
      },
    });
    const { grossMargin, marginPct, incomplete } = marginFrom(saleValue, mix.total, mix.complete);

    const usageEnrichment = originalPos.flatMap((po) => po.materialUsages).map((row) => ({
      sku: row.sku,
      expectedQty: Number(row.expectedQty),
      actualQty: Number(row.actualQty ?? 0),
      scrapQty: Number(row.scrapQty),
      returnedQty: Number(row.returnedQty),
      unitCost: positiveUnitCost(row.unitCost),
      extendedCost: positiveUnitCost(row.extendedCost),
      finalizedAt: row.finalizedAt,
      isRework: row.task.isRework,
    }));
    const scrapCost = usageEnrichment.reduce((sum, row) => {
      if (row.unitCost == null || !(row.scrapQty > 0)) return sum;
      return sum + row.unitCost * row.scrapQty;
    }, 0);
    const reworkMaterial = usageEnrichment.reduce((sum, row) => {
      if (!row.isRework || row.extendedCost == null) return sum;
      return sum + row.extendedCost;
    }, 0);

    const returnCost = await this.returnLifetime(order.id, returnPos, txs, mix.total);
    const qty = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);

    const lineBoards = [];
    for (const line of order.lines) {
        const linePoIds = new Set(
          line.productionOrders.filter((po) => po.originType === 'SALES_ORDER').map((po) => po.id),
        );
        const lineTxs = originalTxs.filter((tx) => {
          const poId = tx.productionOrderId || tx.referenceId;
          return poId != null && linePoIds.has(poId);
        });
        const lineTasks = originalPos
          .filter((po) => linePoIds.has(po.id) || po.salesOrderLineId === line.id)
          .flatMap((po) => po.tasks);
        const lineLabor = await this.laborForTasks(lineTasks);
        const lineMix = assembleActualProduction({
          txs: lineTxs.map((tx) => ({
            type: String(tx.type),
            quantity: tx.quantity,
            unitCost: tx.unitCost,
            category: tx.inventoryItem?.category,
            materialGroup: tx.inventoryItem?.materialGroup,
            isRework: tx.productionTaskId
              ? Boolean(lineTasks.find((t) => t.id === tx.productionTaskId)?.isRework)
              : false,
          })),
          usages: originalPos
            .filter((po) => linePoIds.has(po.id))
            .flatMap((po) => po.materialUsages)
            .map((row) => ({
              sku: row.sku,
              scrapQty: Number(row.scrapQty),
              unitCost: positiveUnitCost(row.unitCost),
              isRework: row.task.isRework,
            })),
          labor: {
            actual: lineLabor.total,
            pricedMinutes: lineLabor.pricedMinutes,
            unpricedMinutes: lineLabor.unpricedMinutes,
            timedMinutes: lineLabor.timedMinutes,
            reworkActual: lineLabor.reworkActual,
            reworkMinutes: lineLabor.reworkMinutes,
          },
        });
        const lineSale = saleValueFromCommercial({ lineTotalsSum: line.lineTotal });
        const lineMargin = marginFrom(lineSale, lineMix.total, lineMix.complete);
        const lineQty = Number(line.quantity);
        const spec =
          line.orderSpec && typeof line.orderSpec === 'object' && !Array.isArray(line.orderSpec)
            ? (line.orderSpec as {
                productImageRef?: string | null;
                primaryImageDocumentId?: string | null;
                variantLabel?: string | null;
                variantCode?: string | null;
              })
            : null;
        const plannedMaterial = line.productionOrders
          .filter((po) => po.originType === 'SALES_ORDER')
          .reduce(
            (sum, po) =>
              sum +
              (positiveUnitCost(po.plannedMaterialCost) ?? 0) +
              (positiveUnitCost(po.plannedLaborCost) ?? 0),
            0,
          );
        lineBoards.push({
          id: line.id,
          description: line.description,
          sku: line.product?.sku ?? null,
          variantLabel: line.variantLabel ?? spec?.variantLabel ?? spec?.variantCode ?? null,
          manufacturingComplexity: line.manufacturingComplexity ?? null,
          imageUrl: lineVisualIdentity({
            primaryImageDocumentId: spec?.primaryImageDocumentId,
            productImageRef: spec?.productImageRef,
            productImageUrl: line.product?.imageUrl ?? null,
          }),
          quantity: lineQty,
          saleValue: lineSale,
          actualCost: lineMix.total,
          actualMaterial: lineMix.materials,
          actualFabric: lineMix.fabric,
          actualLabor: lineMix.labor,
          plannedCost: plannedMaterial > 0 ? plannedMaterial : null,
          waste: lineMix.waste,
          rework: lineMix.rework,
          complete: lineMix.complete,
          coverage: lineMix.coverage,
          coveragePct: lineMix.coveragePct,
          margin: lineMargin.grossMargin,
          marginPct: lineMargin.marginPct,
          marginIncomplete: lineMargin.incomplete,
          averageCostPerUnit: averagePerUnit(lineMix.total, lineQty),
          perPieceTracked: false,
          note:
            lineQty > 1
              ? 'Per-physical-piece cost is not tracked. Quantity, total, and average per unit only.'
              : null,
        });
    }

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      orderDate: order.orderDate,
      dealer: order.customer,
      summary: {
        saleValue,
        invoiced: cash.invoiced,
        collected: cash.collected,
        outstanding: cash.outstanding,
        actualProductionCost: mix.total,
        materials: mix.materials,
        fabric: mix.fabric,
        waste: mix.waste,
        rework: mix.rework,
        plannedCost: planned,
        variance: costVariance(planned, mix.total),
        plannedFrozenAt: order.plannedCostFrozenAt,
        grossMargin,
        marginPct,
        marginIncomplete: incomplete,
        complete: mix.complete,
        coverage: mix.coverage,
        coveragePct: mix.coveragePct,
        labor: mix.labor,
        laborTimeKnown: mix.laborTimeKnown,
        laborCostPriced: mix.laborCostPriced,
        quantity: qty,
        averageCostPerUnit: averagePerUnit(mix.total, qty),
        perPieceTracked: false,
      },
      lines: lineBoards,
      materials: {
        coverage: mix.coverage,
        rows: materials,
        usage: usageEnrichment,
        scrapCost: mix.waste,
        scrapAlreadyInTotal: true,
        reworkMaterialCost: mix.rework,
      },
      time: {
        ...time,
        workerEffortMinutes: labor.timedMinutes || time.workerEffortMinutes,
        byStage: (labor.byStage?.length
          ? labor.byStage.map((stage) => ({
              stageCode: stage.stageCode,
              minutes: stage.minutes,
              workerEffortMinutes: stage.minutes,
            }))
          : time.byStage.map((stage) => ({
              ...stage,
              minutes: stage.workerEffortMinutes,
            }))
        ).filter((stage) => (stage.minutes ?? 0) > 0),
        labor,
      },
      waste: {
        scrapCost: mix.waste,
        alreadyIncludedInActual: true,
      },
      rework: {
        materialCost: mix.rework,
        effortMinutes: time.reworkEffortMinutes,
      },
      lifetime: {
        ...returnCost,
        originalProductionCost: mix.total,
        lifetimeCost: lifetimeCost(mix.total, returnCost.afterSaleReturnCost),
      },
      returns: order.returns,
      provenance: {
        source: 'inventory_transactions',
        formula: 'PRODUCTION_ISSUE minus PRODUCTION_RETURN using stored unitCost',
        issueCount: ledger.issueCount,
        costedIssueCount: ledger.costedIssueCount,
        transactions: txs
          .filter((tx) => {
            const poId = tx.productionOrderId || tx.referenceId;
            return poId != null && originalIds.has(poId);
          })
          .map((tx) => ({
            id: tx.id,
            number: tx.number,
            type: tx.type,
            sku: tx.inventoryItem.sku,
            quantity: Math.abs(Number(tx.quantity)),
            unitCost: positiveUnitCost(tx.unitCost),
            createdAt: tx.createdAt,
          })),
      },
    };
  }

  async listReturns(query: {
    user?: AuthUser;
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    customerId?: string;
    productId?: string;
    variantId?: string;
    status?: string;
    q?: string;
    sort?: string;
  }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = costReturnsWhere(query);
    const needsComputed = ['highestCost', 'mostPieces'].includes(String(query.sort ?? ''));
    const [total, rows] = await Promise.all([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: needsComputed ? 0 : (page - 1) * pageSize,
        take: needsComputed ? 500 : pageSize,
        select: {
          id: true,
          number: true,
          lifecycleState: true,
          createdAt: true,
          salesOrder: { select: { id: true, number: true } },
          pieces: { select: { id: true } },
        },
      }),
    ]);
    const data = await Promise.all(rows.map((row) => this.returnRow(row.id)));
    const sorted = [...data].sort((a, b) => {
      if (query.sort === 'highestCost') return (b.returnGrossCost ?? -1) - (a.returnGrossCost ?? -1);
      if (query.sort === 'mostPieces') return (b.pieceCount ?? 0) - (a.pieceCount ?? 0);
      return 0;
    });
    const pageRows = needsComputed ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;
    return { data: pageRows, meta: paginatedMeta(page, pageSize, needsComputed ? data.length : total) };
  }

  async returnDossier(returnId: string, user?: AuthUser) {
    this.assertCostRead(user);
    return this.returnRow(returnId, true);
  }

  async productAnalytics(
    user?: AuthUser,
    query: {
      productId?: string;
      variantId?: string;
      optionValueId?: string;
      status?: string;
      from?: string;
      to?: string;
      dateBasis?: string;
      customerId?: string;
      q?: string;
      complexity?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    this.assertCostRead(user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const matchingProducts = query.q
      ? await this.prisma.product.findMany({
          where: costProductsSearch(query),
          select: { id: true },
        })
      : null;
    const allowedIds = matchingProducts ? new Set(matchingProducts.map((p) => p.id)) : null;
    const orders = await this.prisma.salesOrder.findMany({
      where: costOrdersWhere({ ...query, q: undefined }),
      select: {
        id: true,
        returns: { select: { id: true } },
        lines: {
          select: {
            productId: true,
            variantId: true,
            variantSku: true,
            variantLabel: true,
            quantity: true,
            lineTotal: true,
            manufacturingComplexity: true,
            lineOptions: {
              select: {
                specOptionValueId: true,
                specOptionValue: {
                  select: {
                    code: true,
                    nameEn: true,
                    nameAr: true,
                    group: { select: { code: true, nameEn: true, nameAr: true } },
                  },
                },
              },
            },
            productionOrders: {
              where: { archivedAt: null, originType: 'SALES_ORDER' },
              select: {
                id: true,
                tasks: {
                  select: {
                    id: true,
                    actualMinutes: true,
                    isRework: true,
                    assignedEmployeeId: true,
                    stageDefinitionId: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const poIds = orders.flatMap((o) => o.lines.flatMap((l) => l.productionOrders.map((po) => po.id)));
    const txs = poIds.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            type: { in: ISSUE_TYPES },
            OR: [{ productionOrderId: { in: poIds } }, { referenceType: 'ProductionOrder', referenceId: { in: poIds } }],
          },
          select: {
            type: true,
            quantity: true,
            unitCost: true,
            productionOrderId: true,
            productionTaskId: true,
            referenceId: true,
            referenceType: true,
            inventoryItem: { select: { category: true, materialGroup: true } },
          },
        })
      : [];
    const byPo = new Map<string, typeof txs>();
    for (const tx of txs) {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      if (!poId) continue;
      const list = byPo.get(poId) ?? [];
      list.push(tx);
      byPo.set(poId, list);
    }
    const taskById = new Map(
      orders.flatMap((order) =>
        order.lines.flatMap((line) =>
          line.productionOrders.flatMap((po) => po.tasks.map((task) => [task.id, task] as const)),
        ),
      ),
    );
    const taskIds = [...taskById.keys()].filter(Boolean);
    const [rates, entries] = await Promise.all([
      typeof this.prisma.laborRate?.findMany === 'function'
        ? this.prisma.laborRate.findMany()
        : Promise.resolve([]),
      taskIds.length && typeof this.prisma.taskTimeEntry?.findMany === 'function'
        ? this.prisma.taskTimeEntry.findMany({
            where: { taskId: { in: taskIds } },
            select: { id: true, taskId: true, userId: true, minutes: true, startedAt: true, endedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const histories = orders.flatMap((order) =>
      order.lines
        .filter((line) => line.productId && (!query.productId || line.productId === query.productId))
        .filter((line) => !allowedIds || allowedIds.has(line.productId!))
        .filter((line) => !query.variantId || line.variantId === query.variantId)
        .map((line) => {
          const lineTasks = line.productionOrders.flatMap((po) => po.tasks);
          const reworkByTask = new Map(lineTasks.map((task) => [task.id, task.isRework] as const));
          const lineTxs = line.productionOrders.flatMap((po) => byPo.get(po.id) ?? []);
          const lineLabor = summarizeLaborEntries({
            rates,
            tasks: lineTasks
              .filter((task) => task.id)
              .map((task) => ({
                id: task.id,
                stageDefinitionId: task.stageDefinitionId,
                isRework: task.isRework,
              })),
            entries: entries.filter((entry) => lineTasks.some((task) => task.id === entry.taskId)),
          });
          const mix = assembleActualProduction({
            txs: lineTxs.map((tx) => ({
              type: String(tx.type),
              quantity: tx.quantity,
              unitCost: tx.unitCost,
              category: tx.inventoryItem?.category,
              materialGroup: tx.inventoryItem?.materialGroup,
              isRework: tx.productionTaskId ? Boolean(reworkByTask.get(tx.productionTaskId)) : false,
            })),
            labor: lineLabor,
          });
          return {
            productId: line.productId!,
            variantId: line.variantId ?? null,
            variantSku: line.variantSku ?? null,
            variantLabel: line.variantLabel ?? null,
            options: line.lineOptions,
            actualCost: mix.total,
            saleValue: saleValueFromCommercial({ lineTotalsSum: line.lineTotal }),
            quantity: Number(line.quantity) || 0,
            materials: mix.materials,
            fabric: mix.fabric,
            labor: mix.labor,
            workerEffortMinutes: lineLabor.timedMinutes || lineTasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0),
            hasReturn: Boolean(order.returns?.length),
            hasRework: lineTasks.some((task) => task.isRework),
          };
        }),
    );
    const stats = sortProductStats(deriveProductStats(histories), query.sort);
    const variantStats = sortProductStats(
      deriveKeyedStats(
        histories
          .filter((row) => row.variantId)
          .map((row) => ({ ...row, key: row.variantId! })),
        (key) => ({ variantId: key }),
      ),
      query.sort,
    );
    const optionHistories = histories.flatMap((row) =>
      (row.options ?? []).map((opt) => ({
        ...row,
        key: opt.specOptionValueId,
        optionValueId: opt.specOptionValueId,
        optionCode: opt.specOptionValue.code,
        optionName: opt.specOptionValue.nameEn,
        groupCode: opt.specOptionValue.group.code,
        groupName: opt.specOptionValue.group.nameEn,
      })),
    );
    const optionStats = deriveKeyedStats(optionHistories, (key) => ({ optionValueId: key }));
    const total = stats.length;
    const pageRows = stats.slice((page - 1) * pageSize, page * pageSize);
    const products = await this.prisma.product.findMany({
      where: { id: { in: pageRows.map((s) => s.productId) } },
      select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const variantIds = variantStats.map((row) => row.variantId);
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, productId: true },
        })
      : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const optionMeta = new Map(
      optionHistories.map((row) => [
        row.optionValueId,
        {
          optionValueId: row.optionValueId,
          optionCode: row.optionCode,
          optionName: row.optionName,
          groupCode: row.groupCode,
          groupName: row.groupName,
        },
      ]),
    );
    return {
      derived: true,
      data: pageRows.map((row) => ({
        ...row,
        product: byId.get(row.productId) ?? null,
      })),
      meta: paginatedMeta(page, pageSize, total),
      products: pageRows.map((row) => ({
        ...row,
        product: byId.get(row.productId) ?? null,
      })),
      variants: variantStats.map((row) => ({
        ...row,
        variant: variantById.get(row.variantId) ??
          histories.find((h) => h.variantId === row.variantId) ??
          null,
      })),
      byOption: optionStats.map((row) => ({
        ...row,
        ...(optionMeta.get(row.optionValueId) ?? {}),
      })),
    };
  }

  async costCoverage(user?: AuthUser, query: { from?: string; to?: string; dateBasis?: string } = {}) {
    this.assertCostRead(user);
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, standardCost: true, category: true },
      orderBy: { sku: 'asc' },
    });
    const pricedItems = items.filter((item) => positiveUnitCost(item.standardCost) != null);
    const unpriced = items.filter((item) => positiveUnitCost(item.standardCost) == null);
    const catalog = coverageSummary(items.length, pricedItems.length);

    const where = costOrdersWhere({ ...query, dateBasis: query.dateBasis ?? 'delivered' });
    const orders = await this.prisma.salesOrder.findMany({
      where,
      take: 500,
      include: {
        customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          select: {
            id: true,
            description: true,
            quantity: true,
            lineTotal: true,
            manufacturingComplexity: true,
            variantLabel: true,
              product: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true } },
            productionOrders: { where: { archivedAt: null, originType: 'SALES_ORDER' }, select: { id: true } },
          },
        },
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
        },
        returns: { select: { id: true } },
        productionOrders: {
          where: { archivedAt: null, originType: 'SALES_ORDER' },
          select: {
            id: true,
            salesOrderLineId: true,
            quantity: true,
            actualStartDate: true,
            actualCompletionDate: true,
            plannedMaterialCost: true,
            plannedCostFrozenAt: true,
            tasks: {
              select: {
                id: true,
                actualMinutes: true,
                isRework: true,
                assignedEmployeeId: true,
                stageDefinitionId: true,
              },
            },
          },
        },
      },
    });
    const rows = await this.assembleOrderRows(orders);
    const fully = rows.filter((row) => row.complete).length;
    const partial = rows.filter((row) => row.coverage === 'PARTIAL').length;
    const laborTimeKnown = rows.filter((row) => row.laborTimeKnown).length;
    const laborPriced = rows.filter((row) => row.laborCostPriced).length;
    const fabricTracked = rows.filter(
      (row) => row.fabric != null || row.fabricCoverage === 'PARTIAL' || row.fabricCoverage === 'UNPRICED' || row.fabricCoverage === 'FINAL',
    ).length;
    const fabricFinal = rows.filter((row) => row.fabricCoverage === 'FINAL').length;
    const unlinked = orders.flatMap((order) =>
      order.lines.filter((line) => Number(line.quantity) > 0 && !line.productionOrders.length).map((line) => ({
        id: line.id,
        orderId: order.id,
        number: order.number,
        description: line.description,
      })),
    );
    const unpricedIssueOrders = rows.filter((row) => row.coverage === 'UNPRICED').length;

    return {
      ...catalog,
      valuationCoveragePct: catalog.coveragePct,
      ordersFullyCostedPct: rows.length ? Math.round((fully / rows.length) * 1000) / 10 : 0,
      orderCount: rows.length,
      fullyCostedOrders: fully,
      partiallyCostedOrders: partial,
      materialCoveragePct: avgPct(rows.map((row) => row.coveragePct)),
      fabricCoveragePct: coverageRatio(fabricFinal, fabricTracked),
      laborTimeCoveragePct: coverageRatio(laborTimeKnown, rows.length),
      laborPriceCoveragePct: coverageRatio(laborPriced, laborTimeKnown),
      laborTimeKnownOrders: laborTimeKnown,
      laborCostPricedOrders: laborPriced,
      unpriced: unpriced.map((item) => ({
        id: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        nameHe: item.nameHe,
        category: item.category,
      })),
      unlinkedLines: unlinked.length,
      unlinkedLineSamples: unlinked.slice(0, 25),
      affected: {
        incomplete_orders: Math.max(0, rows.length - fully),
        partial,
        labor_time: Math.max(0, rows.length - laborTimeKnown),
        labor_price: Math.max(0, laborTimeKnown - laborPriced),
        fabric: Math.max(0, fabricTracked - fabricFinal),
        inventory_valuation: unpriced.length,
        unpriced_skus: unpriced.length,
        unpriced_issues: unpricedIssueOrders,
        unlinked_lines: unlinked.length,
      },
    };
  }

  async moneyDesk(query: {
    user?: AuthUser;
    from?: string;
    to?: string;
    dateBasis?: string;
    customerId?: string;
    productId?: string;
    status?: string;
    coverage?: string;
  }) {
    this.assertCostRead(query.user);
    const where = costOrdersWhere({ ...query, dateBasis: query.dateBasis ?? 'delivered' });
    const orders = await this.prisma.salesOrder.findMany({
      where,
      take: 500,
      include: {
        customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          select: {
            id: true,
            description: true,
            quantity: true,
            lineTotal: true,
            manufacturingComplexity: true,
            variantLabel: true,
              product: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true } },
          },
        },
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
        },
        returns: { select: { id: true } },
        productionOrders: {
          where: { archivedAt: null, originType: 'SALES_ORDER' },
          select: {
            id: true,
            salesOrderLineId: true,
            quantity: true,
            actualStartDate: true,
            actualCompletionDate: true,
            plannedMaterialCost: true,
            plannedCostFrozenAt: true,
            tasks: {
              select: {
                id: true,
                actualMinutes: true,
                isRework: true,
                assignedEmployeeId: true,
                stageDefinitionId: true,
              },
            },
          },
        },
      },
    });
    const rows = await this.assembleOrderRows(orders);
    const filtered = rows.filter((row) => {
      if (query.coverage === 'full' && !row.complete) return false;
      if (query.coverage === 'partial' && row.coverage !== 'PARTIAL') return false;
      if (query.coverage === 'unpriced' && row.coverage !== 'UNPRICED') return false;
      return true;
    });
    const saleValue = sumNullable(filtered.map((row) => row.saleValue));
    const actual = sumNullable(filtered.map((row) => row.actualCost));
    const completeAll = filtered.length > 0 && filtered.every((row) => row.complete);
    const margin = marginFrom(saleValue, actual, completeAll);
    const mix = {
      materials: sumNullable(filtered.map((row) => row.materials)),
      fabric: sumNullable(filtered.map((row) => row.fabric)),
      labor: sumNullable(filtered.map((row) => row.labor)),
      waste: sumNullable(filtered.map((row) => row.waste)),
      rework: sumNullable(filtered.map((row) => row.rework)),
    };
    const range = query.from || query.to ? { from: query.from, to: query.to } : {};
    const activity = await this.factoryActivity({ ...range, user: query.user });
    const inventory = await this.inventorySummary(query.user);
    const afterSaleCost = await this.afterSaleCostInRange(query.from, query.to);
    return {
      dateBasis: parseDateBasis(query.dateBasis),
      orderPerformance: {
        orderCount: filtered.length,
        empty: filtered.length === 0,
        saleValue,
        actualProductionCost: actual,
        grossMargin: margin.grossMargin,
        marginPct: margin.marginPct,
        marginIncomplete: margin.incomplete,
        complete: completeAll,
        coveragePct: avgPct(filtered.map((row) => row.coveragePct)),
        invoiced: sumNullable(filtered.map((row) => row.invoiced)),
        collected: sumNullable(filtered.map((row) => row.collected)),
        outstanding: sumNullable(filtered.map((row) => row.outstanding)),
      },
      costMix: mix,
      factoryActivity: activity,
      afterSaleCost,
      purchaseInflow: activity.receipts,
      inventoryValue: inventory.total,
      inventoryCoveragePct: inventory.coveragePct,
      inventoryLabel: 'CURRENT_INVENTORY_VALUE',
      attention: {
        negativeMargin: filtered.filter((row) => row.grossMargin != null && row.grossMargin < 0).length,
        partiallyCosted: filtered.filter((row) => row.coverage === 'PARTIAL').length,
        laborRateMissing: filtered.filter((row) => row.laborTimeKnown && !row.laborCostPriced).length,
        hasReturn: filtered.filter((row) => row.hasReturn).length,
      },
    };
  }

  private async afterSaleCostInRange(from?: string, to?: string) {
    const range = dateRange(from, to);
    const pos = await this.prisma.productionOrder.findMany({
      where: {
        archivedAt: null,
        originType: { in: ['RETURN_WORK', 'REPLACEMENT', 'RETURN_RECOVERY'] },
        ...(range ? { createdAt: range } : {}),
      },
      select: { id: true },
    });
    const ids = pos.map((po) => po.id);
    if (!ids.length) return null;
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: {
        type: { in: ISSUE_TYPES },
        OR: [{ productionOrderId: { in: ids } }, { referenceType: 'ProductionOrder', referenceId: { in: ids } }],
      },
      select: { type: true, quantity: true, unitCost: true },
    });
    return actualMaterialFromTransactions(txs).actualCost;
  }

  async factoryActivity(query: { from?: string; to?: string; user?: AuthUser }) {
    const range = dateRange(query.from, query.to);
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: {
        type: { in: ACTIVITY_TX_TYPES },
        ...(range ? { createdAt: range } : {}),
      },
      select: { type: true, quantity: true, unitCost: true },
    });
    const flow = emptyFlowMoney();
    for (const tx of txs) addFlowMoney(flow, String(tx.type), tx.quantity, tx.unitCost);
    const labor = await this.listLaborActuals({ from: query.from, to: query.to, user: query.user });
    return {
      productionCostIncurred: consumptionFromFlow(flow),
      receipts: flow.receipt,
      issues: flow.productionIssue,
      unusedReturns: flow.productionReturn,
      wipOutput: flow.wipOutput,
      finishedOutput: flow.finishedOutput,
      scrap: flow.scrap,
      workerHours: (labor.byWorker ?? []).reduce((sum, row) => sum + (row.minutes || 0), 0) / 60,
      laborCost: labor.labor?.actual ?? null,
      flow,
    };
  }

  async inventorySummary(user?: AuthUser) {
    this.assertCostRead(user);
    const balances = await this.prisma.inventoryBalance.findMany({
      include: {
        inventoryItem: { select: { category: true, materialGroup: true, itemClass: true, standardCost: true } },
        warehouse: { select: { id: true, code: true, type: true } },
      },
    });
    const rows = balances.map((b) => ({
      qty: b.availableQty,
      unitCost: b.inventoryItem.standardCost,
      itemClass: b.inventoryItem.itemClass,
      group: rawGroupFromCategory(b.inventoryItem.category, b.inventoryItem.materialGroup),
      warehouseType: b.warehouse.type,
    }));
    const total = currentInventoryValue(rows);
    const byClass = {
      RAW_MATERIAL: currentInventoryValue(rows.filter((r) => String(r.itemClass) === 'RAW_MATERIAL')),
      SEMI_FINISHED_GOOD: currentInventoryValue(rows.filter((r) => String(r.itemClass) === 'SEMI_FINISHED_GOOD')),
      FINISHED_GOOD: currentInventoryValue(rows.filter((r) => String(r.itemClass) === 'FINISHED_GOOD')),
    };
    const rawGroups = ['FABRIC', 'WOOD', 'FOAM', 'ACCESSORIES'].map((group) => ({
      group,
      ...currentInventoryValue(rows.filter((r) => r.group === group && String(r.itemClass) === 'RAW_MATERIAL')),
    }));
    return {
      label: 'CURRENT_INVENTORY_VALUE',
      total: total.value,
      coveragePct: total.coveragePct,
      byClass,
      rawGroups,
    };
  }

  async inventoryFlow(query: { user?: AuthUser; from?: string; to?: string }) {
    this.assertCostRead(query.user);
    return this.factoryActivity(query);
  }

  async inventoryItems(query: {
    user?: AuthUser;
    q?: string;
    lifecycle?: string;
    warehouseId?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const term = query.q?.trim();
    const where = {
      archivedAt: null,
      ...(query.lifecycle === 'RAW' ? { itemClass: 'RAW_MATERIAL' as const } : {}),
      ...(query.lifecycle === 'SEMI' ? { itemClass: 'SEMI_FINISHED_GOOD' as const } : {}),
      ...(query.lifecycle === 'FIN' ? { itemClass: 'FINISHED_GOOD' as const } : {}),
      ...(query.warehouseId
        ? { balances: { some: { warehouseId: query.warehouseId } } }
        : {}),
      ...(term
        ? {
            OR: [
              { sku: { contains: term, mode: 'insensitive' as const } },
              { nameEn: { contains: term, mode: 'insensitive' as const } },
              { nameAr: { contains: term, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { balances: { include: { warehouse: { select: { id: true, code: true } } } } },
        orderBy: { sku: 'asc' },
      }),
    ]);
    const data = items.map((item) => {
      const qty = item.balances.reduce((sum, b) => sum + Number(b.availableQty), 0);
      const valued = currentInventoryValue([{ qty, unitCost: item.standardCost }]);
      return {
        id: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        nameHe: item.nameHe,
        itemClass: item.itemClass,
        group: rawGroupFromCategory(item.category, item.materialGroup),
        qty,
        value: valued.value,
        coveragePct: valued.coveragePct,
      };
    });
    const sorted = [...data].sort((a, b) => {
      if (query.sort === 'highestValue') return (b.value ?? -1) - (a.value ?? -1);
      return 0;
    });
    return { data: sorted, meta: paginatedMeta(page, pageSize, total), label: 'CURRENT_INVENTORY_VALUE' };
  }

  async inventoryItemDetail(
    id: string,
    query: { user?: AuthUser; from?: string; to?: string; page?: number; pageSize?: number },
  ) {
    this.assertCostRead(query.user);
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
      include: { balances: { include: { warehouse: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    const qty = item.balances.reduce((sum, b) => sum + Number(b.availableQty), 0);
    const valued = currentInventoryValue([{ qty, unitCost: item.standardCost }]);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const range = dateRange(query.from, query.to);
    const where = { inventoryItemId: id, ...(range ? { createdAt: range } : {}) };
    const [total, txs] = await Promise.all([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { warehouse: { select: { code: true } } },
      }),
    ]);
    const flow = emptyFlowMoney();
    const periodTxs = await this.prisma.inventoryTransaction.findMany({
      where,
      select: { type: true, quantity: true, unitCost: true },
    });
    for (const tx of periodTxs) addFlowMoney(flow, String(tx.type), tx.quantity, tx.unitCost);
    return {
      id: item.id,
      sku: item.sku,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      group: rawGroupFromCategory(item.category, item.materialGroup),
      qty,
      value: valued.value,
      costBasis: positiveUnitCost(item.standardCost),
      label: 'CURRENT_INVENTORY_VALUE',
      flow,
      consumption: consumptionFromFlow(flow),
      ledger: txs.map((tx) => ({
        id: tx.id,
        number: tx.number,
        date: tx.createdAt,
        type: tx.type,
        flow: classifyInventoryFlow(String(tx.type)),
        qty: Math.abs(Number(tx.quantity)),
        unitCost: positiveUnitCost(tx.unitCost),
        value:
          positiveUnitCost(tx.unitCost) != null
            ? Number((Math.abs(Number(tx.quantity)) * Number(positiveUnitCost(tx.unitCost))).toFixed(3))
            : null,
        warehouse: tx.warehouse?.code ?? null,
        productionOrderId: tx.productionOrderId,
        salesOrderId: tx.salesOrderId,
      })),
      meta: paginatedMeta(page, pageSize, total),
    };
  }

  async coverageIssues(query: {
    user?: AuthUser;
    type?: string;
    from?: string;
    to?: string;
    dateBasis?: string;
    page?: number;
    pageSize?: number;
  }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const coverage = await this.costCoverage(query.user, query);
    const type = query.type || 'incomplete_orders';
    let records: Array<Record<string, unknown>> = [];
    if (type === 'unpriced_skus' || type === 'inventory_valuation') {
      records = coverage.unpriced;
    } else if (type === 'unlinked_lines') {
      records = coverage.unlinkedLineSamples;
    } else if (type === 'unattributed_txs') {
      const range = dateRange(query.from, query.to);
      records =
        typeof this.prisma.inventoryTransaction?.findMany === 'function'
          ? await this.prisma.inventoryTransaction.findMany({
              where: {
                type: { in: ISSUE_TYPES },
                productionOrderId: null,
                salesOrderId: null,
                ...(range ? { createdAt: range } : {}),
              },
              take: 200,
              select: {
                id: true,
                number: true,
                type: true,
                createdAt: true,
                inventoryItem: { select: { sku: true } },
              },
            }).then((rows) =>
              rows.map((tx) => ({
                id: tx.id,
                number: tx.number,
                sku: tx.inventoryItem?.sku,
                type: tx.type,
                description: tx.number,
              })),
            )
          : [];
    } else {
      const where = costOrdersWhere({ ...query, dateBasis: query.dateBasis ?? 'delivered' });
      const orders = await this.prisma.salesOrder.findMany({
        where,
        take: 500,
        include: {
          customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
          lines: {
            select: {
              id: true,
              description: true,
              quantity: true,
              lineTotal: true,
              manufacturingComplexity: true,
              variantLabel: true,
              product: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true } },
            },
          },
          invoices: {
            where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
            select: { subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
          },
          returns: { select: { id: true } },
          productionOrders: {
            where: { archivedAt: null, originType: 'SALES_ORDER' },
            select: {
              id: true,
              salesOrderLineId: true,
              quantity: true,
              actualStartDate: true,
              actualCompletionDate: true,
              plannedMaterialCost: true,
              plannedCostFrozenAt: true,
              tasks: {
                select: {
                  id: true,
                  actualMinutes: true,
                  isRework: true,
                  assignedEmployeeId: true,
                  stageDefinitionId: true,
                },
              },
            },
          },
        },
      });
      const rows = await this.assembleOrderRows(orders);
      if (type === 'labor_price') records = rows.filter((row) => row.laborTimeKnown && !row.laborCostPriced);
      else if (type === 'labor_time') records = rows.filter((row) => !row.laborTimeKnown);
      else if (type === 'partial') records = rows.filter((row) => row.coverage === 'PARTIAL');
      else if (type === 'unpriced_issues') records = rows.filter((row) => row.coverage === 'UNPRICED');
      else if (type === 'fabric') records = rows.filter((row) => row.fabricCoverage && row.fabricCoverage !== 'FINAL');
      else records = rows.filter((row) => !row.complete);
    }
    return {
      type,
      total: records.length,
      data: records.slice((page - 1) * pageSize, page * pageSize),
      meta: paginatedMeta(page, pageSize, records.length),
    };
  }

  async productProfile(productId: string, query: { user?: AuthUser; from?: string; to?: string; dateBasis?: string }) {
    this.assertCostRead(query.user);
    const analytics = await this.productAnalytics(query.user, { ...query, productId });
    const product = await this.prisma.product.findFirst({
      where: { id: productId },
      select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true, manufacturingCost: true },
    });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    return { product, plannedBaseline: positiveUnitCost(product.manufacturingCost), ...analytics };
  }

  async variantProfile(
    productId: string,
    variantId: string,
    query: { user?: AuthUser; from?: string; to?: string; dateBasis?: string },
  ) {
    this.assertCostRead(query.user);
    const analytics = await this.productAnalytics(query.user, { ...query, productId, variantId });
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
        manufacturingCost: true,
      },
    });
    if (!variant) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Variant not found.' });
    return {
      variant,
      plannedBaseline: positiveUnitCost(variant.manufacturingCost),
      ...analytics,
    };
  }

  async customWork(query: { user?: AuthUser; from?: string; to?: string; dateBasis?: string; page?: number; pageSize?: number }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where = {
      ...costOrdersWhere(query),
      lines: { some: { productId: null, manufacturingComplexity: 'CUSTOM' as const } },
    };
    const orders = await this.prisma.salesOrder.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          where: { productId: null },
          select: {
            id: true,
            description: true,
            quantity: true,
            lineTotal: true,
            manufacturingComplexity: true,
            variantLabel: true,
              product: { select: { sku: true, nameEn: true, nameAr: true, nameHe: true } },
          },
        },
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { subtotal: true, paidAmount: true, outstandingAmount: true, status: true },
        },
        returns: { select: { id: true } },
        productionOrders: {
          where: { archivedAt: null, originType: 'SALES_ORDER' },
          select: {
            id: true,
            salesOrderLineId: true,
            quantity: true,
            actualStartDate: true,
            actualCompletionDate: true,
            plannedMaterialCost: true,
            plannedCostFrozenAt: true,
            tasks: {
              select: {
                id: true,
                actualMinutes: true,
                isRework: true,
                assignedEmployeeId: true,
                stageDefinitionId: true,
              },
            },
          },
        },
      },
    });
    const data = await this.assembleOrderRows(orders);
    return { data, meta: paginatedMeta(page, pageSize, data.length) };
  }

  async backfillPricesFromReceipts(user?: AuthUser) {
    this.assertCostRead(user);
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      select: { id: true, sku: true, standardCost: true },
    });
    const unpricedIds = items
      .filter((item) => positiveUnitCost(item.standardCost) == null)
      .map((item) => item.id);
    if (!unpricedIds.length) {
      return { priced: [], stillUnpriced: [], updated: 0 };
    }
    const [receipts, txs] = await Promise.all([
      this.prisma.goodsReceiptLine.findMany({
        where: { inventoryItemId: { in: unpricedIds }, unitCost: { gt: 0 } },
        select: { inventoryItemId: true, unitCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItemId: { in: unpricedIds },
          type: InventoryTxType.PURCHASE_RECEIPT,
          unitCost: { gt: 0 },
        },
        orderBy: { createdAt: 'desc' },
        select: { inventoryItemId: true, unitCost: true },
      }),
    ]);
    const prices = receiptPriceByItem([...receipts, ...txs]);
    const { priced, stillUnpriced } = applyReceiptPrices(items, prices);
    for (const row of priced) {
      await this.prisma.inventoryItem.update({
        where: { id: row.id },
        data: { standardCost: row.standardCost },
      });
    }
    return { priced, stillUnpriced, updated: priced.length };
  }

  async backfillTransactionLinks() {
    const rows = await this.prisma.inventoryTransaction.findMany({
      where: {
        OR: [{ productionOrderId: null }, { productionTaskId: null }, { salesOrderId: null }],
        referenceType: { in: ['ProductionOrder', 'ProductionTask', 'SalesOrder'] },
      },
      select: { id: true, referenceType: true, referenceId: true },
    });
    let updated = 0;
    for (const row of rows) {
      if (!row.referenceId) continue;
      if (row.referenceType === 'ProductionTask') {
        const task = await this.prisma.productionTask.findUnique({
          where: { id: row.referenceId },
          select: { id: true, productionOrderId: true, productionOrder: { select: { salesOrderId: true } } },
        });
        if (!task) continue;
        await this.prisma.inventoryTransaction.update({
          where: { id: row.id },
          data: {
            productionTaskId: task.id,
            productionOrderId: task.productionOrderId,
            salesOrderId: task.productionOrder?.salesOrderId,
          },
        });
        updated += 1;
      } else if (row.referenceType === 'ProductionOrder') {
        const po = await this.prisma.productionOrder.findUnique({
          where: { id: row.referenceId },
          select: { id: true, salesOrderId: true },
        });
        if (!po) continue;
        await this.prisma.inventoryTransaction.update({
          where: { id: row.id },
          data: { productionOrderId: po.id, salesOrderId: po.salesOrderId },
        });
        updated += 1;
      } else if (row.referenceType === 'SalesOrder') {
        await this.prisma.inventoryTransaction.update({
          where: { id: row.id },
          data: { salesOrderId: row.referenceId },
        });
        updated += 1;
      }
    }
    return { updated };
  }

  async backfillPlannedSnapshots() {
    const orders = await this.prisma.salesOrder.findMany({
      where: { plannedCostFrozenAt: null, manufacturingCost: { not: null }, productionOrders: { some: {} } },
      select: { id: true },
    });
    let updated = 0;
    for (const order of orders) {
      await this.prisma.$transaction((tx) => freezePlannedCostAtRelease(tx, order.id));
      updated += 1;
    }
    return { updated };
  }

  async backfillTimeEntries() {
    const tasks = await this.prisma.productionTask.findMany({
      where: {
        actualMinutes: { gt: 0 },
        assignedEmployeeId: { not: null },
        timeEntries: { none: {} },
      },
      select: {
        id: true,
        actualMinutes: true,
        actualStart: true,
        actualCompletion: true,
        assignedEmployeeId: true,
      },
    });
    let created = 0;
    for (const task of tasks) {
      if (!task.assignedEmployeeId) continue;
      const result = await this.prisma.$transaction((tx) =>
        ensureTaskTimeEntry(tx, {
          taskId: task.id,
          userId: task.assignedEmployeeId!,
          actualMinutes: task.actualMinutes,
          actualStart: task.actualStart,
          actualCompletion: task.actualCompletion,
        }),
      );
      if (result.created) created += 1;
    }
    return { created };
  }

  async listLaborRates(user?: AuthUser) {
    this.assertCostRead(user);
    return this.prisma.laborRate.findMany({
      orderBy: [{ effectiveFrom: 'desc' }],
      include: {
        stageDefinition: { select: { id: true, code: true, nameEn: true, nameAr: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createLaborRate(
    body: {
      stageDefinitionId?: string;
      userId?: string;
      hourlyRate: number;
      effectiveFrom: string;
      effectiveTo?: string;
    },
    user?: AuthUser,
  ) {
    this.assertCostRead(user);
    const hourlyRate = positiveUnitCost(body.hourlyRate);
    if (hourlyRate == null) {
      throw new NotFoundException({ code: 'VALIDATION_ERROR', message: 'Hourly rate must be greater than zero.' });
    }
    return this.prisma.laborRate.create({
      data: {
        stageDefinitionId: body.stageDefinitionId || null,
        userId: body.userId || null,
        hourlyRate,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        createdById: user?.id,
      },
    });
  }

  private async laborForTasks(
    tasks: Array<{
      id?: string;
      actualMinutes: number | null;
      assignedEmployeeId: string | null;
      stageDefinitionId: string | null;
      stageCode?: string | null;
      stageDefinition?: { code?: string | null } | null;
      isRework?: boolean;
    }>,
  ) {
    const rates =
      typeof this.prisma.laborRate?.findMany === 'function' ? await this.prisma.laborRate.findMany() : [];
    const taskIds = tasks.map((task) => task.id).filter((id): id is string => Boolean(id));
    const entries =
      taskIds.length && typeof this.prisma.taskTimeEntry?.findMany === 'function'
        ? await this.prisma.taskTimeEntry.findMany({
            where: { taskId: { in: taskIds } },
            select: { id: true, taskId: true, userId: true, minutes: true, startedAt: true, endedAt: true },
          })
        : [];
    const refs = tasks
      .filter((task) => task.id)
      .map((task) => ({
        id: task.id!,
        stageDefinitionId: task.stageDefinitionId,
        stageCode: task.stageCode ?? task.stageDefinition?.code ?? null,
        isRework: task.isRework,
      }));
    const summary = summarizeLaborEntries({ rates, tasks: refs, entries });
    const block = rates.length ? rollupLaborCost({ rates, tasks: refs, entries }) : null;
    const userIds = [...new Set(entries.map((entry) => entry.userId).filter(Boolean))];
    const users =
      userIds.length && typeof this.prisma.user?.findMany === 'function'
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const nameById = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]));
    return {
      enabled: rates.length > 0,
      total: summary.actual,
      pricedMinutes: summary.pricedMinutes,
      unpricedMinutes: summary.unpricedMinutes,
      timedMinutes: summary.timedMinutes,
      reworkActual: summary.reworkActual,
      reworkMinutes: summary.reworkMinutes,
      note:
        summary.timedMinutes > 0 && summary.actual == null
          ? 'Labor time known, cost not priced.'
          : rates.length
            ? null
            : 'Labor money is hidden until a rate model exists.',
      byWorker: (block?.byWorker ?? []).map((row) => ({
        ...row,
        name: nameById.get(row.userId) || row.userId,
      })),
      byStage: block?.byStage ?? [],
    };
  }

  async listLaborActuals(
    query: { from?: string; to?: string; user?: AuthUser },
  ) {
    this.assertCostRead(query.user);
    if (
      typeof this.prisma.taskTimeEntry?.findMany !== 'function' ||
      typeof this.prisma.laborRate?.findMany !== 'function'
    ) {
      return { labor: null, byWorker: [], byStage: [] };
    }
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const entries = await this.prisma.taskTimeEntry.findMany({
      where: {
        ...(from || to
          ? {
              startedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      select: {
        taskId: true,
        userId: true,
        minutes: true,
        startedAt: true,
        endedAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        task: {
          select: {
            id: true,
            stageDefinitionId: true,
            stageDefinition: { select: { code: true, nameEn: true, nameAr: true } },
          },
        },
      },
    });
    const rates = await this.prisma.laborRate.findMany();
    const usable = entries.filter((entry) => entry.task?.id);
    const block = rollupLaborCost({
      rates,
      tasks: usable.map((entry) => ({
        id: entry.task.id,
        stageDefinitionId: entry.task.stageDefinitionId,
        stageCode: entry.task.stageDefinition?.code ?? null,
      })),
      entries: usable,
    });
    return {
      labor: block,
      byWorker: (block?.byWorker ?? []).map((row) => {
        const entry = entries.find((item) => item.userId === row.userId);
        const name = entry?.user
          ? `${entry.user.firstName} ${entry.user.lastName}`.trim()
          : row.userId;
        return { ...row, name };
      }),
      byStage: block?.byStage ?? [],
    };
  }

  private async returnRow(returnId: string, detailed = false) {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id: returnId },
      include: {
        salesOrder: { select: { id: true, number: true } },
        customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
        pieces: {
          include: {
            linkedOrders: {
              select: {
                id: true,
                originType: true,
                tasks: { select: { actualMinutes: true, isRework: true } },
              },
            },
            productionOrder: {
              select: {
                id: true,
                originType: true,
                tasks: { select: { actualMinutes: true, isRework: true } },
              },
            },
            recoveryOrder: {
              select: {
                id: true,
                originType: true,
                tasks: { select: { actualMinutes: true, isRework: true } },
              },
            },
            recoveryLines: {
              select: { outcome: true, quantity: true, unitCost: true, postedAt: true },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });

    const poIds = row.pieces.flatMap((piece) =>
      uniqueIds([
        ...piece.linkedOrders.map((po) => po.id),
        piece.productionOrder?.id,
        piece.recoveryOrder?.id,
      ]),
    );
    const txs = poIds.length
      ? await this.prisma.inventoryTransaction.findMany({
          where: {
            type: { in: ISSUE_TYPES },
            OR: [{ productionOrderId: { in: poIds } }, { referenceType: 'ProductionOrder', referenceId: { in: poIds } }],
          },
          select: {
            type: true,
            quantity: true,
            unitCost: true,
            productionOrderId: true,
            referenceType: true,
            referenceId: true,
          },
        })
      : [];
    const byPo = new Map<string, typeof txs>();
    for (const tx of txs) {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      if (!poId) continue;
      const list = byPo.get(poId) ?? [];
      list.push(tx);
      byPo.set(poId, list);
    }

    const pieces = row.pieces.map((piece) => {
      const buckets = { repair: 0, replacement: 0, recovery: 0, other: 0 };
      let effort = 0;
      const pieceOrders = uniqueById([
        ...piece.linkedOrders,
        piece.productionOrder,
        piece.recoveryOrder,
      ]);
      for (const po of pieceOrders) {
        const ledger = actualMaterialFromTransactions(byPo.get(po.id) ?? []);
        const bucket = originBucket(po.originType);
        if (ledger.actualCost != null) buckets[bucket] += ledger.actualCost;
        effort += po.tasks.reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0);
      }
      const recovery = recoveryOutcomeValue(piece.recoveryLines);
      const workCost = buckets.repair + buckets.replacement + buckets.recovery + buckets.other;
      return {
        id: piece.id,
        repairCost: buckets.repair || null,
        replacementCost: buckets.replacement || null,
        recoveryCost: buckets.recovery || null,
        workCost: workCost || null,
        workerEffortMinutes: effort,
        ...recovery,
      };
    });

    const repairCost = sumNullable(pieces.map((p) => p.repairCost));
    const replacementCost = sumNullable(pieces.map((p) => p.replacementCost));
    const recoveryCost = sumNullable(pieces.map((p) => p.recoveryCost));
    const workCost = sumNullable(pieces.map((p) => p.workCost));
    const recoveredValue = sumNullable(pieces.map((p) => p.recoveredValue));
    const disposedValue = sumNullable(pieces.map((p) => p.disposedValue));
    let originalProductionCost: number | null = null;
    if (row.salesOrder?.id && typeof this.prisma.productionOrder?.findMany === 'function') {
      const originalPos = await this.prisma.productionOrder.findMany({
        where: { salesOrderId: row.salesOrder.id, archivedAt: null, originType: 'SALES_ORDER' },
        select: { id: true },
      });
      const originalIds = originalPos.map((po) => po.id);
      if (originalIds.length) {
        const originalTxs = await this.prisma.inventoryTransaction.findMany({
          where: {
            type: { in: ISSUE_TYPES },
            OR: [
              { productionOrderId: { in: originalIds } },
              { referenceType: 'ProductionOrder', referenceId: { in: originalIds } },
            ],
          },
          select: { type: true, quantity: true, unitCost: true },
        });
        originalProductionCost = actualMaterialFromTransactions(originalTxs).actualCost;
      }
    }

    return {
      id: row.id,
      number: row.number,
      status: row.lifecycleState,
      createdAt: row.createdAt,
      salesOrder: row.salesOrder,
      dealer: row.customer,
      variantId: row.variantId ?? null,
      pieceCount: row.pieces.length,
      originalProductionCost,
      repairCost,
      replacementCost,
      recoveryCost,
      returnGrossCost: workCost,
      lifetimeFactoryCost: lifetimeCost(originalProductionCost, workCost),
      recoveredValue,
      disposedValue,
      recoveredQty: pieces.reduce((sum, p) => sum + p.recoveredQty, 0),
      disposedQty: pieces.reduce((sum, p) => sum + p.disposedQty, 0),
      workerEffortMinutes: pieces.reduce((sum, p) => sum + p.workerEffortMinutes, 0),
      pieces: detailed ? pieces : undefined,
    };
  }

  private async returnLifetime(
    salesOrderId: string,
    returnPos: Array<{ id: string }>,
    txs: Array<{
      type: InventoryTxType;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal | null;
      productionOrderId: string | null;
      referenceType: string | null;
      referenceId: string | null;
    }>,
    originalProductionCost: number | null,
  ) {
    const returnIds = new Set(returnPos.map((po) => po.id));
    const returnTxs = txs.filter((tx) => {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      return poId != null && returnIds.has(poId);
    });
    const afterSale = actualMaterialFromTransactions(returnTxs);
    const recoveries = await this.prisma.returnRecoveryLine.findMany({
      where: { returnPiece: { salesOrderId }, postedAt: { not: null } },
      select: { outcome: true, quantity: true, unitCost: true, postedAt: true },
    });
    const outcomes = recoveryOutcomeValue(recoveries);
    return {
      originalProductionCost,
      afterSaleReturnCost: afterSale.actualCost,
      lifetimeCost: lifetimeCost(originalProductionCost, afterSale.actualCost),
      recoveredValue: outcomes.recoveredValue,
      disposedValue: outcomes.disposedValue,
      recoveredQty: outcomes.recoveredQty,
      disposedQty: outcomes.disposedQty,
      netted: false,
    };
  }
}

function earliest(dates: Array<Date | null | undefined>) {
  const present = dates.filter((d): d is Date => Boolean(d));
  if (!present.length) return null;
  return present.reduce((min, d) => (d < min ? d : min));
}

function latest(dates: Array<Date | null | undefined>) {
  const present = dates.filter((d): d is Date => Boolean(d));
  if (!present.length) return null;
  return present.reduce((max, d) => (d > max ? d : max));
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((n): n is number => n != null);
  if (!present.length) return null;
  return present.reduce((sum, n) => sum + n, 0);
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function uniqueById<T extends { id: string }>(rows: Array<T | null | undefined>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function avgPct(values: Array<number | null | undefined>): number | null {
  const present = values.filter((n): n is number => n != null && Number.isFinite(n));
  if (!present.length) return null;
  return Number((present.reduce((sum, n) => sum + n, 0) / present.length).toFixed(1));
}

function coverageRatio(costed: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Math.round((costed / total) * 1000) / 10;
}

function sortCostOrders<T extends {
  actualCost: number | null;
  grossMargin: number | null;
  workerEffortMinutes: number;
  saleValue: number | null;
  orderDate: Date;
}>(rows: T[], sort?: string): T[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === 'highestCost') return (b.actualCost ?? -Infinity) - (a.actualCost ?? -Infinity);
    if (sort === 'lowestMargin') return (a.grossMargin ?? Infinity) - (b.grossMargin ?? Infinity);
    if (sort === 'highestMargin') return (b.grossMargin ?? -Infinity) - (a.grossMargin ?? -Infinity);
    if (sort === 'longestTime') return (b.workerEffortMinutes ?? 0) - (a.workerEffortMinutes ?? 0);
    if (sort === 'largestSale') return (b.saleValue ?? -Infinity) - (a.saleValue ?? -Infinity);
    return b.orderDate.getTime() - a.orderDate.getTime();
  });
  return copy;
}
