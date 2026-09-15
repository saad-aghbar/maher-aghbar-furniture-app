import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  FabricProcurementEventKind,
  FabricProcurementState,
  InventoryTxType,
  Prisma,
  PurchaseOrderStatus,
} from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { roundMoney } from '../../common/helpers/money.util';
import { InventoryService } from '../inventory/inventory.service';
import { SupplierInvoicesService } from '../supplier-invoices/supplier-invoices.service';
import {
  acceptedReceiptQty,
  isOverReceipt,
  remainingOrderedQty,
} from './goods-receipt-cost';
import {
  createFabricLotsForGoodsReceipt,
  createOrderAllocatedFabricLot,
  type FabricReceiptLineInput,
} from './goods-receipt-fabric-lots';
import { requireFabricUnitCost } from './fabric-cost';
import { FabricProcurementService } from './fabric-procurement.service';
import { OpsNotifyService } from '../notifications/ops-notify.service';

export type FabricReceiveInput = {
  qty: number;
  locationId: string;
  unitCost?: number;
  note?: string;
  photoDocumentId?: string;
  inventoryItemId?: string;
  idempotencyKey?: string;
};

export type FabricAllocateFromStockInput = {
  inventoryItemId: string;
  qty: number;
  locationId?: string;
  warehouseId?: string;
  replaceFabric?: boolean;
  reason?: string;
};

