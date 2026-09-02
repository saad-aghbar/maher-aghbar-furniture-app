import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryTxType, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { scaleMaterialQty } from '../scheduling/domain/material-readiness';
import { canonicalInventoryImageUrl } from '../inventory/inventory-image';
import { buildMaterialCostMap } from '../../common/helpers/order-costing.util';
import { roundMoney } from '../../common/helpers/money.util';

type Tx = Prisma.TransactionClient;

const DEFAULT_VARIANCE_TOLERANCE = 0.05;

export type OrderMaterialUsageStatus =
  | 'ON_TARGET'
  | 'OVER'
  | 'UNDER'
  | 'EXTRA'
  | 'UNUSED';

export function classifyOrderMaterialUsageStatus(
  assignedQty: number,
  usedQty: number,
  tolerance = DEFAULT_VARIANCE_TOLERANCE,
): OrderMaterialUsageStatus {
  if (!(assignedQty > 0) && usedQty > 0) return 'EXTRA';
  if (assignedQty > 0 && !(usedQty > 0)) return 'UNUSED';
  if (!(assignedQty > 0)) return 'ON_TARGET';
  const varianceQty = usedQty - assignedQty;
  const variancePct = Math.abs(varianceQty) / assignedQty;
  if (variancePct <= tolerance) return 'ON_TARGET';
  return varianceQty > 0 ? 'OVER' : 'UNDER';
}

/** Only warehouse RAW materials belong on the task materials floor — never SEMI/FIN. */
const RAW_MATERIAL_CLASS = 'RAW_MATERIAL' as const;

function isRawMaterialClass(itemClass: string | null | undefined): boolean {
  return itemClass === RAW_MATERIAL_CLASS;
}

export type MaterialIdentifyResult =
  | {
      status: 'MATCH';
      inventoryItemId: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      imageUrl: string | null;
      unit: string;
      expectedQty: number;
      actualQty: number | null;
      returnedQty: number;
      scrapQty: number;
      usageId: string | null;
    }
  | {
      status: 'WRONG';
      scannedSku: string;
      scannedNameEn: string;
      scannedNameAr: string;
      expectedSkus: string[];
    }
  | {
      status: 'EXTRA';
      inventoryItemId: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      imageUrl: string | null;
      unit: string;
      message: string;
    }
  | { status: 'NOT_FOUND'; code: string };

