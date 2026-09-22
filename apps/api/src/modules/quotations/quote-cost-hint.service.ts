import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTxType, Prisma, SalesOrderStatus } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { summarizeLaborEntries } from '../production/labor-costing';
import { assembleActualProduction } from '../reports/production-cost';

export type CostHintBasis = 'variant' | 'product' | 'modified' | 'custom' | 'none';

export interface QuoteLineCostHint {
  lineId: string;
  basis: CostHintBasis;
  /** BOM / catalog baseline per unit (variant, else product manufacturing cost). */
  plannedCost: number | null;
  /** Most recent completed factory actual per unit for the same fingerprint. */
  lastActualCost: number | null;
  lastActualAt: string | null;
  /** Average actual per unit across matching completed lines. */
  avgActualCost: number | null;
  sampleCount: number;
  /** How the actuals were matched (exact fingerprint vs product / custom cohort). */
  matched: 'exact' | 'product' | 'cohort' | 'none';
}

const ISSUE_TYPES: InventoryTxType[] = [
  InventoryTxType.PRODUCTION_ISSUE,
  InventoryTxType.PRODUCTION_RETURN,
  InventoryTxType.SCRAP,
  InventoryTxType.DAMAGE,
];

const DONE_ORDER_STATUSES: SalesOrderStatus[] = [SalesOrderStatus.READY_FOR_DELIVERY, SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED];

function num(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => (row && typeof row === 'object' ? (row as { specOptionValueId?: string | null }).specOptionValueId : null))
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .sort();
}

function dims(width: unknown, height: unknown, depth: unknown): string {
  return [width, height, depth].map((v) => (v == null || v === '' ? '' : String(Math.round(Number(v))))).join('x');
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
}

/**
 * Cost hints beside quotation prices: the BOM baseline plus what the floor
 * actually spent last time on the same variant, the same modified fingerprint
 * (variant + options + dims), or a similar custom piece. Every completed
 * production order becomes a new sample, so the hints sharpen over time.
 */
@Injectable()
export class QuoteCostHintService {
  constructor(private readonly prisma: PrismaService) {}

