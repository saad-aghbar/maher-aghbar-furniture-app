import { BadRequestException } from '@nestjs/common';
import { InventoryTxType, PurchaseOrderStatus, Prisma } from '@maher/database';
import { roundMoney } from '../../common/helpers/money.util';
import {
  acceptedReceiptQty,
  isOverReceipt,
  receiptUnitCostFromCatalog,
  remainingOrderedQty,
} from './goods-receipt-cost';
import { createGeneralStockFabricLot } from './goods-receipt-fabric-lots';
import {
  groupReceiptLinesByWarehouse,
  receiptIdempotencyKey,
} from './receivable-queue';

export type ReceiveGoodsLine = {
  inventoryItemId: string;
  orderedQty: number;
  receivedQty: number;
  rejectedQty?: number;
  unitCost?: number;
  batchNumber?: string;
  qualityStatus?: string;
  warehouseId?: string;
  locationId?: string;
};

export type ReceiveGoodsBody = {
  warehouseId?: string;
  locationId?: string;
  photoDocumentId?: string;
  deliveryDocRef?: string;
  notes?: string;
  idempotencyKey?: string;
  lines: ReceiveGoodsLine[];
};

type ReceiveDeps = {
  prisma: any;
  sequences: { next: (code: string, prefix: string) => Promise<string> };
  inventory: any;
  fabricReceiving: any;
  supplierInvoices: any;
};