@Injectable()
export class MaterialUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Prefill expected lines from this stage's frozen snapshot inputs when the
   * product/order has stage material maps. Legacy products with zero maps keep
   * full product BOM prefill. New rows start with actualQty 0.
   */
  async ensureExpectedLines(taskId: string) {
    const task = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        productionOrder: {
          select: {
            id: true,
            quantity: true,
            productId: true,
            product: { select: { id: true, bomDefaults: true } },
          },
        },
        stageInstance: true,
      },
    });

    const orderQty = Number(task.productionOrder.quantity) || 1;
    const productionOrderId = task.productionOrderId;

    const productMapCount = task.productionOrder.productId
      ? await this.prisma.productStageMaterialInput.count({
          where: { productId: task.productionOrder.productId },
        })
      : 0;
    const snapMapCount = await this.prisma.productionOrderWorkflowSnapshotMaterialInput.count({
      where: { snapshotNode: { snapshot: { productionOrderId } } },
    });
    const hasStageMaps = productMapCount > 0 || snapMapCount > 0;

    const stageItemIds = new Set<string>();

    // Stage snapshot material inputs (RAW only)
    if (task.stageInstanceId) {
      const snap = await this.prisma.productionOrderWorkflowSnapshotNode.findFirst({
        where: { stageInstanceId: task.stageInstanceId },
        include: {
          materialInputs: {
            include: {
              inventoryItem: { select: { id: true, itemClass: true, sku: true } },
            },
          },
        },
      });
      if (snap) {
        for (const row of snap.materialInputs) {
          if (!isRawMaterialClass(row.inventoryItem?.itemClass)) continue;
          if (!row.required && Number(row.qtyPerUnit) <= 0) continue;
          const expectedQty = scaleMaterialQty(
            Number(row.qtyPerUnit),
            orderQty,
            row.quantityMode,
          );
          if (!(expectedQty > 0)) continue;
          stageItemIds.add(row.inventoryItemId);
          await this.prisma.productionTaskMaterialUsage.upsert({
            where: {
              taskId_inventoryItemId: {
                taskId,
                inventoryItemId: row.inventoryItemId,
              },
            },
            create: {
              taskId,
              productionOrderId,
              inventoryItemId: row.inventoryItemId,
              sku: row.sku,
              expectedQty,
              actualQty: 0,
            },
            update: {
              expectedQty,
              sku: row.sku,
            },
          });
        }
      }
    }

    // Legacy: no stage maps anywhere → full product BOM on every task
    if (!hasStageMaps) {
      const bom = task.productionOrder.product?.bomDefaults as
        | { materials?: Array<{ sku?: string; qty?: number }> }
        | null
        | undefined;
      const bomMaterials = Array.isArray(bom?.materials) ? bom.materials : [];
      if (bomMaterials.length) {
        const skus = [
          ...new Set(
            bomMaterials
              .map((m) => String(m?.sku ?? '').trim())
              .filter(Boolean),
          ),
        ];
        const items = skus.length
          ? await this.prisma.inventoryItem.findMany({
              where: {
                sku: { in: skus },
                archivedAt: null,
                itemClass: 'RAW_MATERIAL',
              },
              select: { id: true, sku: true },
            })
          : [];
        const bySku = new Map(items.map((i) => [i.sku, i]));
        for (const row of bomMaterials) {
          const sku = String(row?.sku ?? '').trim();
          if (!sku) continue;
          const item = bySku.get(sku);
          if (!item) continue;
          const qtyPerUnit = Number(row?.qty) || 0;
          const expectedQty = scaleMaterialQty(qtyPerUnit, orderQty, 'LINEAR');
          if (!(expectedQty > 0)) continue;
          stageItemIds.add(item.id);
          await this.prisma.productionTaskMaterialUsage.upsert({
            where: {
              taskId_inventoryItemId: {
                taskId,
                inventoryItemId: item.id,
              },
            },
            create: {
              taskId,
              productionOrderId,
              inventoryItemId: item.id,
              sku: item.sku,
              expectedQty,
              actualQty: 0,
            },
            update: {
              expectedQty,
              sku: item.sku,
            },
          });
        }
      }
    }

    // Prune stale BOM-copied rows when stage maps are in effect
    if (hasStageMaps) {
      const stale = await this.prisma.productionTaskMaterialUsage.findMany({
        where: {
          taskId,
          isExtra: false,
          finalizedAt: null,
          ...(stageItemIds.size
            ? { inventoryItemId: { notIn: [...stageItemIds] } }
            : {}),
        },
      });
      for (const row of stale) {
        if (stageItemIds.has(row.inventoryItemId)) continue;
        const actual = Number(row.actualQty) || 0;
        const returned = Number(row.returnedQty) || 0;
        const scrap = Number(row.scrapQty) || 0;
        if (actual > 0 || returned > 0 || scrap > 0) continue;
        await this.prisma.productionTaskMaterialUsage.delete({ where: { id: row.id } });
      }
    }

    return this.listForTask(taskId);
  }

  async listForTask(taskId: string) {
    const rows = await this.prisma.productionTaskMaterialUsage.findMany({
      where: {
        taskId,
        inventoryItem: { itemClass: RAW_MATERIAL_CLASS },
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            unit: true,
            imageUrl: true,
            itemClass: true,
          },
        },
        issueWarehouse: {
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
        },
        returnWarehouse: {
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
        },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ isExtra: 'asc' }, { sku: 'asc' }],
    });

    const itemIds = rows.map((r) => r.inventoryItemId);
    const balances = itemIds.length
      ? await this.prisma.inventoryBalance.findMany({
          where: {
            inventoryItemId: { in: itemIds },
            warehouse: { type: 'RAW_MATERIALS', isActive: true },
          },
          include: {
            warehouse: {
              select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true, isDefault: true },
            },
          },
          orderBy: { availableQty: 'desc' },
        })
      : [];
    const warehousesByItem = new Map<
      string,
      Array<{
        id: string;
        code: string;
        nameEn: string;
        nameAr: string;
        nameHe: string | null;
        availableQty: number;
        isDefault: boolean;
      }>
    >();
    for (const bal of balances) {
      const list = warehousesByItem.get(bal.inventoryItemId) ?? [];
      list.push({
        id: bal.warehouse.id,
        code: bal.warehouse.code,
        nameEn: bal.warehouse.nameEn,
        nameAr: bal.warehouse.nameAr,
        nameHe: bal.warehouse.nameHe,
        availableQty: Number(bal.availableQty),
        isDefault: bal.warehouse.isDefault,
      });
      warehousesByItem.set(bal.inventoryItemId, list);
    }

    return rows.map((row) => ({
      ...row,
      warehouses: warehousesByItem.get(row.inventoryItemId) ?? [],
    }));
  }

  /**
   * Identify a scanned code against this task's expected materials.
   * Never mutates stock. Does not require inventory.read.
   */
  async identifyScan(taskId: string, code: string): Promise<MaterialIdentifyResult> {
    const trimmed = String(code ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Scan code required.' });
    }
    const lines = await this.ensureExpectedLines(taskId);
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        archivedAt: null,
        OR: [{ sku: trimmed }, { barcode: trimmed }, { qrCode: trimmed }],
      },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
        imageUrl: true,
        unit: true,
        itemClass: true,
      },
    });
    if (!item) return { status: 'NOT_FOUND', code: trimmed };

    if (!isRawMaterialClass(item.itemClass)) {
      return {
        status: 'WRONG',
        scannedSku: item.sku,
        scannedNameEn: item.nameEn,
        scannedNameAr: item.nameAr,
        expectedSkus: lines.map((l) => l.sku),
      };
    }

    const match = lines.find((l) => l.inventoryItemId === item.id);
    if (match) {
      return {
        status: 'MATCH',
        inventoryItemId: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        nameHe: item.nameHe,
        imageUrl: item.imageUrl,
        unit: item.unit,
        expectedQty: Number(match.expectedQty),
        actualQty: match.actualQty != null ? Number(match.actualQty) : null,
        returnedQty: Number(match.returnedQty),
        scrapQty: Number(match.scrapQty),
        usageId: match.id,
      };
    }

    // Not on the expected list — allow as extra (RAW substitute only).
    return {
      status: 'EXTRA',
      inventoryItemId: item.id,
      sku: item.sku,
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      nameHe: item.nameHe,
      imageUrl: item.imageUrl,
      unit: item.unit,
      message: 'Not on the expected list; can add as extra with a reason.',
    };
  }

  async recordLines(
    taskId: string,
    userId: string,
    lines: Array<{
      inventoryItemId: string;
      actualQty: number;
      returnedQty?: number;
      scrapQty?: number;
      scrapReason?: string | null;
      reasonNotes?: string | null;
      isExtra?: boolean;
      sku?: string;
      issueWarehouseId?: string | null;
      returnWarehouseId?: string | null;
    }>,
  ) {
    await this.ensureExpectedLines(taskId);
    const task = await this.prisma.productionTask.findUniqueOrThrow({
      where: { id: taskId },
      select: { productionOrderId: true },
    });

    for (const line of lines) {
      const itemClassRow = await this.prisma.inventoryItem.findUnique({
        where: { id: line.inventoryItemId },
        select: { itemClass: true, sku: true },
      });
      if (!itemClassRow || !isRawMaterialClass(itemClassRow.itemClass)) {
        throw new BadRequestException({
          code: 'MATERIAL_NOT_RAW',
          message:
            'Semi-finished and finished goods are not recorded as raw materials. Use Incoming / Output semi-finished instead.',
        });
      }

      const expectedRow = await this.prisma.productionTaskMaterialUsage.findUnique({
        where: {
          taskId_inventoryItemId: {
            taskId,
            inventoryItemId: line.inventoryItemId,
          },
        },
      });
      const expectedQty = Number(expectedRow?.expectedQty ?? 0);
      const actualQty = Number(line.actualQty);
      const returnedQty = Number(line.returnedQty ?? 0);
      const scrapQty = Number(line.scrapQty ?? 0);
      if (actualQty < 0 || returnedQty < 0 || scrapQty < 0) {
        throw new BadRequestException({
          code: 'INVALID_USAGE_QTY',
          message: 'Usage quantities cannot be negative.',
        });
      }
      const isExtra = Boolean(line.isExtra) || expectedQty <= 0;
      const needsIssueWarehouse =
        isExtra || actualQty > expectedQty + 1e-9 || (actualQty > 0 && expectedQty <= 0);
      const issueWarehouseId = line.issueWarehouseId?.trim() || null;
      const returnWarehouseId = line.returnWarehouseId?.trim() || null;

      if (returnedQty > 0 && !returnWarehouseId) {
        throw new BadRequestException({
          code: 'RETURN_WAREHOUSE_REQUIRED',
          message: `Choose a warehouse to return unused ${itemClassRow.sku}.`,
        });
      }
      if (needsIssueWarehouse && actualQty + returnedQty + scrapQty > 0 && !issueWarehouseId) {
        throw new BadRequestException({
          code: 'ISSUE_WAREHOUSE_REQUIRED',
          message: `Choose a warehouse to take ${itemClassRow.sku} from.`,
        });
      }
      if (issueWarehouseId) {
        await this.assertRawWarehouse(issueWarehouseId, line.inventoryItemId, true);
      }
      if (returnWarehouseId) {
        await this.assertRawWarehouse(returnWarehouseId, line.inventoryItemId, false);
      }

      const varianceQty = actualQty - expectedQty;
      const variancePct =
        expectedQty > 0 ? Math.abs(varianceQty) / expectedQty : actualQty > 0 ? 1 : 0;
      if (
        actualQty > 0 &&
        variancePct > DEFAULT_VARIANCE_TOLERANCE &&
        !line.reasonNotes &&
        !line.scrapReason &&
        !issueWarehouseId &&
        !returnWarehouseId
      ) {
        throw new BadRequestException({
          code: 'USAGE_VARIANCE_REASON_REQUIRED',
          message: 'Material variance exceeds tolerance; provide a reason.',
        });
      }

      let sku = line.sku ?? expectedRow?.sku ?? itemClassRow.sku;
      if (!sku) {
        const item = await this.prisma.inventoryItem.findUniqueOrThrow({
          where: { id: line.inventoryItemId },
          select: { sku: true },
        });
        sku = item.sku;
      }

      await this.prisma.productionTaskMaterialUsage.upsert({
        where: {
          taskId_inventoryItemId: {
            taskId,
            inventoryItemId: line.inventoryItemId,
          },
        },
        create: {
          taskId,
          productionOrderId: task.productionOrderId,
          inventoryItemId: line.inventoryItemId,
          sku,
          expectedQty: expectedRow?.expectedQty ?? 0,
          actualQty,
          returnedQty,
          scrapQty,
          varianceQty,
          scrapReason: (line.scrapReason as never) ?? null,
          reasonNotes: line.reasonNotes ?? null,
          isExtra,
          issueWarehouseId,
          returnWarehouseId,
          recordedById: userId,
        },
        update: {
          actualQty,
          returnedQty,
          scrapQty,
          varianceQty,
          scrapReason: (line.scrapReason as never) ?? null,
          reasonNotes: line.reasonNotes ?? null,
          recordedById: userId,
          isExtra,
          issueWarehouseId,
          returnWarehouseId,
        },
      });
    }
    return this.listForTask(taskId);
  }

  private async assertRawWarehouse(
    warehouseId: string,
    inventoryItemId: string,
    requireStock: boolean,
  ) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, type: 'RAW_MATERIALS', isActive: true },
      select: { id: true },
    });
    if (!warehouse) {
      throw new BadRequestException({
        code: 'INVALID_WAREHOUSE',
        message: 'Choose an active raw-materials warehouse.',
      });
    }
    if (!requireStock) return;
    const balance = await this.prisma.inventoryBalance.findFirst({
      where: { warehouseId, inventoryItemId },
      select: { availableQty: true },
    });
    if (!balance || Number(balance.availableQty) <= 0) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'That warehouse has no available stock for this material.',
      });
    }
  }

  /**
   * Post actual/return movements for this task. Idempotent per finalize key.
   * Replaces blind BOM auto-issue when usages exist for the task.
   */
  async finalizeForTask(params: {
    taskId: string;
    userId: string;
    tx: Tx;
    idempotencyKey?: string;
    qtyScale?: number;
    markFinal?: boolean;
  }) {
    const key =
      params.idempotencyKey?.trim() ||
      `usage-finalize:${params.taskId}:${params.qtyScale ?? 1}`;
    const markFinal = params.markFinal !== false;

    const rows = await params.tx.productionTaskMaterialUsage.findMany({
      where: { taskId: params.taskId },
    });
    if (!rows.length) return { posted: false, reason: 'no_usage_rows' as const };

    const already = await params.tx.inventoryTransaction.findFirst({
      where: { idempotencyKey: `${key}:issue:${rows[0]!.inventoryItemId}` },
    });
    if (already) {
      return { posted: false, reason: 'already_finalized' as const };
    }

    // Also treat rows that already carry a finalize key as done (partial retries).
    const pending = rows.filter((r) => !r.finalizeIdempotencyKey);
    if (!pending.length) {
      return { posted: false, reason: 'already_finalized' as const };
    }

    const scale = params.qtyScale != null && params.qtyScale > 0 ? params.qtyScale : 1;

    // Piece 5: freeze valuation at finalize from standardCost + latest PURCHASE_RECEIPT.
    const skus = [...new Set(pending.map((r) => r.sku).filter(Boolean))];
    const costMap = await this.loadCostMapForSkus(skus, params.tx);
    const valuedAt = new Date();

    for (const row of pending) {
      const actual = Number(row.actualQty ?? 0) * scale;
      const returned = Number(row.returnedQty) * scale;
      const scrap = Number(row.scrapQty) * scale;
      const issueQty = actual + returned + scrap;
      const costedQty = actual + scrap - returned;
      const mapped = costMap.has(row.sku) ? costMap.get(row.sku)! : null;
      const unitCost =
        mapped != null && Number.isFinite(mapped) && mapped > 0
          ? Number(roundMoney(mapped))
          : null;
      const extendedCost =
        unitCost != null && costedQty > 0 ? Number(roundMoney(unitCost * costedQty)) : null;

      if (issueQty <= 0) {
        if (markFinal) {
          await params.tx.productionTaskMaterialUsage.update({
            where: { id: row.id },
            data: {
              finalizedAt: valuedAt,
              finalizeIdempotencyKey: `${key}:${row.inventoryItemId}`,
              recordedById: params.userId,
              unitCost,
              extendedCost: costedQty > 0 ? extendedCost : null,
              valuedAt: unitCost != null ? valuedAt : null,
            },
          });
        }
        continue;
      }

      let warehouseId = row.issueWarehouseId ?? null;
      let balance =
        warehouseId != null
          ? await params.tx.inventoryBalance.findFirst({
              where: {
                inventoryItemId: row.inventoryItemId,
                warehouseId,
                warehouse: { type: 'RAW_MATERIALS', isActive: true },
              },
            })
          : null;
      if (!balance) {
        balance = await params.tx.inventoryBalance.findFirst({
          where: {
            inventoryItemId: row.inventoryItemId,
            warehouse: { type: 'RAW_MATERIALS', isActive: true },
          },
          orderBy: { availableQty: 'desc' },
        });
        warehouseId = balance?.warehouseId ?? null;
      }
      if (!balance || !warehouseId) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `No raw warehouse balance for ${row.sku}.`,
        });
      }

      if (Number(balance.availableQty) + 1e-9 < issueQty) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: `Not enough stock to finalize usage for ${row.sku}.`,
        });
      }
      await this.inventory.applyMovement({
        type: InventoryTxType.PRODUCTION_ISSUE,
        inventoryItemId: row.inventoryItemId,
        warehouseId,
        quantity: issueQty,
        unitCost: unitCost ?? undefined,
        userId: params.userId,
        idempotencyKey: `${key}:issue:${row.inventoryItemId}`,
        referenceType: 'ProductionTask',
        referenceId: params.taskId,
        reservedDelta: -Math.min(issueQty, Number(balance.reservedQty)),
        notes:
          scrap > 0
            ? `Includes scrap ${scrap}${row.scrapReason ? ` (${row.scrapReason})` : ''}`
            : undefined,
        db: params.tx,
      });
      if (returned > 0) {
        const returnWhId = row.returnWarehouseId || warehouseId;
        await this.inventory.applyMovement({
          type: InventoryTxType.PRODUCTION_RETURN,
          inventoryItemId: row.inventoryItemId,
          warehouseId: returnWhId,
          quantity: returned,
          unitCost: unitCost ?? undefined,
          userId: params.userId,
          idempotencyKey: `${key}:return:${row.inventoryItemId}`,
          referenceType: 'ProductionTask',
          referenceId: params.taskId,
          reservedDelta: 0,
          db: params.tx,
        });
      }
      if (markFinal) {
        await params.tx.productionTaskMaterialUsage.update({
          where: { id: row.id },
          data: {
            finalizedAt: valuedAt,
            finalizeIdempotencyKey: `${key}:${row.inventoryItemId}`,
            recordedById: params.userId,
            issueWarehouseId: warehouseId,
            returnWarehouseId:
              returned > 0 ? row.returnWarehouseId || warehouseId : row.returnWarehouseId,
            unitCost,
            extendedCost,
            valuedAt: unitCost != null ? valuedAt : null,
          },
        });
      }
    }
    return { posted: true as const, reason: 'ok' as const };
  }

  private async loadCostMapForSkus(skus: string[], tx: Tx) {
    if (skus.length === 0) return new Map<string, number>();
    const [items, txs] = await Promise.all([
      tx.inventoryItem.findMany({
        where: { sku: { in: skus }, archivedAt: null },
        select: { sku: true, standardCost: true },
      }),
      tx.inventoryTransaction.findMany({
        where: {
          inventoryItem: { sku: { in: skus } },
          unitCost: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
        select: {
          unitCost: true,
          type: true,
          inventoryItem: { select: { sku: true } },
        },
      }),
    ]);
    return buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((t) => ({
        sku: t.inventoryItem.sku,
        unitCost: t.unitCost,
        type: t.type,
      })),
    });
  }

  async hasUsageRows(taskId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const count = await db.productionTaskMaterialUsage.count({ where: { taskId } });
    return count > 0;
  }

  /**
   * Order-level assigned vs Σ worker actualQty across tasks.
   * When snapshot has stage maps: assigned = sum of stage qtyPerUnit × order qty.
   * Otherwise: product BOM once. Never sum per-task expectedQty copies.
   */
  async listOrderMaterialUsage(productionOrderId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      select: {
        id: true,
        quantity: true,
        product: { select: { id: true, bomDefaults: true } },
      },
    });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Production order not found.' });
    }

    const orderQty = Number(order.quantity) || 1;
    type AssignedAcc = {
      inventoryItemId: string;
      sku: string;
      assignedQty: number;
    };
    const assignedByItem = new Map<string, AssignedAcc>();

    const bumpAssigned = (inventoryItemId: string, sku: string, qty: number, mode: 'max' | 'sum') => {
      if (!(qty > 0)) return;
      const prev = assignedByItem.get(inventoryItemId);
      if (!prev) {
        assignedByItem.set(inventoryItemId, { inventoryItemId, sku, assignedQty: qty });
        return;
      }
      if (mode === 'sum') {
        prev.assignedQty += qty;
      } else if (qty > prev.assignedQty) {
        prev.assignedQty = qty;
      }
      prev.sku = sku || prev.sku;
    };

    const snapNodes = await this.prisma.productionOrderWorkflowSnapshotNode.findMany({
      where: { snapshot: { productionOrderId } },
      include: {
        materialInputs: {
          include: {
            inventoryItem: { select: { id: true, itemClass: true, sku: true } },
          },
        },
      },
    });
    let snapMaterialCount = 0;
    for (const node of snapNodes) {
      for (const row of node.materialInputs) {
        if (!isRawMaterialClass(row.inventoryItem?.itemClass)) continue;
        if (!row.required && Number(row.qtyPerUnit) <= 0) continue;
        snapMaterialCount += 1;
        const expectedQty = scaleMaterialQty(
          Number(row.qtyPerUnit),
          orderQty,
          row.quantityMode,
        );
        bumpAssigned(
          row.inventoryItemId,
          row.sku || row.inventoryItem?.sku || '',
          expectedQty,
          'sum',
        );
      }
    }

    if (snapMaterialCount === 0) {
      const bom = order.product?.bomDefaults as
        | { materials?: Array<{ sku?: string; qty?: number }> }
        | null
        | undefined;
      const bomMaterials = Array.isArray(bom?.materials) ? bom.materials : [];
      if (bomMaterials.length) {
        const skus = [
          ...new Set(
            bomMaterials
              .map((m) => String(m?.sku ?? '').trim())
              .filter(Boolean),
          ),
        ];
        const items = skus.length
          ? await this.prisma.inventoryItem.findMany({
              where: {
                sku: { in: skus },
                archivedAt: null,
                itemClass: RAW_MATERIAL_CLASS,
              },
              select: { id: true, sku: true },
            })
          : [];
        const bySku = new Map(items.map((i) => [i.sku, i]));
        for (const row of bomMaterials) {
          const sku = String(row?.sku ?? '').trim();
          if (!sku) continue;
          const item = bySku.get(sku);
          if (!item) continue;
          const qtyPerUnit = Number(row?.qty) || 0;
          bumpAssigned(
            item.id,
            item.sku,
            scaleMaterialQty(qtyPerUnit, orderQty, 'LINEAR'),
            'max',
          );
        }
      }
    }

    const usages = await this.prisma.productionTaskMaterialUsage.findMany({
      where: {
        productionOrderId,
        inventoryItem: { itemClass: RAW_MATERIAL_CLASS },
      },
      include: {
        inventoryItem: {
          select: {
            id: true,
            sku: true,
            nameEn: true,
            nameAr: true,
            nameHe: true,
            unit: true,
            imageUrl: true,
            itemClass: true,
          },
        },
        issueWarehouse: {
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
        },
        returnWarehouse: {
          select: { id: true, code: true, nameEn: true, nameAr: true, nameHe: true },
        },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
        task: {
          select: {
            id: true,
            number: true,
            stageDefinition: { select: { code: true, nameEn: true, nameAr: true, nameHe: true } },
            assignedEmployee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: [{ sku: 'asc' }, { createdAt: 'asc' }],
    });

    type WhStamp = {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
    } | null;
    type PersonStamp = {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
    type Acc = {
      inventoryItemId: string;
      sku: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      unit: string;
      imageUrl: string | null;
      itemClass: string | null;
      assignedQty: number;
      usedQty: number;
      returnedQty: number;
      scrapQty: number;
      isExtra: boolean;
      tasks: Array<{
        taskId: string;
        taskNumber: string;
        stageCode: string | null;
        stageNameEn: string | null;
        stageNameAr: string | null;
        stageNameHe: string | null;
        actualQty: number;
        expectedQty: number;
        returnedQty: number;
        issueWarehouse: WhStamp;
        returnWarehouse: WhStamp;
        /** Proven only when usage row has recordedBy. */
        recordedBy: PersonStamp;
        /** Proven only when linked task has an assignee. */
        assignedEmployee: PersonStamp;
        recordedAt: string | null;
      }>;
    };
    const byItem = new Map<string, Acc>();

    const ensureRow = (
      inventoryItemId: string,
      meta: {
        sku: string;
        nameEn?: string;
        nameAr?: string;
        nameHe?: string | null;
        unit?: string;
        imageUrl?: string | null;
        itemClass?: string | null;
      },
    ): Acc => {
      let row = byItem.get(inventoryItemId);
      if (!row) {
        row = {
          inventoryItemId,
          sku: meta.sku,
          nameEn: meta.nameEn ?? meta.sku,
          nameAr: meta.nameAr ?? meta.sku,
          nameHe: meta.nameHe ?? null,
          unit: meta.unit ?? 'pcs',
          imageUrl: canonicalInventoryImageUrl({ imageUrl: meta.imageUrl }) ?? null,
          itemClass: meta.itemClass ?? RAW_MATERIAL_CLASS,
          assignedQty: assignedByItem.get(inventoryItemId)?.assignedQty ?? 0,
          usedQty: 0,
          returnedQty: 0,
          scrapQty: 0,
          isExtra: false,
          tasks: [],
        };
        byItem.set(inventoryItemId, row);
      }
      return row;
    };

    for (const [inventoryItemId, assigned] of assignedByItem) {
      ensureRow(inventoryItemId, { sku: assigned.sku });
    }

    for (const usage of usages) {
      const item = usage.inventoryItem;
      const row = ensureRow(usage.inventoryItemId, {
        sku: item?.sku ?? usage.sku,
        nameEn: item?.nameEn,
        nameAr: item?.nameAr,
        nameHe: item?.nameHe,
        unit: item?.unit,
        imageUrl: item?.imageUrl,
        itemClass: item?.itemClass,
      });
      const actual = Number(usage.actualQty) || 0;
      const returned = Number(usage.returnedQty) || 0;
      row.usedQty += actual;
      row.returnedQty += returned;
      row.scrapQty += Number(usage.scrapQty) || 0;
      if (usage.isExtra) row.isExtra = true;
      row.tasks.push({
        taskId: usage.taskId,
        taskNumber: usage.task?.number ?? '',
        stageCode: usage.task?.stageDefinition?.code ?? null,
        stageNameEn: usage.task?.stageDefinition?.nameEn ?? null,
        stageNameAr: usage.task?.stageDefinition?.nameAr ?? null,
        stageNameHe: usage.task?.stageDefinition?.nameHe ?? null,
        actualQty: actual,
        expectedQty: Number(usage.expectedQty) || 0,
        returnedQty: returned,
        issueWarehouse: usage.issueWarehouse
          ? {
              id: usage.issueWarehouse.id,
              code: usage.issueWarehouse.code,
              nameEn: usage.issueWarehouse.nameEn,
              nameAr: usage.issueWarehouse.nameAr,
              nameHe: usage.issueWarehouse.nameHe,
            }
          : null,
        returnWarehouse: usage.returnWarehouse
          ? {
              id: usage.returnWarehouse.id,
              code: usage.returnWarehouse.code,
              nameEn: usage.returnWarehouse.nameEn,
              nameAr: usage.returnWarehouse.nameAr,
              nameHe: usage.returnWarehouse.nameHe,
            }
          : null,
        recordedBy: usage.recordedBy
          ? {
              id: usage.recordedBy.id,
              firstName: usage.recordedBy.firstName,
              lastName: usage.recordedBy.lastName,
            }
          : null,
        assignedEmployee: usage.task?.assignedEmployee
          ? {
              id: usage.task.assignedEmployee.id,
              firstName: usage.task.assignedEmployee.firstName,
              lastName: usage.task.assignedEmployee.lastName,
            }
          : null,
        recordedAt: usage.createdAt
          ? new Date(usage.createdAt).toISOString()
          : null,
      });
    }

    const missingMetaIds = [...byItem.values()]
      .filter((r) => r.nameEn === r.sku && r.assignedQty > 0)
      .map((r) => r.inventoryItemId);
    if (missingMetaIds.length) {
      const items = await this.prisma.inventoryItem.findMany({
        where: { id: { in: missingMetaIds } },
        select: {
          id: true,
          sku: true,
          nameEn: true,
          nameAr: true,
          nameHe: true,
          unit: true,
          imageUrl: true,
          itemClass: true,
        },
      });
      for (const item of items) {
        const row = byItem.get(item.id);
        if (!row) continue;
        row.sku = item.sku;
        row.nameEn = item.nameEn;
        row.nameAr = item.nameAr;
        row.nameHe = item.nameHe;
        row.unit = item.unit;
        row.imageUrl = canonicalInventoryImageUrl(item);
        row.itemClass = item.itemClass;
      }
    }

    const materials = [...byItem.values()]
      .map((row) => {
        const assignedQty = row.assignedQty;
        const usedQty = row.usedQty;
        const varianceQty = usedQty - assignedQty;
        const status = classifyOrderMaterialUsageStatus(assignedQty, usedQty);
        return {
          inventoryItemId: row.inventoryItemId,
          sku: row.sku,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
          nameHe: row.nameHe,
          unit: row.unit,
          imageUrl: row.imageUrl,
          itemClass: row.itemClass,
          assignedQty,
          usedQty,
          returnedQty: row.returnedQty,
          scrapQty: row.scrapQty,
          varianceQty,
          status,
          isExtra: row.isExtra || status === 'EXTRA',
          tasks: row.tasks,
        };
      })
      .sort((a, b) => a.sku.localeCompare(b.sku));

    return { materials };
  }
}
