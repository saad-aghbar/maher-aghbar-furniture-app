import type { Prisma } from '@maher/database';
import {
  assessFabricReadiness,
  summarizeFabricReadiness,
  type FabricReadinessBlock,
  type FabricReadinessResult,
} from './fabric-readiness';

type Db = Prisma.TransactionClient;

type ReadinessRow = Prisma.FabricProcurementGetPayload<{
  include: { requirement: true; lots: true };
}>;

async function mapReadinessRows(
  db: Db,
  rows: ReadinessRow[],
): Promise<{ items: FabricReadinessResult[]; block: FabricReadinessBlock }> {
  const lotIds = rows.flatMap((r) => r.lots.map((l) => l.id));
  const usageRows = lotIds.length
    ? await db.productionTaskMaterialUsage.findMany({
        where: { inventoryLotId: { in: lotIds } },
        select: { inventoryLotId: true, actualQty: true },
      })
    : [];
  const usages = usageRows.map((u) => ({
    inventoryLotId: u.inventoryLotId,
    actualQty: u.actualQty != null ? Number(u.actualQty) : null,
  }));
  const items = rows.map((row) =>
    assessFabricReadiness({
      requirement: {
        id: row.requirementId,
        salesOrderId: row.salesOrderId,
        productionOrderId: row.productionOrderId,
        label:
          row.requirement.requestedFabricLabel ||
          row.requirement.displayName ||
          row.requirement.sku ||
          'Fabric',
        sku: row.requirement.sku,
        inventoryItemId: row.requirement.inventoryItemId,
        expectedQty: row.requirement.expectedQty != null ? Number(row.requirement.expectedQty) : null,
        qtyIsEstimate: row.requirement.qtyIsEstimate,
        unit: row.unit || row.requirement.unit,
        fabricRole: row.requirement.fabricRole,
        stageCode: row.requirement.stageCode,
      },
      procurement: {
        state: row.state,
        fabricHoldOverriddenAt: row.fabricHoldOverriddenAt,
        expectedAvailableAt: row.expectedAvailableAt,
      },
      lots: row.lots.map((l) => ({
        id: l.id,
        quantity: Number(l.quantity),
        remainingQty: l.remainingQty != null ? Number(l.remainingQty) : null,
        status: l.status,
        allocationMode: l.allocationMode,
        salesOrderId: l.salesOrderId,
        productionOrderId: l.productionOrderId,
        locationId: l.locationId,
        inventoryItemId: l.inventoryItemId,
      })),
      usages,
    }),
  );
  return { items, block: summarizeFabricReadiness(items) };
}

export async function loadFabricReadinessForProductionOrder(
  db: Db,
  productionOrderId: string | null | undefined,
): Promise<{ items: FabricReadinessResult[]; block: FabricReadinessBlock }> {
  if (!productionOrderId) {
    const block = summarizeFabricReadiness([]);
    return { items: [], block };
  }
  const rows = await db.fabricProcurement.findMany({
    where: { productionOrderId },
    include: {
      requirement: true,
      lots: true,
    },
  });
  return mapReadinessRows(db, rows);
}

export async function loadFabricReadinessForSalesOrder(
  db: Db,
  salesOrderId: string | null | undefined,
): Promise<{ items: FabricReadinessResult[]; block: FabricReadinessBlock }> {
  if (!salesOrderId) {
    const block = summarizeFabricReadiness([]);
    return { items: [], block };
  }
  const rows = await db.fabricProcurement.findMany({
    where: { salesOrderId },
    include: {
      requirement: true,
      lots: true,
    },
  });
  return mapReadinessRows(db, rows);
}