export async function receivePurchaseOrderGoods(
  deps: ReceiveDeps,
  poId: string,
  body: ReceiveGoodsBody,
  userId: string,
) {
  const po = await deps.prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: poId },
    include: {
      lines: true,
      goodsReceipts: { include: { lines: true } },
      supplier: { select: { id: true } },
    },
  });
  if (
    po.status !== PurchaseOrderStatus.SENT &&
    po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
  ) {
    throw new BadRequestException({
      code: 'BAD_REQUEST',
      message: 'Purchase order is not receivable in current status.',
    });
  }

  const fallbackWarehouseId =
    body.warehouseId ||
    body.lines.find((l) => l.warehouseId)?.warehouseId ||
    po.warehouseId;
  if (!fallbackWarehouseId) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'A warehouse is required to receive goods.',
    });
  }

  const priorAccepted = new Map<string, number>();
  for (const r of po.goodsReceipts) {
    for (const l of r.lines) {
      priorAccepted.set(
        l.inventoryItemId,
        (priorAccepted.get(l.inventoryItemId) ?? 0) +
          Number(l.receivedQty) -
          Number(l.rejectedQty ?? 0),
      );
    }
  }
  const orderedByItem = new Map<string, number>();
  const priceByItem = new Map<string, number>();
  for (const line of po.lines) {
    if (!line.inventoryItemId) continue;
    orderedByItem.set(
      line.inventoryItemId,
      (orderedByItem.get(line.inventoryItemId) ?? 0) + Number(line.quantity),
    );
    priceByItem.set(line.inventoryItemId, Number(line.unitPrice));
  }

  for (const line of body.lines) {
    const received = Number(line.receivedQty) || 0;
    const rejected = Number(line.rejectedQty ?? 0) || 0;
    if (rejected < 0 || received < 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Quantities must be non-negative.',
      });
    }
    if (rejected > received + 1e-9) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Rejected quantity cannot exceed received quantity.',
      });
    }
    const accepted = acceptedReceiptQty(received, rejected);
    if (accepted <= 0) continue;
    const remaining = remainingOrderedQty(
      orderedByItem.get(line.inventoryItemId) ?? 0,
      priorAccepted.get(line.inventoryItemId) ?? 0,
    );
    if (isOverReceipt(accepted, remaining)) {
      throw new BadRequestException({
        code: 'OVER_RECEIPT',
        message: `Cannot receive more than remaining ordered qty for item (${remaining}).`,
      });
    }
  }

  const groups = groupReceiptLinesByWarehouse(
    body.lines.map((line) => ({
      ...line,
      warehouseId: line.warehouseId || fallbackWarehouseId,
    })),
    fallbackWarehouseId,
  );
  if (!groups.size) {
    groups.set(
      fallbackWarehouseId,
      body.lines.map((line) => ({ ...line, warehouseId: fallbackWarehouseId })),
    );
  }

  for (const warehouseId of groups.keys()) {
    const warehouse = await deps.prisma.warehouse.findUniqueOrThrow({
      where: { id: warehouseId },
    });
    if (warehouse.type !== 'RAW_MATERIALS') {
      throw new BadRequestException({
        code: 'WAREHOUSE_TYPE_MISMATCH',
        message: 'Goods receipts must go into a raw materials warehouse.',
      });
    }
  }

  const requestKey = body.idempotencyKey?.trim() || null;
  const existingReceipts = [];
  if (requestKey) {
    for (const warehouseId of groups.keys()) {
      const scoped = receiptIdempotencyKey(requestKey, warehouseId);
      const existing =
        (await deps.prisma.goodsReceipt.findUnique({
          where: { idempotencyKey: scoped },
          include: { lines: { include: { inventoryItem: true } }, warehouse: true },
        })) ||
        (await deps.prisma.goodsReceipt.findUnique({
          where: { idempotencyKey: requestKey },
          include: { lines: { include: { inventoryItem: true } }, warehouse: true },
        }));
      if (existing) {
        if (existing.purchaseOrderId !== poId) {
          throw new BadRequestException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key already used for another purchase order.',
          });
        }
        existingReceipts.push(existing);
      }
    }
    if (existingReceipts.length === groups.size) {
      return { ...existingReceipts[0], receipts: existingReceipts };
    }
  }

  const receipts = await deps.prisma.$transaction(async (tx: any) => {
    const created = [];
    for (const [warehouseId, groupLines] of groups) {
      const scopedKey = receiptIdempotencyKey(requestKey, warehouseId);
      if (scopedKey) {
        const race = await tx.goodsReceipt.findUnique({
          where: { idempotencyKey: scopedKey },
          include: { lines: { include: { inventoryItem: true } }, warehouse: true },
        });
        if (race) {
          created.push(race);
          continue;
        }
      }
      const number = await deps.sequences.next('GRN', 'GRN');
      const itemIds = [...new Set(groupLines.map((l) => l.inventoryItemId))];
      const items = itemIds.length
        ? await tx.inventoryItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, category: true, standardCost: true },
          })
        : [];
      const categoryByItem = new Map(
        items.map((i: { id: string; category: string }) => [i.id, i.category]),
      );
      const standardByItem = new Map<string, number | null>(
        items.map((i: { id: string; standardCost?: unknown }) => [
          i.id,
          i.standardCost != null ? Number(i.standardCost) : null,
        ]),
      );
      const lineCreates = groupLines.map((l) => {
        const received = Number(l.receivedQty) || 0;
        const rejected = Number(l.rejectedQty ?? 0) || 0;
        const accepted = Math.max(0, received - rejected);
        const catalogCost = receiptUnitCostFromCatalog({
          poUnitPrice: priceByItem.get(l.inventoryItemId),
          standardCost: standardByItem.get(l.inventoryItemId),
        });
        const unitCost = catalogCost != null ? Number(roundMoney(catalogCost)) : null;
        const extendedCost =
          unitCost != null && accepted > 0 ? Number(roundMoney(unitCost * accepted)) : null;
        return {
          inventoryItemId: l.inventoryItemId,
          orderedQty: roundMoney(l.orderedQty),
          receivedQty: roundMoney(received),
          rejectedQty: roundMoney(rejected),
          unitCost: unitCost != null ? roundMoney(unitCost) : null,
          extendedCost: extendedCost != null ? roundMoney(extendedCost) : null,
          batchNumber: l.batchNumber,
          qualityStatus: l.qualityStatus,
          warehouseId,
          locationId: l.locationId || body.locationId,
          _accepted: accepted,
          _unitCostNum: unitCost,
        };
      });

      const grn = await tx.goodsReceipt.create({
        data: {
          number,
          purchaseOrderId: poId,
          warehouseId,
          deliveryDocRef: body.deliveryDocRef,
          notes: body.notes,
          createdById: userId,
          ...(scopedKey ? { idempotencyKey: scopedKey } : {}),
          lines: {
            create: lineCreates.map(
              ({ _accepted, _unitCostNum, ...rest }) => rest,
            ),
          },
        },
        include: { lines: { include: { inventoryItem: true } }, warehouse: true },
      });

      for (const prepared of lineCreates) {
        if (prepared._accepted <= 0) continue;
        await deps.inventory.applyMovement({
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: prepared.inventoryItemId,
          warehouseId,
          locationId: prepared.locationId,
          quantity: prepared._accepted,
          unitCost: prepared._unitCostNum ?? undefined,
          userId,
          referenceType: 'GoodsReceipt',
          referenceId: grn.id,
          notes: `GRN ${number}`,
          idempotencyKey: `grn:${grn.id}:${prepared.inventoryItemId}`,
          db: tx,
        });
      }

      const unusedPoLines = [...po.lines];
      const fabricLines = lineCreates.flatMap((prepared) => {
        if (prepared._accepted <= 0) return [];
        const matchIdx = unusedPoLines.findIndex(
          (l: { inventoryItemId: string | null; fabricProcurementId: string | null }) =>
            l.inventoryItemId === prepared.inventoryItemId && l.fabricProcurementId,
        );
        const match = matchIdx >= 0 ? unusedPoLines.splice(matchIdx, 1)[0] : null;
        return [
          {
            inventoryItemId: prepared.inventoryItemId,
            acceptedQty: prepared._accepted,
            unitCost: prepared._unitCostNum,
            category: categoryByItem.get(prepared.inventoryItemId) ?? null,
            fabricProcurementId: match?.fabricProcurementId ?? null,
            salesOrderId: match?.salesOrderId,
            salesOrderLineId: match?.salesOrderLineId,
            locationId: prepared.locationId,
          },
        ];
      });
      const allocated = fabricLines.filter((l) => l.fabricProcurementId);
      if (allocated.length) {
        const soIds = [...new Set(allocated.map((l) => l.salesOrderId).filter(Boolean))] as string[];
        const so = soIds.length
          ? await tx.salesOrder.findFirst({
              where: { id: { in: soIds } },
              select: { number: true },
            })
          : null;
        await deps.fabricReceiving.attachLotsFromGoodsReceipt({
          tx,
          goodsReceiptId: grn.id,
          goodsReceiptNumber: number,
          purchaseOrderId: poId,
          supplierId: po.supplierId,
          warehouseId,
          locationId: body.locationId ?? null,
          salesOrderNumber: so?.number ?? null,
          photoDocumentId: body.photoDocumentId ?? null,
          lines: allocated,
          userId,
        });
      }
      for (const line of fabricLines) {
        if (line.fabricProcurementId) continue;
        if (String(line.category ?? '').toUpperCase() !== 'FABRIC') continue;
        if (!(line.acceptedQty > 0)) continue;
        await createGeneralStockFabricLot({
          tx,
          sourceKey: `grn:${grn.id}:${line.inventoryItemId}:general`,
          inventoryItemId: line.inventoryItemId,
          warehouseId,
          locationId: line.locationId ?? body.locationId ?? null,
          qty: line.acceptedQty,
          unitCost: line.unitCost,
          supplierId: po.supplierId,
          purchaseOrderId: poId,
          goodsReceiptId: grn.id,
          photoDocumentId: body.photoDocumentId ?? null,
        });
      }

      created.push(grn);
    }

    const allReceipts = await tx.goodsReceipt.findMany({
      where: { purchaseOrderId: poId },
      include: { lines: true },
    });
    const receivedByItem = new Map<string, number>();
    for (const r of allReceipts) {
      for (const l of r.lines) {
        receivedByItem.set(
          l.inventoryItemId,
          (receivedByItem.get(l.inventoryItemId) ?? 0) +
            Number(l.receivedQty) -
            Number(l.rejectedQty ?? 0),
        );
      }
    }
    const fullyReceived = po.lines.every((line: { inventoryItemId: string | null; quantity: Prisma.Decimal }) => {
      if (!line.inventoryItemId) return true;
      return (receivedByItem.get(line.inventoryItemId) ?? 0) + 1e-9 >= Number(line.quantity);
    });
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: fullyReceived
          ? PurchaseOrderStatus.RECEIVED
          : PurchaseOrderStatus.PARTIALLY_RECEIVED,
      },
    });
    return created;
    // Multi-warehouse receive + lot/balance writes routinely exceed Prisma's 5s default.
  }, { maxWait: 10_000, timeout: 20_000 });

  const first = receipts[0];
  if (first) {
    await deps.prisma.auditEvent.create({
      data: {
        userId,
        action: 'goods-receipt.create',
        entityType: 'GoodsReceipt',
        entityId: first.id,
        newValues: { purchaseOrderId: poId, receiptCount: receipts.length },
      },
    });
  }

  await Promise.resolve(deps.inventory.retryWaitingMaterialOrders(userId)).catch(
    () => undefined,
  );
  if (first) {
    await deps.supplierInvoices
      .ensureFromPurchaseOrder(poId, userId, first.id)
      .catch(() => undefined);
  }

  return { ...first, receipts };
}
