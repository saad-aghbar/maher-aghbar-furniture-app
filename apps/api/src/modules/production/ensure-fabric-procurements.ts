import { InventoryCategory, type Prisma } from '@maher/database';

type Db = Prisma.TransactionClient;

/** Create a FabricProcurement row for every FABRIC requirement that lacks one. */
export async function ensureFabricProcurementsForSalesOrder(
  db: Db,
  salesOrderId: string,
): Promise<number> {
  const reqs = await db.salesOrderLineMaterialRequirement.findMany({
    where: {
      category: InventoryCategory.FABRIC,
      fabricProcurement: null,
      lineSetup: { productionSetup: { salesOrderId } },
    },
    select: {
      id: true,
      unit: true,
      expectedQty: true,
      lineSetup: { select: { salesOrderLineId: true } },
    },
  });
  for (const req of reqs) {
    await db.fabricProcurement.create({
      data: {
        requirementId: req.id,
        salesOrderId,
        salesOrderLineId: req.lineSetup.salesOrderLineId,
        unit: req.unit || 'm',
        orderedQty: req.expectedQty ?? undefined,
        state: 'NEEDS_ORDERING',
      },
    });
  }
  return reqs.length;
}

export type EnsureFabricProcurementsDb = Db;
