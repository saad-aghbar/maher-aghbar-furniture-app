import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InventoryAllocationMode,
  InventoryItemClass,
  InventoryLotStatus,
  InventoryTracking,
  InventoryTxType,
  Prisma,
  QualityResult,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { skuPrefixForItemClass } from '../../common/helpers/inventory-lifecycle.util';
import { nextSkuFromExisting } from '../../common/helpers/inventory-category.util';
import { bomReservationNeeds } from '../../common/helpers/inventory-reservation.util';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import {
  outputQtyForOrder,
  type ResolvedStageOutput,
} from './product-inventory-output.resolver';
import { jsonIdList } from '../../common/helpers/inventory-stage-behavior.util';

const QC_PASS: QualityResult[] = [QualityResult.PASSED, QualityResult.PASSED_WITH_NOTES];

type Tx = Prisma.TransactionClient;

type SnapshotNode = {
  id: string;
  inventoryTracking: InventoryTracking;
  consumesRawMaterials: boolean;
  consumesSemiFinished: boolean;
  requiresInspection: boolean;
  outputQtyPerUnit: Prisma.Decimal | null;
  outputNameAr: string | null;
  outputNameEn: string | null;
  outputNameHe: string | null;
  outputUnit?: string | null;
  outputDefinitionId?: string | null;
  outputInventoryItemId?: string | null;
  consumeInventoryItemIds?: Prisma.JsonValue | null;
  consumeOutputDefinitionIds?: Prisma.JsonValue | null;
  defaultWarehouseId: string | null;
  sourceWorkflowNodeId: string | null;
  stageDefinitionId: string | null;
  stageInstanceId: string | null;
  isSkipped: boolean;
};

type ProductionOrderRow = {
  id: string;
  quantity: Prisma.Decimal;
  productId: string | null;
  product: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
    bomDefaults?: Prisma.JsonValue;
  } | null;
  salesOrderId: string | null;
  salesOrderLineId: string | null;
  productDescription: string;
};

