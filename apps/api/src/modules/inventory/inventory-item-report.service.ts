import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PurchaseOrderStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { localizedName } from '../../common/helpers/pdf-i18n';
import type { PdfLocale } from '../../common/helpers/pdf.util';
import { canViewInventoryCost } from './inventory-cost.util';
import { canonicalInventoryImageUrl } from './inventory-image';
import { InventoryService } from './inventory.service';
import { PurchasingService } from '../purchasing/purchasing.service';
import {
  buildReportIdentity,
  classifyInventoryItemStockStatus,
  mapInventoryTxType,
  type InventoryItemReportDto,
} from './inventory-item-report';

const RECENT_MOVEMENT_LIMIT = 40;
const PRODUCT_LIMIT = 12;

function roundQty(value: number): number {
  return Number(Number(value).toFixed(3));
}

@Injectable()
export class InventoryItemReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(forwardRef(() => PurchasingService))
    private readonly purchasing: PurchasingService,
  ) {}

  async getReportData(
    itemId: string,
    permissions: string[],
    locale: PdfLocale,
  ): Promise<InventoryItemReportDto> {
    const canCost = canViewInventoryCost(permissions);
    const canIncoming =
      permissions.includes('inventory.receive') ||
      permissions.includes('purchase-order.read');
    const canDemand = permissions.includes('purchase-order.read');

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId },
      include: {
        balances: { include: { warehouse: true } },
        preferredSupplier: {
          select: { id: true, code: true, name: true, nameEn: true, nameAr: true, nameHe: true },
        },
        stageMaterialInputs: {
          take: PRODUCT_LIMIT,
          select: {
            qtyPerUnit: true,
            quantityMode: true,
            stageDefinition: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
            product: {
              select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true },
            },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    }

    const identity = buildReportIdentity({
      ...item,
      imageUrl: canonicalInventoryImageUrl(item),
    });

    const warehouses = item.balances.map((bal) => {
      const available = Number(bal.availableQty ?? 0);
      const reserved = Number(bal.reservedQty ?? 0);
      return {
        warehouseId: bal.warehouseId,
        code: bal.warehouse.code,
        name: localizedName(locale, bal.warehouse) || bal.warehouse.code,
        onHand: roundQty(available + reserved),
        reserved: roundQty(reserved),
        available: roundQty(available),
      };
    });

    const onHand = warehouses.reduce((s, w) => s + Number(w.onHand), 0);
    const reserved = warehouses.reduce((s, w) => s + Number(w.reserved), 0);
    const available = warehouses.reduce((s, w) => s + Number(w.available), 0);
    const minStock = Number(item.minStock ?? 0);

    let incomingRows: InventoryItemReportDto['incoming'] = null;
    let incomingTotal = 0;
    if (canIncoming) {
      const open = await this.inventory.listOpenReceipts(item.id);
      incomingRows = open.map((row) => ({
        purchaseOrderId: row.purchaseOrderId,
        purchaseOrderNumber: row.purchaseOrderNumber,
        supplierName: row.supplierName,
        orderedQty: Number(row.orderedQty),
        receivedQty: Number(row.receivedQty),
        remainingQty: Number(row.remainingQty),
        unit: row.unit,
        expectedDeliveryDate: row.expectedDeliveryDate
          ? new Date(row.expectedDeliveryDate).toISOString()
          : null,
        status: String(row.status),
      }));
      incomingTotal = incomingRows.reduce((s, r) => s + r.remainingQty, 0);
    }

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [totalMovements, recentTx, summaryTx, countLines] = await Promise.all([
      this.prisma.inventoryTransaction.count({ where: { inventoryItemId: item.id } }),
      this.prisma.inventoryTransaction.findMany({
        where: { inventoryItemId: item.id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_MOVEMENT_LIMIT,
        include: {
          warehouse: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
        },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: { inventoryItemId: item.id, createdAt: { gte: since30 } },
        select: { type: true, quantity: true },
      }),
      this.prisma.inventoryCountLine.findMany({
        where: { inventoryItemId: item.id },
        orderBy: { inventoryCount: { createdAt: 'desc' } },
        take: 15,
        include: {
          inventoryCount: {
            select: {
              number: true,
              status: true,
              countedAt: true,
              createdAt: true,
              warehouseId: true,
            },
          },
        },
      }),
    ]);

    const warehouseIds = [
      ...new Set(countLines.map((c) => c.inventoryCount.warehouseId).filter(Boolean)),
    ];
    const countWarehouses = warehouseIds.length
      ? await this.prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
        })
      : [];
    const whById = new Map(countWarehouses.map((w) => [w.id, w]));

    const summary30d = {
      received: 0,
      issued: 0,
      transferred: 0,
      adjusted: 0,
      net: 0,
    };
    for (const row of summaryTx) {
      const qty = Number(row.quantity);
      const kind = mapInventoryTxType(row.type);
      if (kind === 'RECEIPT' || kind === 'RETURN') summary30d.received += Math.abs(qty);
      else if (kind === 'ISSUE') summary30d.issued += Math.abs(qty);
      else if (kind === 'TRANSFER') summary30d.transferred += Math.abs(qty);
      else if (kind === 'ADJUSTMENT') summary30d.adjusted += qty;
      summary30d.net += qty;
    }

    const movements = {
      recent: recentTx.map((row) => ({
        id: row.id,
        number: row.number,
        date: row.createdAt.toISOString(),
        type: mapInventoryTxType(row.type),
        rawType: row.type,
        quantity: Number(row.quantity),
        warehouseCode: row.warehouse?.code ?? null,
        warehouseName: row.warehouse ? localizedName(locale, row.warehouse) : null,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        notes: row.notes,
        unitCost: canCost && row.unitCost != null ? Number(row.unitCost) : null,
      })),
      totalCount: totalMovements,
      shownCount: recentTx.length,
      summary30d: {
        received: roundQty(summary30d.received),
        issued: roundQty(summary30d.issued),
        transferred: roundQty(summary30d.transferred),
        adjusted: roundQty(summary30d.adjusted),
        net: roundQty(summary30d.net),
      },
    };

    const counts = countLines.map((line) => {
      const wh = whById.get(line.inventoryCount.warehouseId);
      return {
        number: line.inventoryCount.number,
        date: (line.inventoryCount.countedAt ?? line.inventoryCount.createdAt).toISOString(),
        status: line.inventoryCount.status,
        warehouseCode: wh?.code ?? null,
        warehouseName: wh ? localizedName(locale, wh) : null,
        systemQty: Number(line.systemQty),
        countedQty: line.countedQty != null ? Number(line.countedQty) : null,
        varianceQty: line.varianceQty != null ? Number(line.varianceQty) : null,
      };
    });

    let demand: InventoryItemReportDto['demand'] = null;
    if (canDemand) {
      const all = await this.purchasing.materialDemand();
      const row = all.find((r) => r.inventoryItemId === item.id || r.sku === item.sku);
      if (row) {
        demand = {
          status: row.status,
          requiredQty: Number(row.requiredQty),
          freeQty: Number(row.freeQty),
          incomingQty: Number(row.incomingQty),
          nextRequiredBy: row.nextRequiredBy
            ? new Date(row.nextRequiredBy).toISOString()
            : null,
          nextEta: row.nextEta ? new Date(row.nextEta).toISOString() : null,
          affected: row.affected.map((a) => ({
            productionOrderNumber: a.productionOrderNumber,
            stageCode: a.stageCode,
            qty: Number(a.qty),
            requiredBy: a.requiredBy ? new Date(a.requiredBy).toISOString() : null,
          })),
        };
      }
    }

    const products =
      item.stageMaterialInputs.length > 0
        ? item.stageMaterialInputs.map((row) => ({
            productId: row.product.id,
            productName: localizedName(locale, row.product),
            productSku: row.product.sku ?? null,
            stageCode: row.stageDefinition?.code ?? null,
            qtyPerUnit: row.qtyPerUnit != null ? Number(row.qtyPerUnit) : null,
            quantityMode: row.quantityMode ?? null,
          }))
        : null;

    const usageRows = await this.prisma.productionTaskMaterialUsage.findMany({
      where: { inventoryItemId: item.id },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      include: {
        task: { select: { number: true } },
        productionOrder: { select: { number: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
    const productionUsage =
      usageRows.length > 0
        ? usageRows.map((row) => ({
            taskNumber: row.task.number,
            productionOrderNumber: row.productionOrder.number,
            expectedQty: roundQty(Number(row.expectedQty)),
            actualQty: row.actualQty != null ? roundQty(Number(row.actualQty)) : null,
            returnedQty: roundQty(Number(row.returnedQty)),
            scrapQty: roundQty(Number(row.scrapQty)),
            varianceQty: row.varianceQty != null ? roundQty(Number(row.varianceQty)) : null,
            scrapReason: row.scrapReason ?? null,
            reasonNotes: row.reasonNotes ?? null,
            finalizedAt: row.finalizedAt?.toISOString() ?? null,
            recordedBy: row.recordedBy
              ? `${row.recordedBy.firstName} ${row.recordedBy.lastName}`.trim()
              : null,
          }))
        : null;

    const supplier = item.preferredSupplier
      ? {
          id: item.preferredSupplier.id,
          name: localizedName(locale, item.preferredSupplier),
          code: item.preferredSupplier.code ?? null,
        }
      : null;

    const standardCost = Number(item.standardCost ?? 0);
    const cost = canCost
      ? {
          standardCost: roundQty(standardCost),
          stockValue: roundQty(onHand * standardCost),
          reservedValue: roundQty(reserved * standardCost),
          availableValue: roundQty(available * standardCost),
        }
      : null;

    return {
      generatedAt: new Date().toISOString(),
      locale,
      identity,
      stock: {
        onHand: roundQty(onHand),
        reserved: roundQty(reserved),
        available: roundQty(available),
        minStock: roundQty(minStock),
        maxStock: item.maxStock != null ? Number(item.maxStock) : null,
        incoming: roundQty(incomingTotal),
        status: classifyInventoryItemStockStatus({
          isActive: item.isActive,
          onHand,
          minStock,
        }),
      },
      warehouses,
      incoming: incomingRows,
      movements,
      counts: counts.length ? counts : null,
      demand,
      products,
      productionUsage,
      supplier,
      cost,
      permissions: {
        canViewCost: canCost,
        canViewIncoming: canIncoming,
        canViewDemand: canDemand,
      },
    };
  }

  /** Lightweight helper for tests — open PO existence without full demand. */
  async listReceivablePoNumbers(itemId: string): Promise<string[]> {
    const RECEIVABLE = new Set<PurchaseOrderStatus>([
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ]);
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: [...RECEIVABLE] },
        lines: { some: { inventoryItemId: itemId } },
      },
      select: { number: true },
    });
    return rows.map((r) => r.number);
  }
}
