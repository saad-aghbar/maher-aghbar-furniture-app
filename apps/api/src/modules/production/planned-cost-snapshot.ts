import type { Prisma } from '@maher/database';
import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { pickVariantScopedRows } from '@maher/types';
import { rollupLaborCost } from './labor-costing';
import type { QuantityScalingMode } from '../scheduling/domain/types';

type Tx = Prisma.TransactionClient;

export async function freezePlannedCostAtRelease(tx: Tx, salesOrderId: string) {
  const so = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      manufacturingCost: true,
      costBreakdown: true,
      plannedCostFrozenAt: true,
      productionOrders: {
        select: { id: true, quantity: true, productId: true, variantId: true },
      },
    },
  });
  if (!so || so.plannedCostFrozenAt) return so?.plannedCostFrozenAt ?? null;

  const now = new Date();
  await tx.salesOrder.update({
    where: { id: salesOrderId },
    data: { plannedCostFrozenAt: now },
  });

  const totalQty = so.productionOrders.reduce((sum, po) => sum + Number(po.quantity), 0) || 1;
  // SalesOrder.manufacturingCost is the material plan (BOM / production price), not
  // an all-in total. Split it by quantity share into plannedMaterialCost. Planned
  // labor is snapshotted separately from stage estimates — do not subtract labor
  // from the header (that would understate materials on existing orders).
  const header = positiveUnitCost(so.manufacturingCost);
  const rates =
    typeof tx.laborRate?.findMany === 'function' ? await tx.laborRate.findMany() : [];
  const productIds = [
    ...new Set(so.productionOrders.map((po) => po.productId).filter(Boolean)),
  ] as string[];
  const estimateRows =
    productIds.length && typeof tx.productStageEstimate?.findMany === 'function'
    ? await tx.productStageEstimate.findMany({
        where: { productId: { in: productIds } },
        select: {
          productId: true,
          variantId: true,
          stageDefinitionId: true,
          quantityScalingMode: true,
          setupMinutes: true,
          minutesPerUnit: true,
          fixedMinutes: true,
          batchSize: true,
          batchMinutes: true,
          maxParallelUnits: true,
          stageDefinition: { select: { code: true } },
        },
      })
    : [];

  for (const po of so.productionOrders) {
    const share = header != null ? header * (Number(po.quantity) / totalQty) : null;
    const scoped = pickVariantScopedRows(
      estimateRows.filter((row) => row.productId === po.productId),
      po.variantId,
    );
    const labor = rollupLaborCost({
      rates,
      tasks: [],
      entries: [],
      estimates: scoped.map((row) => ({
        stageDefinitionId: row.stageDefinitionId,
        stageCode: row.stageDefinition.code,
        quantityScalingMode: row.quantityScalingMode as QuantityScalingMode,
        quantity: Number(po.quantity) || 1,
        setupMinutes: row.setupMinutes,
        minutesPerUnit: row.minutesPerUnit,
        fixedMinutes: row.fixedMinutes,
        batchSize: row.batchSize,
        batchMinutes: row.batchMinutes,
        maxParallelUnits: row.maxParallelUnits,
      })),
      now,
    });
    const breakdown =
      so.costBreakdown && typeof so.costBreakdown === 'object' && !Array.isArray(so.costBreakdown)
        ? { ...(so.costBreakdown as Record<string, unknown>), labor }
        : { labor };
    await tx.productionOrder.update({
      where: { id: po.id },
      data: {
        plannedMaterialCost: share,
        plannedLaborCost: labor?.estimated ?? null,
        plannedCostBreakdown: breakdown as Prisma.InputJsonValue,
        plannedCostFrozenAt: now,
      },
    });
  }
  return now;
}
