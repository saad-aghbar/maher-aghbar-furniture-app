import { InventoryAllocationMode, InventoryLotStatus, Prisma } from '@maher/database';

type Tx = Prisma.TransactionClient;

export async function allocateFabricBundleQr(
  tx: Tx,
  salesOrderNumber: string,
): Promise<string> {
  const compact = String(salesOrderNumber || 'WO')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 16)
    .toUpperCase() || 'SO';
  for (let i = 1; i < 1000; i++) {
    const code = `FB-${compact}-${String(i).padStart(3, '0')}`;
    const exists = await tx.inventoryLot.findUnique({
      where: { qrCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `FB-${compact}-${Date.now().toString(36).toUpperCase()}`;
}

export type FabricReceiptLineInput = {
  inventoryItemId: string;
  acceptedQty: number;
  unitCost: number | null;
  category?: string | null;
  fabricProcurementId?: string | null;
  salesOrderId?: string | null;
  salesOrderLineId?: string | null;
  productionOrderId?: string | null;
};

export type OrderAllocatedFabricLot = {
  id: string;
  qrCode: string;
  fabricProcurementId: string;
  reused: boolean;
};

/** One labelled FB- bundle, idempotent on sourceKey. */
export async function createOrderAllocatedFabricLot(input: {
  tx: Tx;
  sourceKey: string;
  inventoryItemId: string;
  warehouseId: string;
  locationId?: string | null;
  salesOrderId?: string | null;
  salesOrderLineId?: string | null;
  productionOrderId?: string | null;
  qty: number;
  unitCost?: number | null;
  fabricProcurementId: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  salesOrderNumber?: string | null;
  photoDocumentId?: string | null;
}): Promise<OrderAllocatedFabricLot> {
  const existing = await input.tx.inventoryLot.findFirst({
    where: { sourceKey: input.sourceKey },
    select: { id: true, qrCode: true },
  });
  if (existing) {
    return {
      id: existing.id,
      qrCode: existing.qrCode ?? '',
      fabricProcurementId: input.fabricProcurementId,
      reused: true,
    };
  }

  const qrCode = await allocateFabricBundleQr(input.tx, input.salesOrderNumber ?? 'WO');
  const lot = await input.tx.inventoryLot.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      warehouseId: input.warehouseId,
      locationId: input.locationId ?? undefined,
      salesOrderId: input.salesOrderId ?? undefined,
      salesOrderLineId: input.salesOrderLineId ?? undefined,
      productionOrderId: input.productionOrderId ?? undefined,
      quantity: new Prisma.Decimal(input.qty),
      remainingQty: new Prisma.Decimal(input.qty),
      status: InventoryLotStatus.AVAILABLE,
      allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
      sourceKey: input.sourceKey,
      qrCode,
      fabricProcurementId: input.fabricProcurementId,
      supplierId: input.supplierId ?? undefined,
      purchaseOrderId: input.purchaseOrderId ?? undefined,
      goodsReceiptId: input.goodsReceiptId ?? undefined,
      unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : undefined,
      photoDocumentId: input.photoDocumentId ?? undefined,
    },
  });
  return {
    id: lot.id,
    qrCode,
    fabricProcurementId: input.fabricProcurementId,
    reused: false,
  };
}