  async forQuotation(quotationId: string, user?: AuthUser): Promise<{ lines: QuoteLineCostHint[] }> {
    if (user?.customerId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Dealers cannot view manufacturing cost.' });
    }
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, archivedAt: null },
      select: {
        id: true,
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            productId: true,
            variantId: true,
            description: true,
            width: true,
            height: true,
            depth: true,
            manufacturingComplexity: true,
            lineSpec: true,
            product: { select: { manufacturingCost: true } },
            variant: { select: { manufacturingCost: true } },
          },
        },
      },
    });
    if (!quotation) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Quotation not found.' });

    const productIds = [...new Set(quotation.lines.map((l) => l.productId).filter((id): id is string => Boolean(id)))];
    const hasCustom = quotation.lines.some((l) => !l.productId || String(l.manufacturingComplexity) === 'CUSTOM');
    const history = await this.loadHistory(productIds, hasCustom);

    const lines = quotation.lines.map((line): QuoteLineCostHint => {
      const complexity = String(line.manufacturingComplexity ?? (line.productId ? 'STANDARD' : 'CUSTOM'));
      const planned = num(line.variant?.manufacturingCost) ?? num(line.product?.manufacturingCost);
      const spec = (line.lineSpec ?? null) as { options?: unknown } | null;
      const fingerprint = line.productId
        ? `${line.productId}|${line.variantId ?? ''}|${optionIds(spec?.options).join(',')}|${dims(line.width, line.height, line.depth)}`
        : `custom|${normalizeText(line.description)}|${dims(line.width, line.height, line.depth)}`;

      let basis: CostHintBasis = 'none';
      if (!line.productId || complexity === 'CUSTOM') basis = 'custom';
      else if (complexity === 'MODIFIED') basis = 'modified';
      else if (line.variantId) basis = 'variant';
      else basis = 'product';

      // Exact fingerprint first, then the product family, then the custom cohort.
      let rows = history.filter((h) => h.fingerprint === fingerprint);
      let matched: QuoteLineCostHint['matched'] = rows.length ? 'exact' : 'none';
      if (!rows.length && line.productId) {
        rows = history.filter((h) => h.productId === line.productId && (basis !== 'variant' || !line.variantId || h.variantId === line.variantId));
        if (!rows.length) rows = history.filter((h) => h.productId === line.productId);
        matched = rows.length ? 'product' : 'none';
      }
      if (!rows.length && basis === 'custom') {
        rows = history.filter((h) => h.custom);
        matched = rows.length ? 'cohort' : 'none';
      }
      rows = rows.filter((h) => h.unitCost != null).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      const costs = rows.map((h) => h.unitCost as number);
      const avg = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
      return {
        lineId: line.id,
        basis,
        plannedCost: planned,
        lastActualCost: costs[0] ?? null,
        lastActualAt: rows[0]?.completedAt.toISOString() ?? null,
        avgActualCost: avg == null ? null : Math.round(avg * 100) / 100,
        sampleCount: costs.length,
        matched: costs.length ? matched : 'none',
      };
    });
    return { lines };
  }

  /** Completed sales-order lines with their factory actual cost per unit. */
  private async loadHistory(productIds: string[], includeCustom: boolean) {
    if (!productIds.length && !includeCustom) return [];
    const since = new Date();
    since.setFullYear(since.getFullYear() - 2);
    const lines = await this.prisma.salesOrderLine.findMany({
      where: {
        productionRequired: true,
        salesOrder: { archivedAt: null, status: { in: DONE_ORDER_STATUSES }, createdAt: { gte: since } },
        OR: [
          ...(productIds.length ? [{ productId: { in: productIds } }] : []),
          ...(includeCustom ? [{ OR: [{ productId: null }, { manufacturingComplexity: 'CUSTOM' as never }] }] : []),
        ],
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        description: true,
        quantity: true,
        manufacturingComplexity: true,
        orderSpec: true,
        lineOptions: { select: { specOptionValueId: true } },
        salesOrder: { select: { updatedAt: true } },
        productionOrders: {
          where: { archivedAt: null, originType: 'SALES_ORDER', status: 'COMPLETED' },
          select: {
            id: true,
            actualCompletionDate: true,
            updatedAt: true,
            tasks: { select: { id: true, actualMinutes: true, isRework: true, stageDefinitionId: true } },
          },
        },
      },
      take: 400,
      orderBy: { salesOrder: { updatedAt: 'desc' } },
    });
    const withPo = lines.filter((l) => l.productionOrders.length);
    if (!withPo.length) return [];
    const poIds = withPo.flatMap((l) => l.productionOrders.map((po) => po.id));
    const taskIds = withPo.flatMap((l) => l.productionOrders.flatMap((po) => po.tasks.map((t) => t.id)));
    const [txs, rates, entries] = await Promise.all([
      this.prisma.inventoryTransaction.findMany({
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
      }),
      typeof this.prisma.laborRate?.findMany === 'function' ? this.prisma.laborRate.findMany() : Promise.resolve([]),
      taskIds.length && typeof this.prisma.taskTimeEntry?.findMany === 'function'
        ? this.prisma.taskTimeEntry.findMany({
            where: { taskId: { in: taskIds } },
            select: { id: true, taskId: true, userId: true, minutes: true, startedAt: true, endedAt: true },
          })
        : Promise.resolve([]),
    ]);
    const byPo = new Map<string, typeof txs>();
    for (const tx of txs) {
      const poId = tx.productionOrderId || (tx.referenceType === 'ProductionOrder' ? tx.referenceId : null);
      if (!poId) continue;
      byPo.set(poId, [...(byPo.get(poId) ?? []), tx]);
    }
    return withPo.map((line) => {
      const tasks = line.productionOrders.flatMap((po) => po.tasks);
      const reworkByTask = new Map(tasks.map((t) => [t.id, t.isRework] as const));
      const lineTxs = line.productionOrders.flatMap((po) => byPo.get(po.id) ?? []);
      const labor = summarizeLaborEntries({
        rates,
        tasks: tasks.map((t) => ({ id: t.id, stageDefinitionId: t.stageDefinitionId, isRework: t.isRework })),
        entries: entries.filter((e) => tasks.some((t) => t.id === e.taskId)),
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
        labor,
      });
      const qty = Math.max(1, Number(line.quantity) || 1);
      const spec = (line.orderSpec ?? null) as { options?: unknown; width?: unknown; height?: unknown; depth?: unknown } | null;
      const options = line.lineOptions.length ? line.lineOptions.map((o) => o.specOptionValueId).sort() : optionIds(spec?.options);
      const custom = !line.productId || String(line.manufacturingComplexity) === 'CUSTOM';
      const fingerprint = line.productId
        ? `${line.productId}|${line.variantId ?? ''}|${options.join(',')}|${dims(spec?.width, spec?.height, spec?.depth)}`
        : `custom|${normalizeText(line.description)}|${dims(spec?.width, spec?.height, spec?.depth)}`;
      const completedAt = line.productionOrders.map((po) => po.actualCompletionDate ?? po.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? line.salesOrder.updatedAt;
      return {
        productId: line.productId,
        variantId: line.variantId,
        custom,
        fingerprint,
        unitCost: mix.total == null ? null : Math.round((mix.total / qty) * 100) / 100,
        completedAt,
      };
    });
  }
}
