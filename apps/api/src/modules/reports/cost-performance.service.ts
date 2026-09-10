import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTxType, Prisma } from '@maher/database';
import { can } from '@maher/permissions';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { applyReceiptPrices, coverageSummary, receiptPriceByItem } from '../inventory/cost-coverage';
import { laborMoneyFromMinutes, resolveHourlyRate } from '../tasks/labor-rate';
import { ensureTaskTimeEntry } from '../tasks/ensure-time-entry';
import { freezePlannedCostAtRelease } from '../production/planned-cost-snapshot';
import {
  actualMaterialFromTransactions,
  averagePerUnit,
  marginFrom,
  saleValueFromSubtotals,
  skuLedgerFromTransactions,
} from './order-cost-ledger';
import { aggregateFactoryTime } from './order-time';
import { deriveProductStats } from './product-cost-analytics';
import {
  lifetimeCost,
  originBucket,
  recoveryOutcomeValue,
} from './return-cost-rollup';

const ISSUE_TYPES: InventoryTxType[] = [
  InventoryTxType.PRODUCTION_ISSUE,
  InventoryTxType.PRODUCTION_RETURN,
];

@Injectable()
export class CostPerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  private assertCostRead(user?: AuthUser) {
    if (user?.customerId || !can(user, 'inventory.cost.read')) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found.' });
    }
  }

  async listOrders(query: {
    from?: string;
    to?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    user?: AuthUser;
  }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where: Prisma.SalesOrderWhereInput = {
      archivedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.from || query.to
        ? {
            orderDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { nameEn: true, nameAr: true, nameHe: true } },
          lines: {
            select: {
              id: true,
              description: true,
              quantity: true,
              product: { select: { sku: true, nameEn: true, nameAr: true } },
            },
          },
          invoices: {
            where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
            select: { subtotal: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          productionOrders: {
            where: { archivedAt: null, originType: 'SALES_ORDER' },
            select: {
              id: true,
              quantity: true,
              actualStartDate: true,
              actualCompletionDate: true,
              plannedMaterialCost: true,
              plannedCostFrozenAt: true,
              tasks: { select: { actualMinutes: true, isRework: true } },
            },
          },
        },
      }),
    ]);

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
            referenceType: true,
            referenceId: true,
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

    const data = orders.map((order) => {
      const orderTxs = order.productionOrders.flatMap((po) => txsByPo.get(po.id) ?? []);
      const ledger = actualMaterialFromTransactions(orderTxs);
      const time = aggregateFactoryTime(
        order.productionOrders.flatMap((po) => po.tasks),
        {
          start: earliest(order.productionOrders.map((po) => po.actualStartDate)),
          end: latest(order.productionOrders.map((po) => po.actualCompletionDate)),
        },
      );
      const saleValue = saleValueFromSubtotals(order.invoices[0]?.subtotal, order.subtotal);
      const planned = order.plannedCostFrozenAt
        ? positiveUnitCost(order.manufacturingCost)
        : order.productionOrders.some((po) => po.plannedCostFrozenAt)
          ? order.productionOrders.reduce((sum, po) => sum + (positiveUnitCost(po.plannedMaterialCost) ?? 0), 0) || null
          : positiveUnitCost(order.manufacturingCost);
      const { grossMargin, marginPct } = marginFrom(saleValue, ledger.actualCost);
      const qty = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
      return {
        id: order.id,
        number: order.number,
        status: order.status,
        orderDate: order.orderDate,
        dealer: order.customer,
        productSummary: order.lines
          .map((line) => line.product?.sku || line.description)
          .filter(Boolean)
          .slice(0, 3)
          .join(' · '),
        quantity: qty,
        actualCost: ledger.actualCost,
        averageCostPerUnit: averagePerUnit(ledger.actualCost, qty),
        saleValue,
        plannedCost: planned,
        grossMargin,
        marginPct,
        coverage: ledger.coverage,
        workerEffortMinutes: time.workerEffortMinutes,
        wallClockMinutes: time.wallClockMinutes,
      };
    });

    return { data, meta: paginatedMeta(page, pageSize, total) };
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
            product: { select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true } },
            productionOrders: {
              where: { archivedAt: null },
              select: { id: true, originType: true, quantity: true, plannedMaterialCost: true, plannedCostFrozenAt: true },
            },
          },
        },
        invoices: {
          where: { archivedAt: null, status: { notIn: ['CANCELLED', 'VOID'] } },
          select: { id: true, number: true, subtotal: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
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
          include: { inventoryItem: { select: { sku: true, nameEn: true, nameAr: true, category: true } } },
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

    const saleValue = saleValueFromSubtotals(order.invoices[0]?.subtotal, order.subtotal);
    const planned = order.plannedCostFrozenAt ? positiveUnitCost(order.manufacturingCost) : null;
    const { grossMargin, marginPct } = marginFrom(saleValue, ledger.actualCost);

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

    const labor = await this.laborForTasks(
      originalPos.flatMap((po) => po.tasks),
    );

    const returnCost = await this.returnLifetime(order.id, returnPos, txs);
    const qty = order.lines.reduce((sum, line) => sum + Number(line.quantity), 0);

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      orderDate: order.orderDate,
      dealer: order.customer,
      summary: {
        saleValue,
        actualProductionCost: ledger.actualCost,
        plannedCost: planned,
        plannedFrozenAt: order.plannedCostFrozenAt,
        grossMargin,
        marginPct,
        coverage: ledger.coverage,
        quantity: qty,
        averageCostPerUnit: averagePerUnit(ledger.actualCost, qty),
        perPieceTracked: false,
      },
      lines: order.lines.map((line) => {
        const linePoIds = new Set(line.productionOrders.filter((po) => po.originType === 'SALES_ORDER').map((po) => po.id));
        const lineTxs = originalTxs.filter((tx) => {
          const poId = tx.productionOrderId || tx.referenceId;
          return poId != null && linePoIds.has(poId);
        });
        const lineLedger = actualMaterialFromTransactions(lineTxs);
        const lineQty = Number(line.quantity);
        return {
          id: line.id,
          description: line.description,
          sku: line.product?.sku ?? null,
          quantity: lineQty,
          actualCost: lineLedger.actualCost,
          averageCostPerUnit: averagePerUnit(lineLedger.actualCost, lineQty),
          note:
            lineQty > 1
              ? 'Per-physical-piece cost is not tracked. Quantity, total, and average per unit only.'
              : null,
        };
      }),
      materials: {
        coverage: ledger.coverage,
        rows: materials,
        usage: usageEnrichment,
        scrapCost: scrapCost > 0 ? scrapCost : null,
        scrapAlreadyInTotal: true,
        reworkMaterialCost: reworkMaterial > 0 ? reworkMaterial : null,
      },
      time: {
        ...time,
        labor,
      },
      waste: {
        scrapCost: scrapCost > 0 ? scrapCost : null,
        alreadyIncludedInActual: true,
      },
      rework: {
        materialCost: reworkMaterial > 0 ? reworkMaterial : null,
        effortMinutes: time.reworkEffortMinutes,
      },
      lifetime: {
        ...returnCost,
        originalProductionCost: ledger.actualCost,
        lifetimeCost: lifetimeCost(ledger.actualCost, returnCost.afterSaleReturnCost),
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

  async listReturns(query: { user?: AuthUser; page?: number; pageSize?: number }) {
    this.assertCostRead(query.user);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const [total, rows] = await Promise.all([
      this.prisma.returnRequest.count(),
      this.prisma.returnRequest.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
    return { data, meta: paginatedMeta(page, pageSize, total) };
  }

  async returnDossier(returnId: string, user?: AuthUser) {
    this.assertCostRead(user);
    return this.returnRow(returnId, true);
  }

  async productAnalytics(user?: AuthUser) {
    this.assertCostRead(user);
    const orders = await this.prisma.salesOrder.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        lines: {
          select: {
            productId: true,
            productionOrders: {
              where: { archivedAt: null, originType: 'SALES_ORDER' },
              select: {
                id: true,
                tasks: { select: { actualMinutes: true } },
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
            referenceId: true,
            referenceType: true,
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

    const histories = orders.flatMap((order) =>
      order.lines
        .filter((line) => line.productId)
        .map((line) => {
          const lineTxs = line.productionOrders.flatMap((po) => byPo.get(po.id) ?? []);
          const ledger = actualMaterialFromTransactions(lineTxs);
          const minutes = line.productionOrders.reduce(
            (sum, po) => sum + po.tasks.reduce((s, t) => s + (t.actualMinutes ?? 0), 0),
            0,
          );
          return {
            productId: line.productId!,
            actualCost: ledger.actualCost,
            workerEffortMinutes: minutes,
          };
        }),
    );
    const stats = deriveProductStats(histories);
    const products = await this.prisma.product.findMany({
      where: { id: { in: stats.map((s) => s.productId) } },
      select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      derived: true,
      products: stats.map((row) => ({
        ...row,
        product: byId.get(row.productId) ?? null,
      })),
    };
  }

  async costCoverage(user?: AuthUser) {
    this.assertCostRead(user);
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      select: { id: true, sku: true, nameEn: true, nameAr: true, standardCost: true, category: true },
      orderBy: { sku: 'asc' },
    });
    const pricedItems = items.filter((item) => positiveUnitCost(item.standardCost) != null);
    const unpriced = items.filter((item) => positiveUnitCost(item.standardCost) == null);
    return {
      ...coverageSummary(items.length, pricedItems.length),
      unpriced: unpriced.map((item) => ({
        id: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        category: item.category,
      })),
    };
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
      actualMinutes: number | null;
      assignedEmployeeId: string | null;
      stageDefinitionId: string | null;
    }>,
  ) {
    const rates = await this.prisma.laborRate.findMany();
    if (!rates.length) {
      return { enabled: false, total: null as number | null, note: 'Labor money is hidden until a rate model exists.' };
    }
    const now = new Date();
    let total = 0;
    let any = false;
    for (const task of tasks) {
      const rate = resolveHourlyRate(rates, now, {
        stageDefinitionId: task.stageDefinitionId,
        userId: task.assignedEmployeeId,
      });
      const money = laborMoneyFromMinutes(task.actualMinutes ?? 0, rate);
      if (money != null) {
        total += money;
        any = true;
      }
    }
    return {
      enabled: true,
      total: any ? total : null,
      note: any ? null : 'No matching rate for the recorded time.',
    };
  }

  private async returnRow(returnId: string, detailed = false) {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id: returnId },
      include: {
        salesOrder: { select: { id: true, number: true } },
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

    return {
      id: row.id,
      number: row.number,
      status: row.lifecycleState,
      createdAt: row.createdAt,
      salesOrder: row.salesOrder,
      pieceCount: row.pieces.length,
      repairCost,
      replacementCost,
      recoveryCost,
      returnGrossCost: workCost,
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
      originalProductionCost: null as number | null,
      afterSaleReturnCost: afterSale.actualCost,
      lifetimeCost: lifetimeCost(null, afterSale.actualCost),
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