export async function createGeneralStockFabricLot(input: {
  tx: Tx;
  sourceKey: string;
  inventoryItemId: string;
  warehouseId: string;
  locationId?: string | null;
  qty: number;
  unitCost?: number | null;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  photoDocumentId?: string | null;
}): Promise<{ id: string; qrCode: string; reused: boolean }> {
  const existing = await input.tx.inventoryLot.findFirst({
    where: { sourceKey: input.sourceKey },
    select: { id: true, qrCode: true },
  });
  if (existing) {
    return { id: existing.id, qrCode: existing.qrCode ?? '', reused: true };
  }
  const qrCode = await allocateFabricBundleQr(input.tx, 'STOCK');
  const lot = await input.tx.inventoryLot.create({
    data: {
      inventoryItemId: input.inventoryItemId,
      warehouseId: input.warehouseId,
      locationId: input.locationId ?? undefined,
      quantity: new Prisma.Decimal(input.qty),
      remainingQty: new Prisma.Decimal(input.qty),
      status: InventoryLotStatus.AVAILABLE,
      allocationMode: InventoryAllocationMode.GENERAL_STOCK,
      sourceKey: input.sourceKey,
      qrCode,
      supplierId: input.supplierId ?? undefined,
      purchaseOrderId: input.purchaseOrderId ?? undefined,
      goodsReceiptId: input.goodsReceiptId ?? undefined,
      unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : undefined,
      photoDocumentId: input.photoDocumentId ?? undefined,
    },
  });
  return { id: lot.id, qrCode, reused: false };
}

/** Idempotent leftover stock key — same order lot + task + qty reuses the FB-STOCK bundle. */
export function leftoverFabricSourceKey(orderLotId: string, taskId: string, qty: number): string {
  const n = Math.round((Number(qty) || 0) * 1000) / 1000;
  return `fabric-leftover:${orderLotId}:${taskId}:${n}`;
}

/** Leftover metres become a GENERAL_STOCK inventory lot, not extra qty on the order bundle. */
export async function recordLeftoverFabricAsGeneralStock(input: {
  tx: Tx;
  orderLotId: string;
  taskId: string;
  inventoryItemId: string;
  warehouseId: string;
  locationId?: string | null;
  qty: number;
  unitCost?: number | null;
}): Promise<{ id: string; qrCode: string; reused: boolean }> {
  return createGeneralStockFabricLot({
    tx: input.tx,
    sourceKey: leftoverFabricSourceKey(input.orderLotId, input.taskId, input.qty),
    inventoryItemId: input.inventoryItemId,
    warehouseId: input.warehouseId,
    locationId: input.locationId,
    qty: input.qty,
    unitCost: input.unitCost,
  });
}

/**
 * Create ORDER_ALLOCATED fabric lots for GRN lines that carry a fabric procurement.
 * Existing PURCHASE_RECEIPT movements stay untouched — no double entry.
 */
export async function createFabricLotsForGoodsReceipt(input: {
  tx: Tx;
  goodsReceiptId: string;
  purchaseOrderId: string;
  supplierId: string;
  warehouseId: string;
  locationId?: string | null;
  salesOrderNumber?: string | null;
  photoDocumentId?: string | null;
  lines: FabricReceiptLineInput[];
}): Promise<Array<{ qrCode: string; fabricProcurementId: string }>> {
  const created: Array<{ qrCode: string; fabricProcurementId: string }> = [];
  let seq = 0;
  for (const line of input.lines) {
    if (!(line.acceptedQty > 0)) continue;
    if (!line.fabricProcurementId) continue;
    if (String(line.category ?? '').toUpperCase() !== 'FABRIC') continue;

    seq += 1;
    const lot = await createOrderAllocatedFabricLot({
      tx: input.tx,
      sourceKey: `grn:${input.goodsReceiptId}:${line.fabricProcurementId}:${seq}`,
      inventoryItemId: line.inventoryItemId,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      salesOrderId: line.salesOrderId,
      salesOrderLineId: line.salesOrderLineId,
      productionOrderId: line.productionOrderId,
      qty: line.acceptedQty,
      unitCost: line.unitCost,
      fabricProcurementId: line.fabricProcurementId,
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      goodsReceiptId: input.goodsReceiptId,
      salesOrderNumber: input.salesOrderNumber,
      photoDocumentId: input.photoDocumentId,
    });
    if (lot.qrCode) {
      created.push({ qrCode: lot.qrCode, fabricProcurementId: line.fabricProcurementId });
    }
  }
  return created;
}
