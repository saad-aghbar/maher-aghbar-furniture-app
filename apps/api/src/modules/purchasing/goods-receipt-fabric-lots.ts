import { InventoryAllocationMode, InventoryLotStatus, Prisma } from '@maher/database';

type Tx = Prisma.TransactionClient;

export async function allocateFabricBundleQr(
  tx: Tx,
  salesOrderNumber: string,
): Promise<string> {
  const compact = String(salesOrderNumber || 'SO')
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
};

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
    const sourceKey = `grn:${input.goodsReceiptId}:${line.fabricProcurementId}:${seq}`;
    const existing = await input.tx.inventoryLot.findFirst({
      where: { sourceKey },
      select: { id: true, qrCode: true },
    });
    if (existing) {
      if (existing.qrCode) {
        created.push({ qrCode: existing.qrCode, fabricProcurementId: line.fabricProcurementId });
      }
      continue;
    }

    const qrCode = await allocateFabricBundleQr(
      input.tx,
      input.salesOrderNumber ?? 'SO',
    );
    await input.tx.inventoryLot.create({
      data: {
        inventoryItemId: line.inventoryItemId,
        warehouseId: input.warehouseId,
        locationId: input.locationId ?? undefined,
        salesOrderId: line.salesOrderId ?? undefined,
        salesOrderLineId: line.salesOrderLineId ?? undefined,
        quantity: new Prisma.Decimal(line.acceptedQty),
        remainingQty: new Prisma.Decimal(line.acceptedQty),
        status: InventoryLotStatus.AVAILABLE,
        allocationMode: InventoryAllocationMode.ORDER_ALLOCATED,
        sourceKey,
        qrCode,
        fabricProcurementId: line.fabricProcurementId,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId,
        goodsReceiptId: input.goodsReceiptId,
        unitCost: line.unitCost != null ? new Prisma.Decimal(line.unitCost) : undefined,
        photoDocumentId: input.photoDocumentId ?? undefined,
      },
    });
    created.push({ qrCode, fabricProcurementId: line.fabricProcurementId });
  }
  return created;
}