@Injectable()
export class ProductionInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async onStageTaskComplete(params: {
    productionOrderId: string;
    stageInstanceId: string | null;
    userId: string;
    tx: Tx;
  }) {
    if (!params.stageInstanceId) return;
    const stageInstanceId = params.stageInstanceId;
    const remaining = await params.tx.productionTask.count({
      where: {
        stageInstanceId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });
    if (remaining > 0) return;

    const snap = await params.tx.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId },
    });
    if (!snap || snap.isSkipped) return;
    if (
      snap.inventoryTracking === InventoryTracking.NONE &&
      !snap.consumesRawMaterials &&
      !snap.consumesSemiFinished
    ) {
      return;
    }

    const po = await params.tx.productionOrder.findUniqueOrThrow({
      where: { id: params.productionOrderId },
      include: { product: true, salesOrderLine: true },
    });
    const qty = Number(po.quantity) || 1;

    if (snap.consumesRawMaterials) {
      await this.consumeRawMaterials(
        {
          tx: params.tx,
          userId: params.userId,
          stageInstanceId,
          productionOrderId: params.productionOrderId,
        },
        po,
        qty,
      );
    }
    if (snap.consumesSemiFinished) {
      await this.consumeSemiFinished(
        { tx: params.tx, userId: params.userId, stageInstanceId },
        po.id,
        qty,
        snap,
      );
    }
    if (snap.inventoryTracking === InventoryTracking.PRODUCES_SEMI_FINISHED) {
      await this.produceOutput(
        {
          tx: params.tx,
          userId: params.userId,
          productionOrderId: params.productionOrderId,
          stageInstanceId,
        },
        po,
        snap,
        InventoryItemClass.SEMI_FINISHED_GOOD,
        qty,
      );
    }
    if (snap.inventoryTracking === InventoryTracking.PRODUCES_FINISHED) {
      if (snap.requiresInspection && !(await this.hasPassedInspection(params.tx, po.id))) {
        return;
      }
      await this.produceOutput(
        {
          tx: params.tx,
          userId: params.userId,
          productionOrderId: params.productionOrderId,
          stageInstanceId,
        },
        po,
        snap,
        InventoryItemClass.FINISHED_GOOD,
        qty,
      );
    }
  }

  async assertStageInventoryReady(params: {
    productionOrderId: string;
    stageInstanceId: string | null;
    tx?: Tx;
  }) {
    if (!params.stageInstanceId) return;
    const db = params.tx ?? this.prisma;
    const snap = await db.productionOrderWorkflowSnapshotNode.findFirst({
      where: { stageInstanceId: params.stageInstanceId },
    });
    if (!snap || snap.isSkipped) return;
    const po = await db.productionOrder.findUniqueOrThrow({
      where: { id: params.productionOrderId },
      include: { product: true },
    });
    const qty = Number(po.quantity) || 1;
    if (snap.consumesRawMaterials) {
      await this.assertRawReady(db, po, qty);
    }
    if (snap.consumesSemiFinished) {
      await this.assertSemiFinishedReady(db, po.id, qty, snap);
    }
  }

  async onInspectionPassed(params: {
    productionOrderId: string;
    userId: string;
    tx: Tx;
  }) {
    if (!(await this.hasPassedInspection(params.tx, params.productionOrderId))) return;
    const snaps = await params.tx.productionOrderWorkflowSnapshotNode.findMany({
      where: {
        snapshot: { productionOrderId: params.productionOrderId },
        inventoryTracking: InventoryTracking.PRODUCES_FINISHED,
        isSkipped: false,
      },
    });
    const po = await params.tx.productionOrder.findUniqueOrThrow({
      where: { id: params.productionOrderId },
      include: { product: true, salesOrderLine: true },
    });
    const qty = Number(po.quantity) || 1;
    for (const snap of snaps) {
      if (!snap.stageInstanceId) continue;
      const remaining = await params.tx.productionTask.count({
        where: {
          stageInstanceId: snap.stageInstanceId,
          isRework: false,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });
      if (remaining > 0) continue;
      await this.produceOutput(
        {
          tx: params.tx,
          userId: params.userId,
          productionOrderId: po.id,
          stageInstanceId: snap.stageInstanceId,
        },
        po,
        snap,
        InventoryItemClass.FINISHED_GOOD,
        qty,
      );
    }
  }

  async reverseFinishedGoods(params: {
    productionOrderId: string;
    userId: string;
    tx: Tx;
  }) {
    const lots = await params.tx.inventoryLot.findMany({
      where: {
        productionOrderId: params.productionOrderId,
        status: { in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED] },
        inventoryItem: { itemClass: InventoryItemClass.FINISHED_GOOD },
      },
    });
    for (const lot of lots) {
      const qty = Number(lot.quantity);
      await this.inventory.applyMovement({
        type: InventoryTxType.PRODUCTION_ISSUE,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        quantity: qty,
        userId: params.userId,
        idempotencyKey: `fg-reverse:${params.productionOrderId}:${lot.id}`,
        referenceType: 'ProductionOrder',
        referenceId: params.productionOrderId,
        reservedDelta: lot.status === InventoryLotStatus.RESERVED ? -qty : 0,
        locationId: lot.locationId,
        db: params.tx,
      });
      await params.tx.inventoryLot.update({
        where: { id: lot.id },
        data: { status: InventoryLotStatus.CONSUMED },
      });
    }
  }

  async onProductionOrdersCancelled(params: {
    productionOrderIds: string[];
    userId: string;
    tx: Tx;
  }) {
    if (!params.productionOrderIds.length) return;
    await params.tx.inventoryLot.updateMany({
      where: {
        productionOrderId: { in: params.productionOrderIds },
        status: { in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED] },
        inventoryItem: { itemClass: InventoryItemClass.SEMI_FINISHED_GOOD },
      },
      data: {
        status: InventoryLotStatus.REQUIRES_REVIEW,
        allocationMode: InventoryAllocationMode.GENERAL_STOCK,
      },
    });
  }

  async listMaterialActivity(productionOrderId: string) {
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: { referenceType: 'ProductionOrder', referenceId: productionOrderId },
      include: {
        inventoryItem: {
          select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, unit: true },
        },
        warehouse: { select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const byItem = new Map<
      string,
      {
        inventoryItem: (typeof txs)[number]['inventoryItem'];
        issued: number;
        returned: number;
        warehouseId: string | null;
      }
    >();
    for (const row of txs) {
      if (
        row.type !== InventoryTxType.PRODUCTION_ISSUE &&
        row.type !== InventoryTxType.PRODUCTION_RETURN
      ) {
        continue;
      }
      const current = byItem.get(row.inventoryItemId) ?? {
        inventoryItem: row.inventoryItem,
        issued: 0,
        returned: 0,
        warehouseId: row.warehouseId,
      };
      const qty = Math.abs(Number(row.quantity));
      if (row.type === InventoryTxType.PRODUCTION_ISSUE) current.issued += qty;
      if (row.type === InventoryTxType.PRODUCTION_RETURN) current.returned += qty;
      current.warehouseId = row.warehouseId;
      byItem.set(row.inventoryItemId, current);
    }
    const materials = [...byItem.values()].map((row) => ({
      inventoryItem: row.inventoryItem,
      issuedQty: row.issued,
      returnedQty: row.returned,
      returnableQty: Math.max(0, row.issued - row.returned),
      warehouseId: row.warehouseId,
    }));
    return {
      materials,
      transactions: txs.map((row) => ({
        id: row.id,
        number: row.number,
        type: row.type,
        quantity: Number(row.quantity),
        createdAt: row.createdAt,
        inventoryItem: row.inventoryItem,
        warehouse: row.warehouse,
        notes: row.notes,
      })),
    };
  }

  async returnUnusedMaterial(params: {
    productionOrderId: string;
    inventoryItemId: string;
    quantity: number;
    warehouseId?: string | null;
    userId: string;
    idempotencyKey?: string;
  }) {
    const qty = Number(params.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Return quantity must be greater than zero.',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const activity = await this.issuedReturnable(tx, params.productionOrderId, params.inventoryItemId);
      if (qty - activity.returnable > 1e-9) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Cannot return more than the unused quantity issued to this order.',
        });
      }
      const item = await tx.inventoryItem.findUniqueOrThrow({
        where: { id: params.inventoryItemId },
      });
      if (item.itemClass !== InventoryItemClass.RAW_MATERIAL) {
        throw new BadRequestException({
          code: 'WAREHOUSE_TYPE_MISMATCH',
          message: 'Only raw material issued to production can be returned.',
        });
      }
      const warehouse =
        (params.warehouseId
          ? await tx.warehouse.findUnique({ where: { id: params.warehouseId } })
          : null) ??
        (activity.warehouseId
          ? await tx.warehouse.findUnique({ where: { id: activity.warehouseId } })
          : null) ??
        (await tx.warehouse.findFirst({
          where: { type: 'RAW_MATERIALS', isActive: true, isDefault: true },
        })) ??
        (await tx.warehouse.findFirst({ where: { type: 'RAW_MATERIALS', isActive: true } }));
      if (!warehouse || warehouse.type !== 'RAW_MATERIALS') {
        throw new BadRequestException({
          code: 'WAREHOUSE_CONFIGURATION_REQUIRED',
          message: 'No raw-materials warehouse is configured for this return.',
        });
      }
      const key =
        params.idempotencyKey?.trim() ||
        `prod-return:${params.productionOrderId}:${params.inventoryItemId}:${qty}`;
      return this.inventory.applyMovement({
        type: InventoryTxType.PRODUCTION_RETURN,
        inventoryItemId: item.id,
        warehouseId: warehouse.id,
        quantity: qty,
        userId: params.userId,
        idempotencyKey: key,
        referenceType: 'ProductionOrder',
        referenceId: params.productionOrderId,
        notes: 'Unused material returned from production',
        db: tx,
      });
    });
  }

  async hasWipReadyForOrder(productionOrderId: string, tx?: Tx): Promise<boolean> {
    const db = tx ?? this.prisma;
    const snaps = await db.productionOrderWorkflowSnapshotNode.findMany({
      where: { snapshot: { productionOrderId }, isSkipped: false },
    });
    const po = await db.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: { quantity: true },
    });
    const qty = Number(po?.quantity) || 1;
    const consume = snaps.filter((s) => s.consumesSemiFinished);
    if (!consume.length) return true;
    for (const node of consume) {
      const needs = await this.semiFinishedNeeds(db, productionOrderId, qty, node);
      for (const need of needs) {
        const available = await this.availableSemiFinishedQty(db, productionOrderId, need.inventoryItemId);
        if (available + 1e-9 < need.qty) return false;
      }
    }
    return true;
  }

  private async hasPassedInspection(tx: Tx, productionOrderId: string) {
    const latest = await tx.qualityInspection.findFirst({
      where: { productionOrderId, result: { not: null } },
      orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return Boolean(latest?.result && QC_PASS.includes(latest.result));
  }

  private async issuedReturnable(
    tx: Tx,
    productionOrderId: string,
    inventoryItemId: string,
  ) {
    const rows = await tx.inventoryTransaction.findMany({
      where: {
        referenceType: 'ProductionOrder',
        referenceId: productionOrderId,
        inventoryItemId,
        type: { in: [InventoryTxType.PRODUCTION_ISSUE, InventoryTxType.PRODUCTION_RETURN] },
      },
    });
    let issued = 0;
    let returned = 0;
    let warehouseId: string | null = null;
    for (const row of rows) {
      const qty = Math.abs(Number(row.quantity));
      if (row.type === InventoryTxType.PRODUCTION_ISSUE) {
        issued += qty;
        warehouseId = row.warehouseId;
      }
      if (row.type === InventoryTxType.PRODUCTION_RETURN) returned += qty;
    }
    return { issued, returned, returnable: Math.max(0, issued - returned), warehouseId };
  }

  private async assertRawReady(
    db: Tx | PrismaService,
    po: { id: string; product: { bomDefaults: Prisma.JsonValue } | null },
    qty: number,
  ) {
    const needs = bomReservationNeeds((po.product?.bomDefaults ?? null) as BomDefaults | null, qty);
    if (!needs.length) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Required materials are not ready for this task.',
      });
    }
    for (const need of needs) {
      const item = await this.resolveRawItem(db as Tx, need);
      if (!item) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Required materials are not ready for this task.',
        });
      }
      const onHand = await this.rawOnHand(db as Tx, item.id);
      if (onHand + 1e-9 < need.qty) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Required materials are not ready for this task.',
        });
      }
    }
  }

  private async consumeRawMaterials(
    params: { tx: Tx; userId: string; stageInstanceId: string; productionOrderId: string },
    po: { id: string; product: { bomDefaults: Prisma.JsonValue } | null },
    qty: number,
  ) {
    const already = await params.tx.inventoryTransaction.findFirst({
      where: {
        idempotencyKey: {
          startsWith: `raw-issue:${params.productionOrderId}:${params.stageInstanceId}:`,
        },
      },
    });
    if (already) return;

    const needs = bomReservationNeeds((po.product?.bomDefaults ?? null) as BomDefaults | null, qty);
    if (!needs.length) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Required materials are not configured for this stage.',
      });
    }

    const planned: Array<{
      itemId: string;
      warehouseId: string;
      qty: number;
      reserved: number;
    }> = [];
    for (const need of needs) {
      const item = await this.resolveRawItem(params.tx, need);
      if (!item) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Required raw material cannot be resolved for this stage.',
        });
      }
      const balance = await params.tx.inventoryBalance.findFirst({
        where: {
          inventoryItemId: item.id,
          warehouse: { type: 'RAW_MATERIALS', isActive: true },
        },
        orderBy: { availableQty: 'desc' },
      });
      if (!balance || Number(balance.availableQty) + 1e-9 < need.qty) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough raw material to consume for this stage.',
        });
      }
      planned.push({
        itemId: item.id,
        warehouseId: balance.warehouseId,
        qty: need.qty,
        reserved: Number(balance.reservedQty),
      });
    }

    for (const line of planned) {
      await this.inventory.applyMovement({
        type: InventoryTxType.PRODUCTION_ISSUE,
        inventoryItemId: line.itemId,
        warehouseId: line.warehouseId,
        quantity: line.qty,
        userId: params.userId,
        idempotencyKey: `raw-issue:${params.productionOrderId}:${params.stageInstanceId}:${line.itemId}`,
        referenceType: 'ProductionOrder',
        referenceId: po.id,
        reservedDelta: -Math.min(line.qty, line.reserved),
        db: params.tx,
      });
    }
  }

  private async resolveRawItem(
    tx: Tx,
    need: { sku?: string; category?: string },
  ) {
    if (need.sku) {
      return tx.inventoryItem.findFirst({
        where: { sku: need.sku, archivedAt: null, itemClass: InventoryItemClass.RAW_MATERIAL },
      });
    }
    if (need.category) {
      return tx.inventoryItem.findFirst({
        where: {
          category: need.category as never,
          archivedAt: null,
          itemClass: InventoryItemClass.RAW_MATERIAL,
        },
        orderBy: { sku: 'asc' },
      });
    }
    return null;
  }

  private async rawOnHand(tx: Tx, inventoryItemId: string) {
    const balances = await tx.inventoryBalance.findMany({
      where: {
        inventoryItemId,
        warehouse: { type: 'RAW_MATERIALS', isActive: true },
      },
    });
    return balances.reduce((s, b) => s + Number(b.availableQty), 0);
  }

  private async semiFinishedNeeds(
    db: Tx | PrismaService,
    productionOrderId: string,
    orderQty: number,
    snap?: Pick<SnapshotNode, 'consumeInventoryItemIds'>,
  ): Promise<Array<{ inventoryItemId: string | null; qty: number }>> {
    const itemIds = jsonIdList(snap?.consumeInventoryItemIds);
    if (itemIds.length) {
      const producers = await db.productionOrderWorkflowSnapshotNode.findMany({
        where: {
          snapshot: { productionOrderId },
          isSkipped: false,
          outputInventoryItemId: { in: itemIds },
        },
      });
      return itemIds.map((inventoryItemId) => {
        const matches = producers.filter((p) => p.outputInventoryItemId === inventoryItemId);
        const qty = matches.length
          ? matches.reduce(
              (sum, node) => sum + outputQtyForOrder(Number(node.outputQtyPerUnit), orderQty),
              0,
            )
          : orderQty;
        return { inventoryItemId, qty };
      });
    }
    const producers = await db.productionOrderWorkflowSnapshotNode.findMany({
      where: {
        snapshot: { productionOrderId },
        isSkipped: false,
        inventoryTracking: InventoryTracking.PRODUCES_SEMI_FINISHED,
      },
    });
    if (!producers.length) return [{ inventoryItemId: null, qty: orderQty }];
    return [
      {
        inventoryItemId: null,
        qty: producers.reduce(
          (sum, node) => sum + outputQtyForOrder(Number(node.outputQtyPerUnit), orderQty),
          0,
        ),
      },
    ];
  }

  private async availableSemiFinishedQty(
    db: Tx | PrismaService,
    productionOrderId: string,
    inventoryItemId?: string | null,
  ) {
    const lots = await db.inventoryLot.findMany({
      where: {
        productionOrderId,
        status: InventoryLotStatus.AVAILABLE,
        inventoryItem: { itemClass: InventoryItemClass.SEMI_FINISHED_GOOD },
        ...(inventoryItemId ? { inventoryItemId } : {}),
      },
    });
    return lots.reduce((s, lot) => s + Number(lot.quantity), 0);
  }

  private async assertSemiFinishedReady(
    db: Tx | PrismaService,
    productionOrderId: string,
    orderQty: number,
    snap: Pick<SnapshotNode, 'consumeInventoryItemIds'>,
  ) {
    const needs = await this.semiFinishedNeeds(db, productionOrderId, orderQty, snap);
    for (const need of needs) {
      const available = await this.availableSemiFinishedQty(
        db,
        productionOrderId,
        need.inventoryItemId,
      );
      if (available + 1e-9 < need.qty) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_SEMI_FINISHED_STOCK',
          message: 'Not enough semi-finished stock to start or complete this stage.',
        });
      }
    }
  }

  private async consumeSemiFinished(
    params: { tx: Tx; userId: string; stageInstanceId: string },
    productionOrderId: string,
    qty: number,
    snap?: Pick<SnapshotNode, 'consumeInventoryItemIds'>,
  ) {
    const already = await params.tx.inventoryTransaction.findFirst({
      where: {
        idempotencyKey: { startsWith: `semi-issue:${productionOrderId}:${params.stageInstanceId}:` },
      },
    });
    if (already) return;

    const needs = await this.semiFinishedNeeds(params.tx, productionOrderId, qty, snap);
    await this.assertSemiFinishedReady(params.tx, productionOrderId, qty, snap ?? {});

    for (const need of needs) {
      const lots = await params.tx.inventoryLot.findMany({
        where: {
          productionOrderId,
          status: InventoryLotStatus.AVAILABLE,
          inventoryItem: { itemClass: InventoryItemClass.SEMI_FINISHED_GOOD },
          ...(need.inventoryItemId ? { inventoryItemId: need.inventoryItemId } : {}),
        },
        orderBy: { producedAt: 'asc' },
      });
      let remaining = need.qty;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(lot.quantity));
        if (take <= 0) continue;
        const key = `semi-issue:${productionOrderId}:${params.stageInstanceId}:${lot.id}`;
        await this.inventory.applyMovement({
          type: InventoryTxType.SEMI_FINISHED_ISSUE,
          inventoryItemId: lot.inventoryItemId,
          warehouseId: lot.warehouseId,
          quantity: take,
          userId: params.userId,
          idempotencyKey: key,
          referenceType: 'ProductionOrder',
          referenceId: productionOrderId,
          locationId: lot.locationId,
          db: params.tx,
        });
        const nextQty = Number(lot.quantity) - take;
        await params.tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            quantity: nextQty,
            status: nextQty <= 0 ? InventoryLotStatus.CONSUMED : lot.status,
          },
        });
        remaining -= take;
      }
    }
  }

  private async produceOutput(
    params: {
      tx: Tx;
      userId: string;
      productionOrderId: string;
      stageInstanceId: string;
    },
    po: ProductionOrderRow,
    snap: SnapshotNode,
    itemClass: InventoryItemClass,
    productionQty: number,
  ) {
    const qtyPerUnit = Number(snap.outputQtyPerUnit);
    const outputQty = outputQtyForOrder(Number.isFinite(qtyPerUnit) ? qtyPerUnit : 1, productionQty);
    const txType =
      itemClass === InventoryItemClass.FINISHED_GOOD
        ? InventoryTxType.FINISHED_GOODS_RECEIPT
        : InventoryTxType.SEMI_FINISHED_RECEIPT;
    const definitionKey = snap.outputDefinitionId || snap.id;
    const baseKey = `${txType}:${params.productionOrderId}:${params.stageInstanceId}:${definitionKey}`;
    const activeLot = await params.tx.inventoryLot.findFirst({
      where: {
        sourceKey: { startsWith: baseKey },
        status: { in: [InventoryLotStatus.AVAILABLE, InventoryLotStatus.RESERVED] },
      },
    });
    if (activeLot) return;

    const priorCount = await params.tx.inventoryLot.count({
      where: { sourceKey: { startsWith: baseKey } },
    });
    const key = priorCount === 0 ? baseKey : `${baseKey}:r${priorCount}`;

    const warehouse = await this.resolveOutputWarehouse(params.tx, snap, itemClass);
    const nameEn =
      snap.outputNameEn ||
      (itemClass === InventoryItemClass.FINISHED_GOOD
        ? po.product?.nameEn || po.productDescription
        : null);
    const nameAr = snap.outputNameAr || po.product?.nameAr || nameEn;
    if (!nameEn) {
      return;
    }
    const item = snap.outputInventoryItemId
      ? await params.tx.inventoryItem.findUnique({ where: { id: snap.outputInventoryItemId } })
      : null;
    const resolvedItem =
      item ??
      (await this.ensureItem(params.tx, {
        itemClass,
        productId: po.productId,
        nameEn,
        nameAr: nameAr || nameEn,
        nameHe: snap.outputNameHe || po.product?.nameHe,
      }));

    await this.inventory.applyMovement({
      type: txType,
      inventoryItemId: resolvedItem.id,
      warehouseId: warehouse.id,
      quantity: outputQty,
      userId: params.userId,
      idempotencyKey: key,
      referenceType: 'ProductionOrder',
      referenceId: po.id,
      reservedDelta:
        itemClass === InventoryItemClass.FINISHED_GOOD && po.salesOrderId ? outputQty : 0,
      db: params.tx,
    });

    await params.tx.inventoryLot.create({
      data: {
        inventoryItemId: resolvedItem.id,
        warehouseId: warehouse.id,
        productionOrderId: po.id,
        salesOrderId: po.salesOrderId,
        salesOrderLineId: po.salesOrderLineId,
        stageInstanceId: params.stageInstanceId,
        outputDefinitionId: definitionKey,
        quantity: outputQty,
        status:
          itemClass === InventoryItemClass.FINISHED_GOOD && po.salesOrderId
            ? InventoryLotStatus.RESERVED
            : InventoryLotStatus.AVAILABLE,
        allocationMode: po.salesOrderId
          ? InventoryAllocationMode.ORDER_ALLOCATED
          : InventoryAllocationMode.GENERAL_STOCK,
        sourceKey: key,
      },
    });
  }

  private async resolveOutputWarehouse(
    tx: Tx,
    snap: Pick<SnapshotNode, 'defaultWarehouseId'>,
    itemClass: InventoryItemClass,
  ) {
    const warehouseType =
      itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED_GOODS' : 'SEMI_FINISHED';
    const explicit = snap.defaultWarehouseId
      ? await tx.warehouse.findUnique({ where: { id: snap.defaultWarehouseId } })
      : null;
    if (explicit && explicit.type === warehouseType && explicit.isActive) return explicit;
    const flagged = await tx.warehouse.findFirst({
      where: { type: warehouseType, isActive: true, isDefault: true },
    });
    if (flagged) return flagged;
    const any = await tx.warehouse.findFirst({
      where: { type: warehouseType, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (any) return any;
    throw new BadRequestException({
      code: 'WAREHOUSE_CONFIGURATION_REQUIRED',
      message: 'No compatible warehouse is configured for this output.',
    });
  }

  private async ensureItem(
    tx: Tx,
    args: {
      itemClass: InventoryItemClass;
      productId: string | null;
      nameEn: string;
      nameAr: string;
      nameHe?: string | null;
    },
  ) {
    if (args.productId) {
      const existing = await tx.inventoryItem.findFirst({
        where: {
          productId: args.productId,
          itemClass: args.itemClass,
          nameEn: args.nameEn,
          archivedAt: null,
        },
      });
      if (existing) return existing;
      const sameClass = await tx.inventoryItem.findFirst({
        where: {
          productId: args.productId,
          itemClass: args.itemClass,
          archivedAt: null,
        },
      });
      if (sameClass && args.itemClass === InventoryItemClass.FINISHED_GOOD) return sameClass;
    }
    const prefix = skuPrefixForItemClass(
      args.itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED_GOOD' : 'SEMI_FINISHED_GOOD',
    );
    const rows = await tx.inventoryItem.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    const sku = nextSkuFromExisting(
      prefix,
      rows.map((r) => r.sku),
    );
    return tx.inventoryItem.create({
      data: {
        sku,
        nameEn: args.nameEn,
        nameAr: args.nameAr,
        nameHe: args.nameHe ?? undefined,
        itemClass: args.itemClass,
        category: args.itemClass === InventoryItemClass.FINISHED_GOOD ? 'FINISHED' : 'SEMI_FINISHED',
        isPurchasable: false,
        productId: args.productId,
        unit: 'pcs',
      },
    });
  }
}

export type { ResolvedStageOutput };
