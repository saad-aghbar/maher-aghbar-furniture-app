import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '@maher/types';
import { can } from '@maher/permissions';
import { PrismaService } from '../../common/prisma.service';
import {
  buildMaterialCostMap,
  type MaterialCostMap,
} from '../../common/helpers/order-costing.util';
import { roundMoney } from '../../common/helpers/money.util';
import { MANUFACTURING_INVENTORY_COST_BASIS } from './manufacturing-cost-basis';

function money(n: number): number {
  return Number(roundMoney(n));
}

export type ManufacturingCostStatus =
  | 'ESTIMATED_ONLY'
  | 'IN_PROGRESS'
  | 'FINAL'
  | 'INCOMPLETE';

export type ManufacturingCostSkuRow = {
  sku: string;
  displayName: string | null;
  category: string | null;
  plannedQty: number;
  issuedQty: number;
  returnedQty: number;
  scrapQty: number;
  costedQty: number;
  unitCost: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  varianceQty: number;
  varianceCost: number | null;
  costAvailable: boolean;
  origin: 'ORIGINAL' | 'REWORK' | 'MIXED';
};

type CategoryBucket = {
  plannedQty: number;
  actualQty: number;
  estimatedCost: number;
  actualCost: number;
  scrapCost: number;
};

export type ManufacturingCostingPayload = {
  status: ManufacturingCostStatus;
  incomplete: boolean;
  finalizedAt: string | null;
  valuationPolicy: typeof MANUFACTURING_INVENTORY_COST_BASIS.id;
  netQtyFormula: typeof MANUFACTURING_INVENTORY_COST_BASIS.netQtyFormula;
  estimated: {
    total: number | null;
    byCategory: Record<string, { qty: number; cost: number }>;
  };
  actual: {
    total: number | null;
    toDate: number | null;
    scrapCost: number;
    returnCredit: number;
    reworkCost: number;
    byCategory: Record<string, { qty: number; cost: number; scrapCost: number }>;
  };
  variance: { cost: number | null; pct: number | null };
  bySku: ManufacturingCostSkuRow[];
  /** Consumed RAW SKUs with null unitCost — blocks FINAL. */
  incompleteSkus: Array<{ sku: string; displayName: string | null; costedQty: number }>;
  lines?: Array<{
    salesOrderLineId: string;
    manufacturingName: string | null;
    quantity: number;
    estimatedTotal: number | null;
    actualTotal: number | null;
    varianceCost: number | null;
    status: ManufacturingCostStatus;
  }>;
  productionOrders?: Array<{
    id: string;
    number: string;
    status: string;
    estimatedTotal: number | null;
    actualTotal: number | null;
    costingStatus: ManufacturingCostStatus;
  }>;
  taskTrace?: Array<{
    taskId: string;
    stageCode: string | null;
    workerName: string | null;
    sku: string;
    costedQty: number;
    actualCost: number | null;
    isRework: boolean;
    finalizedAt: string | null;
  }>;
};

const FINAL_PO_STATUSES = new Set(['COMPLETED', 'READY_FOR_DELIVERY']);

function categoryKey(raw: string | null | undefined): string {
  const c = String(raw ?? '').toUpperCase();
  if (c.includes('FABRIC')) return 'fabric';
  if (c.includes('WOOD')) return 'wood';
  if (c.includes('FOAM')) return 'foam';
  if (c.includes('HARDWARE') || c.includes('ACCESS')) return 'hardware';
  return 'other';
}

function emptyBuckets(): Record<string, CategoryBucket> {
  return {
    fabric: { plannedQty: 0, actualQty: 0, estimatedCost: 0, actualCost: 0, scrapCost: 0 },
    wood: { plannedQty: 0, actualQty: 0, estimatedCost: 0, actualCost: 0, scrapCost: 0 },
    foam: { plannedQty: 0, actualQty: 0, estimatedCost: 0, actualCost: 0, scrapCost: 0 },
    hardware: { plannedQty: 0, actualQty: 0, estimatedCost: 0, actualCost: 0, scrapCost: 0 },
    other: { plannedQty: 0, actualQty: 0, estimatedCost: 0, actualCost: 0, scrapCost: 0 },
  };
}