@Injectable()
export class FabricReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventory: InventoryService,
    private readonly fabrics: FabricProcurementService,
    private readonly supplierInvoices: SupplierInvoicesService,
    @Optional() private readonly opsNotify?: OpsNotifyService,
  ) {}

  async attachLotsFromGoodsReceipt(input: {
    tx: Prisma.TransactionClient;
    goodsReceiptId: string;
    goodsReceiptNumber: string;
    purchaseOrderId: string;
    supplierId: string;
    warehouseId: string;
    locationId?: string | null;
    salesOrderNumber?: string | null;
    photoDocumentId?: string | null;
    lines: FabricReceiptLineInput[];
    userId: string;
  }) {
    const lots = await createFabricLotsForGoodsReceipt({
      tx: input.tx,
      goodsReceiptId: input.goodsReceiptId,
      purchaseOrderId: input.purchaseOrderId,
      supplierId: input.supplierId,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      salesOrderNumber: input.salesOrderNumber,
      photoDocumentId: input.photoDocumentId,
      lines: input.lines,
    });
    const seen = new Set<string>();
    for (const line of input.lines) {
      if (!line.fabricProcurementId || seen.has(line.fabricProcurementId)) continue;
      seen.add(line.fabricProcurementId);
      await input.tx.fabricProcurement.update({
        where: { id: line.fabricProcurementId },
        data: { state: FabricProcurementState.READY_FOR_PICKUP },
      });
      await input.tx.fabricProcurementEvent.create({
        data: {
          procurementId: line.fabricProcurementId,
          kind: FabricProcurementEventKind.RECEIVED,
          userId: input.userId,
          note: input.goodsReceiptNumber ? `GRN ${input.goodsReceiptNumber}` : 'Received',
          payload: {
            goodsReceiptId: input.goodsReceiptId,
            qty: line.acceptedQty,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return lots;
  }

  async receive(id: string, input: FabricReceiveInput, user: AuthUser) {
    const qty = Number(input.qty);
    if (!(qty > 0)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantity must be positive.' });
    }
    const row = await this.prisma.fabricProcurement.findUnique({
      where: { id },
      include: {
        requirement: {
          select: {
            inventoryItemId: true,
            category: true,
            expectedQty: true,
          },
        },
        salesOrder: { select: { number: true } },
        productionOrder: { select: { number: true } },
        lots: { select: { remainingQty: true, quantity: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fabric procurement not found.' });

    const location = await this.prisma.warehouseLocation.findUnique({
      where: { id: input.locationId },
      include: { warehouse: true },
    });
    if (!location) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Holding location is required.' });
    }
    if (location.warehouse.type !== 'RAW_MATERIALS') {
      throw new BadRequestException({
        code: 'WAREHOUSE_TYPE_MISMATCH',
        message: 'Fabric must be received into a raw materials warehouse.',
      });
    }

    const itemId = input.inventoryItemId ?? row.requirement.inventoryItemId;
    if (!itemId) {
      throw new BadRequestException({
        code: 'FABRIC_ITEM_REQUIRED',
        message: 'Choose a fabric SKU before confirming arrival.',
      });
    }
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { id: true, category: true, standardCost: true },
    });
    if (!item || String(item.category).toUpperCase() !== 'FABRIC') {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'Arrival must be a fabric SKU.',
      });
    }

    const requestKey = input.idempotencyKey?.trim() || `fabric-receive:${id}:${qty}:${input.locationId}`;

    if (row.purchaseOrderId) {
      await this.receiveAgainstPurchaseOrder({
        procurementId: id,
        purchaseOrderId: row.purchaseOrderId,
        inventoryItemId: itemId,
        qty,
        locationId: location.id,
        warehouseId: location.warehouseId,
        standardCost: Number(item.standardCost),
        note: input.note,
        photoDocumentId: input.photoDocumentId,
        idempotencyKey: requestKey,
        user,
        salesOrderNumber: row.salesOrder?.number ?? row.productionOrder?.number ?? 'WO',
        salesOrderId: row.salesOrderId,
        salesOrderLineId: row.salesOrderLineId,
        productionOrderId: row.productionOrderId,
      });
    } else {
      await this.receiveWithoutPurchaseOrder({
        procurementId: id,
        inventoryItemId: itemId,
        qty,
        locationId: location.id,
        warehouseId: location.warehouseId,
        standardCost: Number(item.standardCost),
        note: input.note,
        photoDocumentId: input.photoDocumentId,
        idempotencyKey: requestKey,
        user,
        salesOrderNumber: row.salesOrder?.number ?? row.productionOrder?.number ?? 'WO',
        salesOrderId: row.salesOrderId,
        salesOrderLineId: row.salesOrderLineId,
        productionOrderId: row.productionOrderId,
        supplierId: row.supplierId,
        bindItem: !row.requirement.inventoryItemId,
      });
    }

    return this.fabrics.getById(id, user);
  }

  async allocateFromStock(id: string, input: FabricAllocateFromStockInput, user: AuthUser) {
    const qty = Number(input.qty);
    if (!(qty > 0)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantity must be positive.' });
    }
    const row = await this.prisma.fabricProcurement.findUnique({
      where: { id },
      include: {
        requirement: { select: { inventoryItemId: true, sku: true, displayName: true } },
        salesOrder: { select: { number: true } },
        productionOrder: { select: { number: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fabric procurement not found.' });

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: input.inventoryItemId },
      select: { id: true, category: true, standardCost: true, sku: true, nameEn: true },
    });
    if (!item || String(item.category).toUpperCase() !== 'FABRIC') {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'Take-from-stock must be a fabric SKU.',
      });
    }
    const boundId = row.requirement.inventoryItemId;
    const replacing = Boolean(boundId && boundId !== item.id);
    if (replacing && !input.replaceFabric) {
      throw new BadRequestException({
        code: 'FABRIC_WRONG_RECEIVED',
        message: 'This roll is the wrong fabric for the order.',
      });
    }
    const replaceReason = (input.reason ?? '').trim();
    if (replacing && replaceReason.length < 3) {
      throw new BadRequestException({
        code: 'REASON_REQUIRED',
        message: 'Enter a reason of at least 3 characters.',
      });
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where: { inventoryItemId: item.id },
    });
    const freeOf = (b: (typeof balances)[number]) =>
      Number(b.availableQty) - Number(b.reservedQty);
    const picked =
      (input.locationId
        ? balances.find((b) => b.locationId === input.locationId)
        : null) ??
      (input.warehouseId
        ? balances
            .filter((b) => b.warehouseId === input.warehouseId)
            .sort((a, b) => freeOf(b) - freeOf(a))[0]
        : null) ??
      [...balances].sort((a, b) => freeOf(b) - freeOf(a))[0];
    if (!picked || freeOf(picked) + 1e-9 < qty) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Not enough free fabric to allocate to this order.',
      });
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: picked.warehouseId },
    });
    if (!warehouse || warehouse.type !== 'RAW_MATERIALS') {
      throw new BadRequestException({
        code: 'WAREHOUSE_TYPE_MISMATCH',
        message: 'Fabric stock must come from a raw materials warehouse.',
      });
    }

    const sourceKey = `fabric-alloc:${id}:${item.id}:${qty}:${picked.locationId ?? 'none'}`;
    const existingLot = await this.prisma.inventoryLot.findFirst({
      where: { sourceKey },
      select: { id: true },
    });
    if (existingLot) {
      return this.fabrics.getById(id, user);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.applyMovement({
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: item.id,
        warehouseId: picked.warehouseId,
        locationId: picked.locationId,
        quantity: 0,
        reservedDelta: qty,
        userId: user.id,
        notes: `Reserve fabric for ${row.salesOrder?.number ?? row.productionOrder?.number ?? 'WO'}`,
        referenceType: 'FabricProcurement',
        referenceId: id,
        idempotencyKey: sourceKey,
        db: tx,
      });
      await createOrderAllocatedFabricLot({
        tx,
        sourceKey,
        inventoryItemId: item.id,
        warehouseId: picked.warehouseId,
        locationId: picked.locationId,
        salesOrderId: row.salesOrderId,
        salesOrderLineId: row.salesOrderLineId,
        productionOrderId: row.productionOrderId,
        qty,
        unitCost: requireFabricUnitCost({
          standardCost: item.standardCost != null ? Number(item.standardCost) : null,
        }),
        fabricProcurementId: id,
        supplierId: row.supplierId,
        salesOrderNumber: row.salesOrder?.number ?? row.productionOrder?.number ?? 'WO',
      });
      if (!boundId || replacing) {
        await tx.salesOrderLineMaterialRequirement.update({
          where: { id: row.requirementId },
          data: {
            inventoryItemId: item.id,
            sku: item.sku,
            displayName: item.nameEn,
          },
        });
      }
      await tx.fabricProcurement.update({
        where: { id },
        data: { state: FabricProcurementState.READY_FOR_PICKUP },
      });
      if (replacing) {
        await tx.fabricProcurementEvent.create({
          data: {
            procurementId: id,
            kind: FabricProcurementEventKind.FABRIC_CHANGED,
            userId: user.id,
            note: replaceReason,
            payload: {
              fromInventoryItemId: boundId,
              toInventoryItemId: item.id,
              reason: replaceReason,
              qty,
            } as Prisma.InputJsonValue,
          },
        });
      }
      await tx.fabricProcurementEvent.create({
        data: {
          procurementId: id,
          kind: FabricProcurementEventKind.RECEIVED,
          userId: user.id,
          note: 'Taken from general stock',
          payload: {
            inventoryItemId: item.id,
            qty,
            locationId: picked.locationId,
            reserved: true,
          } as Prisma.InputJsonValue,
        },
      });
    });

    await this.opsNotify
      ?.onFabric({
        id,
        eventKind: FabricProcurementEventKind.RECEIVED,
        state: FabricProcurementState.READY_FOR_PICKUP,
        actorUserId: user.id,
      })
      .catch(() => undefined);
    return this.fabrics.getById(id, user);
  }

  private async receiveAgainstPurchaseOrder(params: {
    procurementId: string;
    purchaseOrderId: string;
    inventoryItemId: string;
    qty: number;
    locationId: string;
    warehouseId: string;
    standardCost?: number;
    note?: string;
    photoDocumentId?: string;
    idempotencyKey: string;
    user: AuthUser;
    salesOrderNumber: string;
    salesOrderId: string | null;
    salesOrderLineId: string | null;
    productionOrderId?: string | null;
  }) {
    const existing = await this.prisma.goodsReceipt.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true, purchaseOrderId: true },
    });
    if (existing) {
      if (existing.purchaseOrderId !== params.purchaseOrderId) {
        throw new BadRequestException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key already used for another purchase order.',
        });
      }
      return;
    }

    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: params.purchaseOrderId },
      include: {
        lines: true,
        goodsReceipts: { include: { lines: true } },
      },
    });
    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED &&
      po.status !== PurchaseOrderStatus.DRAFT
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase order is not receivable in current status.',
      });
    }

    const poLine =
      po.lines.find((l) => l.fabricProcurementId === params.procurementId) ??
      po.lines.find((l) => l.inventoryItemId === params.inventoryItemId);
    if (!poLine?.inventoryItemId && !params.inventoryItemId) {
      throw new BadRequestException({
        code: 'FABRIC_ITEM_REQUIRED',
        message: 'Choose a fabric SKU before confirming arrival.',
      });
    }
    const inventoryItemId = poLine?.inventoryItemId ?? params.inventoryItemId;

    const priorAccepted = new Map<string, number>();
    for (const r of po.goodsReceipts) {
      for (const l of r.lines) {
        const prev = priorAccepted.get(l.inventoryItemId) ?? 0;
        priorAccepted.set(l.inventoryItemId, prev + acceptedReceiptQty(Number(l.receivedQty), Number(l.rejectedQty ?? 0)));
      }
    }
    const ordered = po.lines
      .filter((l) => l.inventoryItemId === inventoryItemId)
      .reduce((s, l) => s + Number(l.quantity), 0);
    const remaining = remainingOrderedQty(ordered, priorAccepted.get(inventoryItemId) ?? 0);
    if (ordered > 0 && isOverReceipt(params.qty, remaining)) {
      throw new BadRequestException({
        code: 'OVER_RECEIPT',
        message: `Cannot receive more than remaining ordered qty for item (${remaining}).`,
      });
    }

    const number = await this.sequences.next('GRN', 'GRN');
    const unitCost = requireFabricUnitCost({
      poUnitPrice: poLine?.unitPrice != null ? Number(poLine.unitPrice) : null,
      standardCost: params.standardCost,
    });
    const accepted = params.qty;
    const extendedCost =
      unitCost != null && accepted > 0 ? Number(roundMoney(unitCost * accepted)) : null;

    const receipt = await this.prisma.$transaction(async (tx) => {
      const race = await tx.goodsReceipt.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (race) return race;

      const grn = await tx.goodsReceipt.create({
        data: {
          number,
          purchaseOrderId: po.id,
          warehouseId: params.warehouseId,
          notes: params.note,
          createdById: params.user.id,
          idempotencyKey: params.idempotencyKey,
          lines: {
            create: [
              {
                inventoryItemId,
                orderedQty: roundMoney(poLine ? Number(poLine.quantity) : accepted),
                receivedQty: roundMoney(accepted),
                rejectedQty: roundMoney(0),
                unitCost: unitCost != null ? roundMoney(unitCost) : null,
                extendedCost: extendedCost != null ? roundMoney(extendedCost) : null,
              },
            ],
          },
        },
      });

      await this.inventory.applyMovement({
        type: InventoryTxType.PURCHASE_RECEIPT,
        inventoryItemId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        quantity: accepted,
        unitCost: unitCost ?? undefined,
        userId: params.user.id,
        referenceType: 'GoodsReceipt',
        referenceId: grn.id,
        notes: `GRN ${number}`,
        idempotencyKey: `grn:${grn.id}:${inventoryItemId}`,
        db: tx,
      });

      await this.attachLotsFromGoodsReceipt({
        tx,
        goodsReceiptId: grn.id,
        goodsReceiptNumber: number,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        salesOrderNumber: params.salesOrderNumber,
        photoDocumentId: params.photoDocumentId,
        lines: [
          {
            inventoryItemId,
            acceptedQty: accepted,
            unitCost,
            category: 'FABRIC',
            fabricProcurementId: params.procurementId,
            salesOrderId: params.salesOrderId,
            salesOrderLineId: params.salesOrderLineId,
            productionOrderId: params.productionOrderId,
          },
        ],
        userId: params.user.id,
      });

      const allReceipts = await tx.goodsReceipt.findMany({
        where: { purchaseOrderId: po.id },
        include: { lines: true },
      });
      const receivedByItem = new Map<string, number>();
      for (const r of allReceipts) {
        for (const l of r.lines) {
          const prev = receivedByItem.get(l.inventoryItemId) ?? 0;
          receivedByItem.set(
            l.inventoryItemId,
            prev + Number(l.receivedQty) - Number(l.rejectedQty ?? 0),
          );
        }
      }
      const fullyReceived = po.lines.every((line) => {
        if (!line.inventoryItemId) return true;
        const got = receivedByItem.get(line.inventoryItemId) ?? 0;
        return got + 1e-9 >= Number(line.quantity);
      });
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: fullyReceived
            ? PurchaseOrderStatus.RECEIVED
            : PurchaseOrderStatus.PARTIALLY_RECEIVED,
        },
      });

      return grn;
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: params.user.id,
        action: 'goods-receipt.create',
        entityType: 'GoodsReceipt',
        entityId: receipt.id,
        newValues: { purchaseOrderId: po.id, fabricProcurementId: params.procurementId },
      },
    });
    await this.inventory.retryWaitingMaterialOrders(params.user.id).catch(() => undefined);
    await this.supplierInvoices
      .ensureFromPurchaseOrder(po.id, params.user.id, receipt.id)
      .catch(() => undefined);
  }

  private async receiveWithoutPurchaseOrder(params: {
    procurementId: string;
    inventoryItemId: string;
    qty: number;
    locationId: string;
    warehouseId: string;
    standardCost?: number;
    note?: string;
    photoDocumentId?: string;
    idempotencyKey: string;
    user: AuthUser;
    salesOrderNumber: string;
    salesOrderId: string | null;
    salesOrderLineId: string | null;
    productionOrderId?: string | null;
    supplierId: string | null;
    bindItem: boolean;
  }) {
    const unitCost = requireFabricUnitCost({
      standardCost: params.standardCost,
    });
    const existingTx = await this.prisma.inventoryTransaction.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      select: { id: true },
    });
    if (existingTx) return;

    const lotCount = await this.prisma.inventoryLot.count({
      where: { fabricProcurementId: params.procurementId },
    });
    const seq = lotCount + 1;
    const sourceKey = `fabric-receive:${params.procurementId}:${seq}`;

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.applyMovement({
        type: InventoryTxType.PURCHASE_RECEIPT,
        inventoryItemId: params.inventoryItemId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        quantity: params.qty,
        unitCost,
        userId: params.user.id,
        notes: params.note ?? `Fabric receive ${params.salesOrderNumber}`,
        referenceType: 'FabricProcurement',
        referenceId: params.procurementId,
        idempotencyKey: params.idempotencyKey,
        db: tx,
      });
      await createOrderAllocatedFabricLot({
        tx,
        sourceKey,
        inventoryItemId: params.inventoryItemId,
        warehouseId: params.warehouseId,
        locationId: params.locationId,
        salesOrderId: params.salesOrderId,
        salesOrderLineId: params.salesOrderLineId,
        productionOrderId: params.productionOrderId,
        qty: params.qty,
        unitCost,
        fabricProcurementId: params.procurementId,
        supplierId: params.supplierId,
        salesOrderNumber: params.salesOrderNumber,
        photoDocumentId: params.photoDocumentId,
      });
      if (params.bindItem) {
        await tx.salesOrderLineMaterialRequirement.update({
          where: { id: (await tx.fabricProcurement.findUniqueOrThrow({
            where: { id: params.procurementId },
            select: { requirementId: true },
          })).requirementId },
          data: { inventoryItemId: params.inventoryItemId },
        });
      }
      await tx.fabricProcurement.update({
        where: { id: params.procurementId },
        data: { state: FabricProcurementState.READY_FOR_PICKUP },
      });
      await tx.fabricProcurementEvent.create({
        data: {
          procurementId: params.procurementId,
          kind: FabricProcurementEventKind.RECEIVED,
          userId: params.user.id,
          note: params.note ?? 'Received without purchase order',
          payload: {
            qty: params.qty,
            locationId: params.locationId,
            inventoryItemId: params.inventoryItemId,
          } as Prisma.InputJsonValue,
        },
      });
    });
    await this.opsNotify
      ?.onFabric({
        id: params.procurementId,
        eventKind: FabricProcurementEventKind.RECEIVED,
        state: FabricProcurementState.READY_FOR_PICKUP,
        actorUserId: params.user.id,
      })
      .catch(() => undefined);
  }
}
