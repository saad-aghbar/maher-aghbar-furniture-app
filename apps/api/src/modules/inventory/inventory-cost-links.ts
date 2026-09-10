import type { Prisma } from '@maher/database';

export async function resolveInventoryCostLinks(
  tx: Prisma.TransactionClient,
  params: {
    referenceType?: string;
    referenceId?: string;
    productionOrderId?: string;
    productionTaskId?: string;
    salesOrderId?: string;
  },
) {
  const productionTaskId =
    params.productionTaskId ??
    (params.referenceType === 'ProductionTask' ? params.referenceId : undefined);
  let productionOrderId =
    params.productionOrderId ??
    (params.referenceType === 'ProductionOrder' ? params.referenceId : undefined);
  let salesOrderId =
    params.salesOrderId ??
    (params.referenceType === 'SalesOrder' ? params.referenceId : undefined);

  if (productionTaskId && (!productionOrderId || !salesOrderId)) {
    const task = await tx.productionTask.findUnique({
      where: { id: productionTaskId },
      select: { productionOrderId: true, productionOrder: { select: { salesOrderId: true } } },
    });
    productionOrderId = productionOrderId ?? task?.productionOrderId;
    salesOrderId = salesOrderId ?? task?.productionOrder?.salesOrderId ?? undefined;
  } else if (productionOrderId && !salesOrderId) {
    const po = await tx.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { salesOrderId: true },
    });
    salesOrderId = po?.salesOrderId ?? undefined;
  }

  return { productionTaskId, productionOrderId, salesOrderId };
}