@Injectable()
export class ManufacturingCostService {
  constructor(private readonly prisma: PrismaService) {}

  assertCanReadCost(user?: AuthUser) {
    if (user?.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Dealers cannot view manufacturing cost.',
      });
    }
    if (!can(user, 'inventory.cost.read')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Missing inventory.cost.read permission.',
      });
    }
  }

  async forProductionOrder(
    productionOrderId: string,
    user?: AuthUser,
  ): Promise<ManufacturingCostingPayload> {
    this.assertCanReadCost(user);
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: {
        id: true,
        number: true,
        status: true,
        quantity: true,
        salesOrderId: true,
        salesOrderLineId: true,
        product: { select: { nameEn: true } },
      },
    });
    if (!po) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }

    const [usages, planned] = await Promise.all([
      this.loadUsagesForPo(po.id),
      po.salesOrderLineId
        ? this.loadPlannedForSoLine(po.salesOrderLineId)
        : Promise.resolve([] as PlannedRow[]),
    ]);

    return this.hydrateEstimated(
      this.buildPayload({
        usages,
        planned,
        poStatuses: [po.status],
        includeTrace: true,
      }),
    );
  }

  async forSalesOrder(
    salesOrderId: string,
    user?: AuthUser,
  ): Promise<ManufacturingCostingPayload> {
    this.assertCanReadCost(user);
    const order = await this.prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      select: {
        id: true,
        number: true,
        lines: {
          where: { productionRequired: true },
          select: {
            id: true,
            description: true,
            quantity: true,
            productionSetup: {
              select: {
                manufacturingName: true,
                materialRequirements: {
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    sku: true,
                    displayName: true,
                    category: true,
                    expectedQty: true,
                    inventoryItem: { select: { sku: true, nameEn: true, category: true } },
                  },
                },
              },
            },
          },
        },
        productionOrders: {
          select: { id: true, number: true, status: true, salesOrderLineId: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order not found.' });
    }

    const poIds = order.productionOrders.map((p) => p.id);
    const usages = poIds.length ? await this.loadUsagesForPos(poIds) : [];
    const planned: PlannedRow[] = [];
    for (const line of order.lines) {
      const lineQty = Number(line.quantity) || 1;
      for (const m of line.productionSetup?.materialRequirements ?? []) {
        const sku = m.sku ?? m.inventoryItem?.sku;
        if (!sku) continue;
        const expected = m.expectedQty == null ? null : Number(m.expectedQty);
        if (expected == null) continue;
        planned.push({
          salesOrderLineId: line.id,
          sku,
          displayName: m.displayName ?? m.inventoryItem?.nameEn ?? null,
          category: (m.category as string | null) ?? m.inventoryItem?.category ?? null,
          plannedQty: expected * lineQty,
        });
      }
    }

    const payload = await this.hydrateEstimated(
      this.buildPayload({
        usages,
        planned,
        poStatuses: order.productionOrders.map((p) => p.status),
        includeTrace: true,
      }),
    );

    payload.lines = await Promise.all(
      order.lines.map(async (line) => {
        const linePlanned = planned.filter((p) => p.salesOrderLineId === line.id);
        const linePoIds = new Set(
          order.productionOrders
            .filter((p) => p.salesOrderLineId === line.id)
            .map((p) => p.id),
        );
        const lineUsages = usages.filter((u) => linePoIds.has(u.productionOrderId));
        const linePayload = await this.hydrateEstimated(
          this.buildPayload({
            usages: lineUsages,
            planned: linePlanned,
            poStatuses: order.productionOrders
              .filter((p) => p.salesOrderLineId === line.id)
              .map((p) => p.status),
          }),
        );
        return {
          salesOrderLineId: line.id,
          manufacturingName:
            line.productionSetup?.manufacturingName ?? line.description ?? null,
          quantity: Number(line.quantity),
          estimatedTotal: linePayload.estimated.total,
          actualTotal: linePayload.actual.total,
          varianceCost: linePayload.variance.cost,
          status: linePayload.status,
        };
      }),
    );

    payload.productionOrders = await Promise.all(
      order.productionOrders.map(async (p) => {
        const pUsages = usages.filter((u) => u.productionOrderId === p.id);
        const pPlanned = planned.filter((pl) =>
          order.lines.some((l) => l.id === p.salesOrderLineId && pl.salesOrderLineId === l.id),
        );
        const pPayload = await this.hydrateEstimated(
          this.buildPayload({
            usages: pUsages,
            planned: pPlanned,
            poStatuses: [p.status],
          }),
        );
        return {
          id: p.id,
          number: p.number,
          status: p.status,
          estimatedTotal: pPayload.estimated.total,
          actualTotal: pPayload.actual.total,
          costingStatus: pPayload.status,
        };
      }),
    );

    return payload;
  }

  async summaryForProductionOrder(productionOrderId: string, user?: AuthUser) {
    if (user?.customerId || !can(user, 'inventory.cost.read')) return null;
    try {
      const full = await this.forProductionOrder(productionOrderId, user);
      return {
        status: full.status,
        incomplete: full.incomplete,
        estimatedTotal: full.estimated.total,
        actualTotal: full.actual.total,
        varianceCost: full.variance.cost,
        variancePct: full.variance.pct,
        scrapCost: full.actual.scrapCost,
        finalizedAt: full.finalizedAt,
      };
    } catch {
      return null;
    }
  }

  /** Slim summary for embedding on detail responses (same numbers as full API). */
  async summaryForSalesOrder(salesOrderId: string, user?: AuthUser) {
    if (user?.customerId || !can(user, 'inventory.cost.read')) return null;
    try {
      const full = await this.forSalesOrder(salesOrderId, user);
      return {
        status: full.status,
        incomplete: full.incomplete,
        estimatedTotal: full.estimated.total,
        actualTotal: full.actual.total,
        varianceCost: full.variance.cost,
        variancePct: full.variance.pct,
        scrapCost: full.actual.scrapCost,
        finalizedAt: full.finalizedAt,
      };
    } catch {
      return null;
    }
  }

  private buildPayload(input: {
    usages: UsageRow[];
    planned: PlannedRow[];
    poStatuses: string[];
    includeTrace?: boolean;
  }): ManufacturingCostingPayload {
    // FINAL stability: prefer stored extendedCost/unitCost on usage rows.
    // Draft usage is valued provisionally in hydrateEstimated from the live map.
    const buckets = emptyBuckets();
    const bySkuMap = new Map<string, ManufacturingCostSkuRow>();

    for (const p of input.planned) {
      const row = bySkuMap.get(p.sku) ?? this.emptySku(p.sku, p.displayName, p.category);
      row.plannedQty += p.plannedQty;
      row.displayName = row.displayName ?? p.displayName;
      row.category = row.category ?? p.category;
      bySkuMap.set(p.sku, row);
    }

    let scrapCost = 0;
    let returnCredit = 0;
    let reworkCost = 0;
    let anyFinalized = false;
    let anyUncosted = false;
    let anyDraftCosted = false;
    let allUsagesFinalized = true;
    let latestFinal: Date | null = null;

    for (const u of input.usages) {
      if (u.finalizedAt) {
        anyFinalized = true;
        if (!latestFinal || u.finalizedAt > latestFinal) latestFinal = u.finalizedAt;
      } else {
        allUsagesFinalized = false;
      }
      const actual = Number(u.actualQty ?? 0);
      const returned = Number(u.returnedQty ?? 0);
      const scrap = Number(u.scrapQty ?? 0);
      const costedQty = actual + scrap - returned;
      const issuedQty = actual + returned + scrap;
      if (!u.finalizedAt && costedQty > 0) anyDraftCosted = true;
      const unitCost =
        u.unitCost != null && Number(u.unitCost) > 0 ? Number(u.unitCost) : null;
      const storedExt =
        u.extendedCost != null && Number(u.extendedCost) > 0
          ? Number(u.extendedCost)
          : null;
      const actualCost =
        storedExt != null
          ? storedExt
          : unitCost != null && costedQty > 0
            ? money(unitCost * costedQty)
            : null;
      // Finalized rows without valuation stay incomplete; draft rows wait for live hydrate.
      if (costedQty > 0 && actualCost == null && u.finalizedAt) anyUncosted = true;

      const scrapLine =
        unitCost != null && scrap > 0 ? money(unitCost * scrap) : 0;
      const returnLine =
        unitCost != null && returned > 0 ? money(unitCost * returned) : 0;
      scrapCost += scrapLine;
      returnCredit += returnLine;
      if (u.isRework && actualCost != null) reworkCost += actualCost;

      const row =
        bySkuMap.get(u.sku) ??
        this.emptySku(u.sku, u.displayName, u.category);
      row.issuedQty += issuedQty;
      row.returnedQty += returned;
      row.scrapQty += scrap;
      row.costedQty += costedQty;
      if (unitCost != null) row.unitCost = unitCost;
      if (actualCost != null) {
        row.actualCost = (row.actualCost ?? 0) + actualCost;
        row.costAvailable = true;
      } else if (costedQty > 0) {
        row.costAvailable = false;
      }
      if (u.isRework) {
        row.origin = row.origin === 'ORIGINAL' ? 'MIXED' : 'REWORK';
      } else if (row.origin === 'REWORK') {
        row.origin = 'MIXED';
      } else {
        row.origin = 'ORIGINAL';
      }
      row.displayName = row.displayName ?? u.displayName;
      row.category = row.category ?? u.category;
      bySkuMap.set(u.sku, row);
    }

    // Synchronous path: use stored unit costs for estimate when available on row;
    // otherwise leave estimated null until hydrateEstimated fills from the live map.
    for (const row of bySkuMap.values()) {
      if (row.plannedQty > 0 && row.unitCost != null) {
        row.estimatedCost = money(row.plannedQty * row.unitCost);
      }
      row.varianceQty = row.costedQty - row.plannedQty;
      if (row.estimatedCost != null && row.actualCost != null) {
        row.varianceCost = money(row.actualCost - row.estimatedCost);
      }
      const cat = categoryKey(row.category);
      buckets[cat]!.plannedQty += row.plannedQty;
      buckets[cat]!.actualQty += row.costedQty;
      buckets[cat]!.estimatedCost += row.estimatedCost ?? 0;
      buckets[cat]!.actualCost += row.actualCost ?? 0;
      buckets[cat]!.scrapCost +=
        row.unitCost != null && row.scrapQty > 0
          ? money(row.unitCost * row.scrapQty)
          : 0;
    }

    const anyEstimated = [...bySkuMap.values()].some((r) => r.estimatedCost != null);
    const anyActual = [...bySkuMap.values()].some((r) => r.actualCost != null);
    const estimatedTotal = anyEstimated
      ? money(
          [...bySkuMap.values()].reduce((s, r) => s + (r.estimatedCost ?? 0), 0),
        )
      : null;
    const actualTotal = anyActual
      ? money(
          [...bySkuMap.values()].reduce((s, r) => s + (r.actualCost ?? 0), 0),
        )
      : null;

    const poAtFinalBoundary =
      input.poStatuses.length > 0 &&
      input.poStatuses.every((s) => FINAL_PO_STATUSES.has(String(s).toUpperCase()));

    let status: ManufacturingCostStatus;
    if (anyUncosted && anyFinalized) {
      status = 'INCOMPLETE';
    } else if (poAtFinalBoundary && allUsagesFinalized && anyFinalized && !anyUncosted) {
      status = 'FINAL';
    } else if (anyFinalized || anyDraftCosted || anyActual) {
      status = 'IN_PROGRESS';
    } else {
      status = 'ESTIMATED_ONLY';
    }

    const varianceCost =
      estimatedTotal != null && actualTotal != null
        ? money(actualTotal - estimatedTotal)
        : null;
    const variancePct =
      varianceCost != null && estimatedTotal != null && estimatedTotal > 0
        ? money((varianceCost / estimatedTotal) * 100)
        : null;

    const byCategoryEst: Record<string, { qty: number; cost: number }> = {};
    const byCategoryAct: Record<
      string,
      { qty: number; cost: number; scrapCost: number }
    > = {};
    for (const [k, b] of Object.entries(buckets)) {
      byCategoryEst[k] = { qty: b.plannedQty, cost: money(b.estimatedCost) };
      byCategoryAct[k] = {
        qty: b.actualQty,
        cost: money(b.actualCost),
        scrapCost: money(b.scrapCost),
      };
    }

    const taskTrace = input.includeTrace
      ? input.usages
          .filter((u) => u.finalizedAt)
          .map((u) => {
            const actual = Number(u.actualQty ?? 0);
            const returned = Number(u.returnedQty ?? 0);
            const scrap = Number(u.scrapQty ?? 0);
            const costedQty = actual + scrap - returned;
            const unitCost =
              u.unitCost != null && Number(u.unitCost) > 0 ? Number(u.unitCost) : null;
            const actualCost =
              u.extendedCost != null
                ? Number(u.extendedCost)
                : unitCost != null
                  ? money(unitCost * costedQty)
                  : null;
            return {
              taskId: u.taskId,
              stageCode: u.stageCode,
              workerName: u.workerName,
              sku: u.sku,
              costedQty,
              actualCost,
              isRework: u.isRework,
              finalizedAt: u.finalizedAt?.toISOString() ?? null,
            };
          })
      : undefined;

    const bySku = [...bySkuMap.values()].sort((a, b) => a.sku.localeCompare(b.sku));
    const incompleteSkus = bySku
      .filter((r) => r.costedQty > 0 && !r.costAvailable)
      .map((r) => ({
        sku: r.sku,
        displayName: r.displayName,
        costedQty: r.costedQty,
      }));

    return {
      status,
      incomplete: anyUncosted,
      finalizedAt:
        status === 'FINAL' && latestFinal ? latestFinal.toISOString() : null,
      valuationPolicy: MANUFACTURING_INVENTORY_COST_BASIS.id,
      netQtyFormula: MANUFACTURING_INVENTORY_COST_BASIS.netQtyFormula,
      estimated: { total: estimatedTotal, byCategory: byCategoryEst },
      actual: {
        total: actualTotal,
        toDate: actualTotal,
        scrapCost: money(scrapCost),
        returnCredit: money(returnCredit),
        reworkCost: money(reworkCost),
        byCategory: byCategoryAct,
      },
      variance: { cost: varianceCost, pct: variancePct },
      bySku,
      incompleteSkus,
      taskTrace,
    };
  }

  private emptySku(
    sku: string,
    displayName: string | null,
    category: string | null,
  ): ManufacturingCostSkuRow {
    return {
      sku,
      displayName,
      category,
      plannedQty: 0,
      issuedQty: 0,
      returnedQty: 0,
      scrapQty: 0,
      costedQty: 0,
      unitCost: null,
      estimatedCost: null,
      actualCost: null,
      varianceQty: 0,
      varianceCost: null,
      costAvailable: false,
      origin: 'ORIGINAL',
    };
  }

  private async loadUsagesForPo(productionOrderId: string) {
    return this.loadUsagesForPos([productionOrderId]);
  }

  private async loadUsagesForPos(productionOrderIds: string[]): Promise<UsageRow[]> {
    if (!productionOrderIds.length) return [];
    const rows = await this.prisma.productionTaskMaterialUsage.findMany({
      where: {
        productionOrderId: { in: productionOrderIds },
        inventoryItem: { itemClass: 'RAW_MATERIAL' },
      },
      select: {
        id: true,
        productionOrderId: true,
        taskId: true,
        sku: true,
        expectedQty: true,
        actualQty: true,
        returnedQty: true,
        scrapQty: true,
        unitCost: true,
        extendedCost: true,
        valuedAt: true,
        finalizedAt: true,
        inventoryItem: {
          select: { nameEn: true, category: true, itemClass: true },
        },
        task: {
          select: {
            isRework: true,
            stageDefinition: { select: { code: true } },
            assignedEmployee: {
              select: { firstName: true, lastName: true, username: true },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      productionOrderId: r.productionOrderId,
      taskId: r.taskId,
      sku: r.sku,
      displayName: r.inventoryItem?.nameEn ?? null,
      category: r.inventoryItem?.category ?? null,
      actualQty: r.actualQty,
      returnedQty: r.returnedQty,
      scrapQty: r.scrapQty,
      unitCost: r.unitCost,
      extendedCost: r.extendedCost,
      finalizedAt: r.finalizedAt,
      isRework: Boolean(r.task?.isRework),
      stageCode: r.task?.stageDefinition?.code ?? null,
      workerName: r.task?.assignedEmployee
        ? [r.task.assignedEmployee.firstName, r.task.assignedEmployee.lastName]
            .filter(Boolean)
            .join(' ') || r.task.assignedEmployee.username
        : null,
    }));
  }

  private async loadPlannedForSoLine(salesOrderLineId: string): Promise<PlannedRow[]> {
    const setup = await this.prisma.salesOrderLineSetup.findUnique({
      where: { salesOrderLineId },
      select: {
        salesOrderLine: { select: { quantity: true } },
        materialRequirements: {
          select: {
            sku: true,
            displayName: true,
            category: true,
            expectedQty: true,
            inventoryItem: { select: { sku: true, nameEn: true, category: true } },
          },
        },
      },
    });
    if (!setup) return [];
    const lineQty = Number(setup.salesOrderLine.quantity) || 1;
    return setup.materialRequirements
      .map((m) => {
        const sku = m.sku ?? m.inventoryItem?.sku;
        if (!sku) return null;
        const expected = m.expectedQty == null ? null : Number(m.expectedQty);
        if (expected == null) return null;
        return {
          salesOrderLineId,
          sku,
          displayName: m.displayName ?? m.inventoryItem?.nameEn ?? null,
          category: (m.category as string | null) ?? m.inventoryItem?.category ?? null,
          plannedQty: expected * lineQty,
        };
      })
      .filter((x): x is PlannedRow => Boolean(x));
  }

  private async loadLiveMap(skus: string[]): Promise<MaterialCostMap> {
    if (!skus.length) return new Map();
    const [items, txs] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { sku: { in: skus }, archivedAt: null },
        select: { sku: true, standardCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: {
          inventoryItem: { sku: { in: skus } },
          unitCost: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
        select: {
          unitCost: true,
          type: true,
          inventoryItem: { select: { sku: true } },
        },
      }),
    ]);
    return buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((t) => ({
        sku: t.inventoryItem.sku,
        unitCost: t.unitCost,
        type: t.type,
      })),
    });
  }

  /**
   * Hydrate planned estimated + in-progress actual from the live inventory map.
   * Estimated is never frozen. Draft (unfinalized) usage gets a provisional actual
   * so Actual / Variance update throughout production; finalize still freezes
   * stored unitCost/extendedCost for FINAL stability.
   */
  async hydrateEstimated(
    payload: ManufacturingCostingPayload,
  ): Promise<ManufacturingCostingPayload> {
    const needEst = payload.bySku.filter(
      (r) => r.plannedQty > 0 && r.estimatedCost == null,
    );
    // Provisional actual only while production is open — FINAL / INCOMPLETE keep frozen rows.
    const allowProvisionalActual =
      payload.status === 'ESTIMATED_ONLY' || payload.status === 'IN_PROGRESS';
    const needAct = allowProvisionalActual
      ? payload.bySku.filter((r) => r.costedQty > 0 && r.actualCost == null)
      : [];
    const skus = [
      ...new Set([...needEst, ...needAct].map((r) => r.sku).filter(Boolean)),
    ];
    const map = skus.length ? await this.loadLiveMap(skus) : new Map();

    const buckets = emptyBuckets();
    for (const row of payload.bySku) {
      if (row.plannedQty > 0 && row.estimatedCost == null) {
        const u = map.has(row.sku) ? map.get(row.sku)! : null;
        if (u != null && u > 0) {
          row.unitCost = row.unitCost ?? u;
          row.estimatedCost = money(row.plannedQty * u);
        }
      }
      if (allowProvisionalActual && row.costedQty > 0 && row.actualCost == null) {
        const u =
          row.unitCost != null && row.unitCost > 0
            ? row.unitCost
            : map.has(row.sku)
              ? map.get(row.sku)!
              : null;
        if (u != null && u > 0) {
          row.unitCost = row.unitCost ?? u;
          row.actualCost = money(row.costedQty * u);
          row.costAvailable = true;
        }
      }
      if (row.estimatedCost != null && row.actualCost != null) {
        row.varianceCost = money(row.actualCost - row.estimatedCost);
      }
      const cat = categoryKey(row.category);
      buckets[cat]!.plannedQty += row.plannedQty;
      buckets[cat]!.actualQty += row.costedQty;
      buckets[cat]!.estimatedCost += row.estimatedCost ?? 0;
      buckets[cat]!.actualCost += row.actualCost ?? 0;
      buckets[cat]!.scrapCost +=
        row.unitCost != null && row.scrapQty > 0
          ? money(row.unitCost * row.scrapQty)
          : 0;
    }

    const anyEstimated = payload.bySku.some((r) => r.estimatedCost != null);
    const anyActual = payload.bySku.some((r) => r.actualCost != null);
    payload.estimated.total = anyEstimated
      ? money(payload.bySku.reduce((s, r) => s + (r.estimatedCost ?? 0), 0))
      : null;
    if (allowProvisionalActual || anyActual) {
      payload.actual.total = anyActual
        ? money(payload.bySku.reduce((s, r) => s + (r.actualCost ?? 0), 0))
        : null;
      payload.actual.toDate = payload.actual.total;
    }

    for (const [k, b] of Object.entries(buckets)) {
      payload.estimated.byCategory[k] = {
        qty: b.plannedQty,
        cost: money(b.estimatedCost),
      };
      if (allowProvisionalActual) {
        payload.actual.byCategory[k] = {
          qty: b.actualQty,
          cost: money(b.actualCost),
          scrapCost: money(b.scrapCost),
        };
      }
    }

    if (payload.estimated.total != null && payload.actual.total != null) {
      payload.variance.cost = money(payload.actual.total - payload.estimated.total);
      payload.variance.pct =
        payload.estimated.total > 0
          ? money((payload.variance.cost / payload.estimated.total) * 100)
          : null;
    } else if (allowProvisionalActual) {
      payload.variance.cost = null;
      payload.variance.pct = null;
    }

    if (allowProvisionalActual) {
      payload.incompleteSkus = payload.bySku
        .filter((r) => r.costedQty > 0 && !r.costAvailable)
        .map((r) => ({
          sku: r.sku,
          displayName: r.displayName,
          costedQty: r.costedQty,
        }));
      // Draft gaps stay on the SKU list; card status stays IN_PROGRESS (cost to date).
      payload.incomplete = false;
    }

    // Promote ESTIMATED_ONLY → IN_PROGRESS once materials are being consumed.
    if (
      payload.status === 'ESTIMATED_ONLY' &&
      (payload.actual.total != null ||
        payload.bySku.some((r) => r.costedQty > 0))
    ) {
      payload.status = 'IN_PROGRESS';
    }

    return payload;
  }
}

type PlannedRow = {
  salesOrderLineId: string;
  sku: string;
  displayName: string | null;
  category: string | null;
  plannedQty: number;
};

type UsageRow = {
  productionOrderId: string;
  taskId: string;
  sku: string;
  displayName: string | null;
  category: string | null;
  actualQty: unknown;
  returnedQty: unknown;
  scrapQty: unknown;
  unitCost: unknown;
  extendedCost: unknown;
  finalizedAt: Date | null;
  isRework: boolean;
  stageCode: string | null;
  workerName: string | null;
};
