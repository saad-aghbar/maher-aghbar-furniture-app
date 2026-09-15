import { InventoryCategory, PrismaClient, type Prisma } from '@maher/database';

/** PrismaService or an interactive transaction — both expose the same delegates. */

type Db = PrismaClient | Prisma.TransactionClient;

/** Create a FabricProcurement row for every FABRIC requirement that lacks one. */
export async function ensureFabricProcurementsForSalesOrder(
  db: Db,
  salesOrderId: string,
): Promise<string[]> {
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
  const createdIds: string[] = [];
  for (const req of reqs) {
    if (!req.lineSetup?.salesOrderLineId) continue;
    const row = await db.fabricProcurement.create({
      data: {
        requirementId: req.id,
        salesOrderId,
        salesOrderLineId: req.lineSetup.salesOrderLineId,
        unit: req.unit || 'm',
        orderedQty: req.expectedQty ?? undefined,
        state: 'NEEDS_ORDERING',
      },
    });
    createdIds.push(row.id);
  }
  return createdIds;
}

export async function ensureFabricProcurementsForProductionOrder(
  db: Db,
  productionOrderId: string,
): Promise<string[]> {
  const reqs = await db.salesOrderLineMaterialRequirement.findMany({
    where: {
      category: InventoryCategory.FABRIC,
      fabricProcurement: null,
      productionOrderId,
    },
    select: {
      id: true,
      unit: true,
      expectedQty: true,
    },
  });
  const createdIds: string[] = [];
  for (const req of reqs) {
    const row = await db.fabricProcurement.create({
      data: {
        requirementId: req.id,
        productionOrderId,
        unit: req.unit || 'm',
        orderedQty: req.expectedQty ?? undefined,
        state: 'NEEDS_ORDERING',
      },
    });
    createdIds.push(row.id);
  }
  return createdIds;
}

export type EnsureFabricProcurementsDb = Db;
