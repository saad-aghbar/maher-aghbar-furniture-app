import type { Prisma } from '@maher/database';
import { positiveUnitCost } from '../inventory/issue-unit-cost';

type Tx = Prisma.TransactionClient;

export async function freezePlannedCostAtRelease(tx: Tx, salesOrderId: string) {
  const so = await tx.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      manufacturingCost: true,
      costBreakdown: true,
      plannedCostFrozenAt: true,
      productionOrders: { select: { id: true, quantity: true } },
    },
  });
  if (!so || so.plannedCostFrozenAt) return so?.plannedCostFrozenAt ?? null;

  const now = new Date();
  await tx.salesOrder.update({
    where: { id: salesOrderId },
    data: { plannedCostFrozenAt: now },
  });

  const totalQty = so.productionOrders.reduce((sum, po) => sum + Number(po.quantity), 0) || 1;
  const header = positiveUnitCost(so.manufacturingCost);
  for (const po of so.productionOrders) {
    const share = header != null ? header * (Number(po.quantity) / totalQty) : null;
    await tx.productionOrder.update({
      where: { id: po.id },
      data: {
        plannedMaterialCost: share,
        plannedCostBreakdown: so.costBreakdown ?? undefined,
        plannedCostFrozenAt: now,
      },
    });
  }
  return now;
}
