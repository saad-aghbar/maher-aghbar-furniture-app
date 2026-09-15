import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InventoryTxType, InventoryTracking, Prisma, PurchaseOrderStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import {
  inventoryLotOriginWhere,
  parseProductionOrigin,
  RETURN_PIECE_QUARANTINE_PREFIX,
  RETURN_QUARANTINE_PREFIX,
  returnIdFromQuarantineSourceKey,
  returnQuarantineSourceKey,
} from '../production/production-origin';
import {
  indexDeliveryIssueLeftAt,
  lotOverlapsHistoryWindow,
  resolveLotLeftAt,
} from './finished-lot-presence';
import {
  INVENTORY_CATEGORY_GROUPS,
  categoriesForGroup,
  nextSkuFromExisting,
  skuPrefixForCategory,
  summarizeInventoryMeasurements,
  type InventoryCategoryGroup,
} from '../../common/helpers/inventory-category.util';
import {
  classifyInventoryCategory,
  itemClassCompatibleWithWarehouse,
  skuPrefixForItemClass,
  type InventoryItemClassValue,
  type RawMaterialGroupValue,
  type WarehouseTypeValue,
} from '../../common/helpers/inventory-lifecycle.util';
import { roundMoney } from '../../common/helpers/money.util';
import { bomReservationNeeds } from '../../common/helpers/inventory-reservation.util';
import type { BomDefaults } from '../../common/helpers/order-costing.util';
import { assessFabricReadiness } from '../production/fabric-readiness';
import { inventoryScanPayload } from '@maher/types';
import { PurchasingService } from '../purchasing/purchasing.service';
import { SchedulingQueueService } from '../scheduling/scheduling-queue';
import { OpsNotifyService } from '../notifications/ops-notify.service';
import { stockCrossedBelowMin } from '../notifications/ops-notify.classify';
import { comparePriority } from '../scheduling/domain/priority-fairness';
import type { PrioritySortItem } from '../scheduling/domain/types';
import { stripInventoryCostFields, stripInventoryCostList } from './inventory-cost.util';
import { aggregateStockQty, withStockQty } from '../../common/helpers/inventory-qty.util';
import {
  pieceLabelsFromMetadata,
  type PieceLabel,
} from '../production/piece-labels';
import type { ListFinishedLotsDto, ListSemiFinishedDto } from './dto/finished-lots.dto';
import { resolveInventoryCostLinks } from './inventory-cost-links';
import {
  pickBinsForIssue,
  resolveBinId,
  warehouseStockFromBalances,
} from './bin-resolve';

function withItemStockQty<T extends { balances?: Array<{ availableQty?: unknown; reservedQty?: unknown }> }>(
  item: T,
) {
  const balances = (item.balances ?? []).map((row) => withStockQty(row));
  const qty = aggregateStockQty(balances);
  return {
    ...item,
    balances,
    onHandQty: qty.onHandQty,
    reservedQty: qty.reservedQty,
    freeQty: qty.freeQty,
  };
}

function withItemScanCode<T extends { sku: string; qrCode?: string | null }>(item: T) {
  return { ...item, scanCode: inventoryScanPayload(item) };
}

function presentInventoryItem<
  T extends {
    sku: string;
    qrCode?: string | null;
    balances?: Array<{ availableQty?: unknown; reservedQty?: unknown }>;
  },
>(item: T) {
  return withItemScanCode(withItemStockQty(item));
}

function assertItemMutable(item: { archivedAt?: Date | null; isActive?: boolean | null }) {
  if (item.archivedAt || item.isActive === false) {
    throw new BadRequestException({
      code: 'ITEM_INACTIVE',
      message: 'This material is inactive and cannot be moved.',
    });
  }
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(forwardRef(() => PurchasingService))
    private readonly purchasing: PurchasingService,
    @Inject(forwardRef(() => SchedulingQueueService))
    private readonly schedulingQueue?: SchedulingQueueService,
    @Optional() private readonly opsNotify?: OpsNotifyService,
  ) {}

  async listGroups(permissions?: string[]) {
    void permissions;
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null, isActive: true, itemClass: 'RAW_MATERIAL' },
      select: {
        id: true,
        category: true,
        materialGroup: true,
        unit: true,
        minStock: true,
        balances: { select: { availableQty: true } },
      },
    });

    const groupKeys = Object.keys(INVENTORY_CATEGORY_GROUPS) as InventoryCategoryGroup[];
    return groupKeys.map((categoryGroup) => {
      const categories = INVENTORY_CATEGORY_GROUPS[categoryGroup];
      const groupItems = items.filter((item) => categories.includes(item.category));
      let lowStockCount = 0;
      let totalOnHand = 0;
      const units = new Set<string>();
      for (const item of groupItems) {
        const onHand = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
        totalOnHand += onHand;
        if (onHand <= Number(item.minStock)) lowStockCount += 1;
        if (item.unit) units.add(item.unit);
      }
      return {
        categoryGroup,
        materialCount: groupItems.length,
        lowStockCount,
        totalOnHand: roundMoney(totalOnHand),
        primaryUnit: units.size === 1 ? [...units][0] : null,
      };
    });
  }

  async listItems(
    query: PaginationDto & {
      category?: string;
      categoryGroup?: string;
      itemClass?: string;
      materialGroup?: string;
      warehouseType?: string;
      warehouseId?: string;
      q?: string;
      lowStock?: string;
      active?: string;
      isPurchasable?: string;
    },
    permissions?: string[],
  ) {
    const groupCategories = categoriesForGroup(query.categoryGroup);
    const where: Prisma.InventoryItemWhereInput = {
      archivedAt: null,
      ...(query.active === 'true' ? { isActive: true } : {}),
      ...(query.active === 'false' ? { isActive: false } : {}),
      ...(query.isPurchasable === 'true' ? { isPurchasable: true } : {}),
      ...(query.isPurchasable === 'false' ? { isPurchasable: false } : {}),
      ...(query.category ? { category: query.category as never } : {}),
      ...(groupCategories?.length ? { category: { in: groupCategories } } : {}),
      ...(query.itemClass ? { itemClass: query.itemClass as never } : {}),
      ...(query.materialGroup ? { materialGroup: query.materialGroup as never } : {}),
      ...(query.warehouseId || query.warehouseType
        ? {
            balances: {
              some: {
                ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
                ...(query.warehouseType
                  ? { warehouse: { type: query.warehouseType as never } }
                  : {}),
              },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { nameHe: { contains: query.q, mode: 'insensitive' } },
              { materialType: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        include: {
          balances: { include: { warehouse: true, location: true } },
          product: { select: { id: true, sku: true, nameEn: true, nameAr: true, nameHe: true, imageUrl: true } },
        },
        orderBy: { sku: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    let rows = data;
    if (query.lowStock === 'true') {
      rows = data.filter((item) => {
        const onHand = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
        return onHand <= Number(item.minStock);
      });
    }
    const stripped = stripInventoryCostList(rows, permissions);
    const withQty = stripped.map((item) => presentInventoryItem(item));
    if (query.itemClass !== 'FINISHED_GOOD' || withQty.length === 0) {
      return {
        data: withQty,
        meta: paginatedMeta(query.page, query.pageSize, query.lowStock === 'true' ? rows.length : totalItems),
      };
    }
    const quarantine = await this.prisma.inventoryLot.groupBy({
      by: ['inventoryItemId'],
      where: {
        inventoryItemId: { in: withQty.map((item) => item.id) },
        status: 'QUARANTINED',
      },
      _sum: { quantity: true },
    });
    const quarantinedByItem = new Map(
      quarantine.map((row) => [row.inventoryItemId, Number(row._sum.quantity ?? 0)]),
    );
    return {
      data: withQty.map((item) => ({
        ...item,
        quarantinedQty: quarantinedByItem.get(item.id) ?? 0,
      })),
      meta: paginatedMeta(query.page, query.pageSize, query.lowStock === 'true' ? rows.length : totalItems),
    };
  }

  async findByCode(code: string, permissions?: string[]) {
    const raw = String(code ?? '').trim();
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        OR: [{ sku: raw }, { barcode: raw }, { qrCode: raw }],
      },
      include: { balances: { include: { warehouse: true, location: true } } },
    });
    if (item) return presentInventoryItem(stripInventoryCostFields(item, permissions));

    // Factory WIP kit / piece / lot QR → resolve to the semi-finished SKU
    const lot = await this.prisma.inventoryLot.findFirst({
      where: { qrCode: raw },
      include: {
        inventoryItem: { include: { balances: { include: { warehouse: true, location: true } } } },
      },
    });
    if (lot?.inventoryItem) {
      return presentInventoryItem(stripInventoryCostFields(lot.inventoryItem, permissions));
    }

    const kit = await this.prisma.wipKit.findFirst({
      where: {
        OR: [
          { qrCode: raw },
          { id: raw.startsWith('WIPKIT:') ? raw.slice('WIPKIT:'.length) : raw },
          { pieces: { some: { qrCode: raw } } },
        ],
      },
      include: {
        pieces: {
          where: { inventoryLotId: { not: null } },
          take: 1,
          include: {
            inventoryLot: {
              include: {
                inventoryItem: { include: { balances: { include: { warehouse: true, location: true } } } },
              },
            },
          },
        },
      },
    });
    const kitItem = kit?.pieces[0]?.inventoryLot?.inventoryItem;
    if (kitItem) {
      return presentInventoryItem(stripInventoryCostFields(kitItem, permissions));
    }

    throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
  }

  async getItem(id: string, permissions?: string[]) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id },
      include: { balances: { include: { warehouse: true, location: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    return presentInventoryItem(stripInventoryCostFields(item, permissions));
  }

  async listItemTransactions(id: string, query: PaginationDto, permissions?: string[]) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
      select: { id: true },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });

    const where = { inventoryItemId: id };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];
    const warehouses = warehouseIds.length
      ? await this.prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, code: true, nameEn: true, nameAr: true },
        })
      : [];
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));

    const data = stripInventoryCostList(
      rows.map((row) => ({
        ...row,
        warehouse: warehouseById.get(row.warehouseId) ?? null,
      })),
      permissions,
    );

    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async createItem(
    dto: {
      sku?: string;
      nameAr: string;
      nameEn: string;
      nameHe?: string;
      unit?: string;
      category?: string;
      minStock?: number;
      maxStock?: number;
      reorderQty?: number;
      standardCost?: number;
      barcode?: string;
      qrCode?: string;
      materialId?: string;
      color?: string;
      materialType?: string;
      size?: string;
      customMeasurements?: Array<{
        id?: string;
        nameEn: string;
        nameAr: string;
        nameHe?: string;
        value?: number | null;
        unit?: string | null;
      }> | null;
      preferredSupplierId?: string;
      description?: string;
      imageUrl?: string | null;
    },
    userId: string,
  ) {
    const customMeasurements = this.normalizeCustomMeasurements(dto.customMeasurements);
    const size =
      customMeasurements != null
        ? summarizeInventoryMeasurements(customMeasurements)
        : dto.size?.trim() || undefined;
    const providedSku = dto.sku?.trim();
    const classified = classifyInventoryCategory(dto.category);
    const sku =
      providedSku ||
      (await this.nextInventorySku(dto.category, classified.itemClass, classified.materialGroup));

    const providedQr = dto.qrCode?.trim() || undefined;
    const qrCode = providedQr || sku;

    const data = {
      sku,
      nameAr: dto.nameAr.trim(),
      nameEn: dto.nameEn.trim(),
      nameHe: dto.nameHe?.trim() || undefined,
      unit: dto.unit?.trim() || 'pcs',
      category: (dto.category as never) || undefined,
      itemClass: classified.itemClass as never,
      materialGroup: classified.materialGroup as never,
      isPurchasable: classified.isPurchasable,
      classificationReviewRequired: classified.reviewRequired,
      minStock: roundMoney(dto.minStock ?? 0),
      maxStock: dto.maxStock != null ? roundMoney(dto.maxStock) : undefined,
      reorderQty: dto.reorderQty != null ? roundMoney(dto.reorderQty) : undefined,
      standardCost: roundMoney(dto.standardCost ?? 0),
      barcode: dto.barcode?.trim() || undefined,
      qrCode,
      materialId: dto.materialId,
      color: dto.color?.trim() || undefined,
      materialType: dto.materialType?.trim() || undefined,
      size: size || undefined,
      customMeasurements:
        customMeasurements != null
          ? (customMeasurements as Prisma.InputJsonValue)
          : undefined,
      preferredSupplierId: dto.preferredSupplierId || undefined,
      description: dto.description,
      imageUrl: dto.imageUrl?.trim() || undefined,
    };

    let item;
    try {
      item = await this.prisma.inventoryItem.create({ data });
    } catch (err) {
      if (!providedSku && this.isSkuConflict(err)) {
        data.sku = await this.nextInventorySku(
          dto.category,
          classified.itemClass,
          classified.materialGroup,
        );
        if (!providedQr) data.qrCode = data.sku;
        item = await this.prisma.inventoryItem.create({ data });
      } else {
        throw err;
      }
    }

    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'inventory-item.create',
        entityType: 'InventoryItem',
        entityId: item.id,
        newValues: { sku: item.sku },
      },
    });
    return withItemScanCode(item);
  }

  async updateItem(
    id: string,
    dto: Partial<{
      nameAr: string;
      nameEn: string;
      nameHe: string | null;
      unit: string;
      category: string;
      minStock: number;
      maxStock: number;
      reorderQty: number | null;
      standardCost: number;
      barcode: string;
      isActive: boolean;
      color: string;
      materialType: string;
      size: string;
      customMeasurements: Array<{
        id?: string;
        nameEn: string;
        nameAr: string;
        nameHe?: string;
        value?: number | null;
        unit?: string | null;
      }> | null;
      preferredSupplierId: string | null;
      description: string;
      imageUrl: string | null;
    }>,
    userId: string,
  ) {
    await this.prisma.inventoryItem.findFirstOrThrow({ where: { id, archivedAt: null } });
    const customMeasurements =
      dto.customMeasurements !== undefined
        ? this.normalizeCustomMeasurements(dto.customMeasurements)
        : undefined;
    const sizeFromMeasurements =
      customMeasurements !== undefined
        ? summarizeInventoryMeasurements(customMeasurements)
        : undefined;
    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.nameHe !== undefined ? { nameHe: dto.nameHe?.trim() || null } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category as never } : {}),
        ...(dto.minStock !== undefined ? { minStock: roundMoney(dto.minStock) } : {}),
        ...(dto.maxStock !== undefined ? { maxStock: roundMoney(dto.maxStock) } : {}),
        ...(dto.reorderQty !== undefined
          ? { reorderQty: dto.reorderQty == null ? null : roundMoney(dto.reorderQty) }
          : {}),
        ...(dto.standardCost !== undefined
          ? { standardCost: roundMoney(dto.standardCost) }
          : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.color !== undefined ? { color: dto.color.trim() || null } : {}),
        ...(dto.materialType !== undefined
          ? { materialType: dto.materialType.trim() || null }
          : {}),
        ...(customMeasurements !== undefined
          ? {
              customMeasurements: (customMeasurements ??
                Prisma.JsonNull) as Prisma.InputJsonValue,
              size: sizeFromMeasurements,
            }
          : dto.size !== undefined
            ? { size: dto.size.trim() || null }
            : {}),
        ...(dto.preferredSupplierId !== undefined
          ? { preferredSupplierId: dto.preferredSupplierId || null }
          : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl?.trim() || null }
          : {}),
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'inventory-item.update',
        entityType: 'InventoryItem',
        entityId: item.id,
        newValues: dto as object,
      },
    });
    return withItemScanCode(item);
  }

  async syncFromMaterials(userId: string) {
    const materials = await this.prisma.material.findMany({
      where: { archivedAt: null, isActive: true },
    });
    let created = 0;
    for (const material of materials) {
      const existing = await this.prisma.inventoryItem.findFirst({
        where: {
          OR: [{ materialId: material.id }, { sku: material.sku }],
          archivedAt: null,
        },
      });
      if (existing) {
        if (!existing.materialId) {
          await this.prisma.inventoryItem.update({
            where: { id: existing.id },
            data: { materialId: material.id },
          });
        }
        continue;
      }
      await this.prisma.inventoryItem.create({
        data: {
          sku: material.sku,
          qrCode: material.sku,
          nameAr: material.nameAr,
          nameEn: material.nameEn,
          unit: material.unit,
          category: material.category,
          itemClass: classifyInventoryCategory(material.category).itemClass as never,
          materialGroup: classifyInventoryCategory(material.category).materialGroup as never,
          isPurchasable: classifyInventoryCategory(material.category).isPurchasable,
          materialId: material.id,
          minStock: material.minStock ?? 0,
          color: material.color ?? undefined,
        },
      });
      created += 1;
    }
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'inventory-item.sync-materials',
        entityType: 'InventoryItem',
        entityId: 'bulk',
        newValues: { created },
      },
    });
    return { created, scanned: materials.length };
  }

  async applyMovement(params: {
    type: InventoryTxType;
    inventoryItemId: string;
    warehouseId: string;
    quantity: number;
    unitCost?: number;
    notes?: string;
    userId: string;
    idempotencyKey?: string;
    allowNegative?: boolean;
    outbound?: boolean;
    referenceType?: string;
    referenceId?: string;
    productionOrderId?: string;
    productionTaskId?: string;
    salesOrderId?: string;
    locationId?: string | null;
    reservedDelta?: number;
    db?: Prisma.TransactionClient;
  }): Promise<{ id: string }> {
    const hasReserve =
      params.reservedDelta != null && Number(params.reservedDelta) !== 0;
    if (params.quantity < 0 || (params.quantity === 0 && !hasReserve)) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantity must be positive.' });
    }

    const run = async (tx: Prisma.TransactionClient) => {
      if (params.idempotencyKey) {
        const existing = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) return existing;
      }

      const [item, warehouse] = await Promise.all([
        tx.inventoryItem.findUniqueOrThrow({ where: { id: params.inventoryItemId } }),
        tx.warehouse.findUniqueOrThrow({ where: { id: params.warehouseId } }),
      ]);
      assertItemMutable(item);
      if (
        !itemClassCompatibleWithWarehouse(
          item.itemClass as InventoryItemClassValue,
          warehouse.type as WarehouseTypeValue,
        )
      ) {
        throw new BadRequestException({
          code: 'WAREHOUSE_TYPE_MISMATCH',
          message: 'Selected warehouse cannot store this inventory type.',
        });
      }

      const outboundTypes: InventoryTxType[] = [
        InventoryTxType.PRODUCTION_ISSUE,
        InventoryTxType.DELIVERY_ISSUE,
        InventoryTxType.DAMAGE,
        InventoryTxType.SCRAP,
        InventoryTxType.SEMI_FINISHED_ISSUE,
      ];
      const isOutbound =
        params.outbound === true || outboundTypes.includes(params.type);
      const signedQty =
        params.quantity === 0 ? 0 : isOutbound ? -params.quantity : params.quantity;

      if (isOutbound && !params.locationId && params.quantity > 0) {
        const picks = await pickBinsForIssue(tx, {
          inventoryItemId: params.inventoryItemId,
          warehouseId: params.warehouseId,
          quantity: params.quantity,
        });
        if (picks.length > 1) {
          let last: { id: string } | undefined;
          let reservedLeft = params.reservedDelta ?? 0;
          for (let i = 0; i < picks.length; i += 1) {
            const pick = picks[i]!;
            let sliceReserved = 0;
            if (reservedLeft !== 0 && i === picks.length - 1) {
              sliceReserved = reservedLeft;
            } else if (reservedLeft < 0) {
              sliceReserved = Math.max(reservedLeft, -pick.quantity);
              reservedLeft -= sliceReserved;
            } else if (reservedLeft > 0) {
              sliceReserved = Math.min(reservedLeft, pick.quantity);
              reservedLeft -= sliceReserved;
            }
            last = await this.applyMovement({
              ...params,
              quantity: pick.quantity,
              locationId: pick.locationId,
              reservedDelta: sliceReserved,
              idempotencyKey: params.idempotencyKey
                ? `${params.idempotencyKey}:${pick.locationId}`
                : undefined,
              db: tx,
            });
          }
          return last!;
        }
        params = { ...params, locationId: picks[0]!.locationId };
      }

      const locationId = await resolveBinId(tx, params.warehouseId, params.locationId);

      const balance = await tx.inventoryBalance.findFirst({
        where: {
          inventoryItemId: params.inventoryItemId,
          warehouseId: params.warehouseId,
          locationId,
        },
      });

      const currentAvail = Number(balance?.availableQty ?? 0);
      const currentReserved = Number(balance?.reservedQty ?? 0);
      const nextAvail = currentAvail + signedQty;
      const nextReserved = currentReserved + (params.reservedDelta ?? 0);
      if (nextAvail < 0 && !params.allowNegative) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Inventory cannot go negative.',
        });
      }
      if (nextReserved < 0) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Reserved quantity cannot go negative.',
        });
      }

      const links = await resolveInventoryCostLinks(tx, params);
      const number = await this.sequences.next('INVTX', 'INV');
      let created;
      try {
        created = await tx.inventoryTransaction.create({
          data: {
            number,
            type: params.type,
            inventoryItemId: params.inventoryItemId,
            warehouseId: params.warehouseId,
            locationId,
            quantity: roundMoney(signedQty),
            unitCost: params.unitCost != null ? roundMoney(params.unitCost) : undefined,
            notes: params.notes,
            idempotencyKey: params.idempotencyKey,
            createdById: params.userId,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
            productionOrderId: links.productionOrderId,
            productionTaskId: links.productionTaskId,
            salesOrderId: links.salesOrderId,
          },
        });
      } catch (err) {
        if (params.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await tx.inventoryTransaction.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
          });
          if (existing) return existing;
        }
        throw err;
      }

      if (balance) {
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            availableQty: roundMoney(nextAvail),
            reservedQty: roundMoney(nextReserved),
          },
        });
      } else {
        await tx.inventoryBalance.create({
          data: {
            inventoryItemId: params.inventoryItemId,
            warehouseId: params.warehouseId,
            locationId,
            availableQty: roundMoney(nextAvail),
            reservedQty: roundMoney(nextReserved),
          },
        });
      }

      return created;
    };

    if (params.db) return run(params.db);
    if (!this.opsNotify) {
      return this.prisma.$transaction((tx) => run(tx));
    }
    const itemMeta = await this.prisma.inventoryItem.findUnique({
      where: { id: params.inventoryItemId },
      select: { sku: true, minStock: true },
    });
    const beforeQty = await this.totalAvailableQty(params.inventoryItemId);
    const created = await this.prisma.$transaction((tx) => run(tx));
    await this.emitAfterStockCommit({
      created,
      type: params.type,
      itemId: params.inventoryItemId,
      sku: itemMeta?.sku ?? params.inventoryItemId,
      minStock: Number(itemMeta?.minStock ?? 0),
      beforeQty,
      actorUserId: params.userId,
      referenceType: params.referenceType,
    });
    return created;
  }

  private async totalAvailableQty(inventoryItemId: string): Promise<number> {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { inventoryItemId },
      select: { availableQty: true },
    });
    return balances.reduce((s, b) => s + Number(b.availableQty), 0);
  }

  private async emitAfterStockCommit(input: {
    created: { id: string };
    type: InventoryTxType;
    itemId: string;
    sku: string;
    minStock: number;
    beforeQty: number;
    actorUserId: string;
    referenceType?: string;
  }) {
    if (!this.opsNotify) return;
    const afterQty = await this.totalAvailableQty(input.itemId);
    await this.opsNotify
      .onInventoryPosted({
        type: input.type,
        txId: input.created.id,
        itemId: input.itemId,
        sku: input.sku,
        actorUserId: input.actorUserId,
        referenceType: input.referenceType,
      })
      .catch(() => undefined);
    if (stockCrossedBelowMin(input.beforeQty, afterQty, input.minStock)) {
      await this.opsNotify
        .onLowStockCross(
          {
            itemId: input.itemId,
            sku: input.sku,
            before: input.beforeQty,
            after: afterQty,
            minStock: input.minStock,
          },
          input.actorUserId,
        )
        .catch(() => undefined);
    }
  }

  async receive(
    dto: {
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      unitCost?: number;
      notes?: string;
      idempotencyKey?: string;
      locationId?: string | null;
    },
    userId: string,
  ) {
    const result = await this.applyMovement({
      type: InventoryTxType.PURCHASE_RECEIPT,
      ...dto,
      userId,
    });
    await this.purchasing.maybeAutoReorderAfterStockChange(dto.inventoryItemId, userId);
    await this.retryWaitingMaterialOrders(userId).catch(() => undefined);
    return result;
  }

  async issue(
    dto: {
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      notes?: string;
      idempotencyKey?: string;
      locationId?: string | null;
    },
    userId: string,
  ) {
    const result = await this.applyMovement({
      type: InventoryTxType.PRODUCTION_ISSUE,
      ...dto,
      userId,
    });
    await this.purchasing.maybeAutoReorderAfterStockChange(dto.inventoryItemId, userId);
    return result;
  }

  async createTransfer(
    dto: {
      fromWarehouseId: string;
      toWarehouseId: string;
      notes?: string;
      lines: {
        inventoryItemId: string;
        quantity: number;
        fromLocationId?: string | null;
        toLocationId?: string | null;
      }[];
    },
    userId: string,
  ) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      const distinctBins = dto.lines.every(
        (l) => l.fromLocationId && l.toLocationId && l.fromLocationId !== l.toLocationId,
      );
      if (!distinctBins) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Same-warehouse transfers must name two different bins.',
        });
      }
    }
    const [fromWh, toWh] = await Promise.all([
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: dto.fromWarehouseId } }),
      this.prisma.warehouse.findUniqueOrThrow({ where: { id: dto.toWarehouseId } }),
    ]);
    if (fromWh.type !== toWh.type) {
      throw new BadRequestException({
        code: 'WAREHOUSE_TYPE_MISMATCH',
        message: 'Transfers are only allowed between warehouses of the same type.',
      });
    }
    await this.assertMutableItemIds(dto.lines.map((l) => l.inventoryItemId));
    const number = await this.sequences.next('TRF', 'TRF');
    return this.prisma.warehouseTransfer.create({
      data: {
        number,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        notes: dto.notes,
        status: 'DRAFT',
        createdById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            quantity: roundMoney(l.quantity),
            fromLocationId: l.fromLocationId ?? undefined,
            toLocationId: l.toLocationId ?? undefined,
          })),
        },
      },
      include: { lines: true, fromWarehouse: true, toWarehouse: true },
    });
  }

  async completeTransfer(id: string, userId: string) {
    const transfer = await this.prisma.warehouseTransfer.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    if (transfer.status === 'COMPLETED') return transfer;
    if (transfer.status !== 'DRAFT' && transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot complete transfer in status ${transfer.status}.`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const qty = Number(line.quantity);
        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: line.inventoryItemId },
          select: { id: true, itemClass: true },
        });
        const lotTracked =
          item.itemClass === 'FINISHED_GOOD' || item.itemClass === 'SEMI_FINISHED_GOOD';
        const fromLocationId = await resolveBinId(
          tx,
          transfer.fromWarehouseId,
          line.fromLocationId,
        );
        const toLocationId = await resolveBinId(
          tx,
          transfer.toWarehouseId,
          line.toLocationId,
        );

        let reservedToMove = 0;
        if (lotTracked) {
          const moved = await this.moveLotsForWarehouseTransfer(tx, {
            inventoryItemId: line.inventoryItemId,
            fromWarehouseId: transfer.fromWarehouseId,
            toWarehouseId: transfer.toWarehouseId,
            fromLocationId,
            toLocationId,
            quantity: qty,
          });
          reservedToMove = moved.reservedQty;
          await this.ensureLotBalanceForIssue(tx, {
            inventoryItemId: line.inventoryItemId,
            warehouseId: transfer.fromWarehouseId,
            locationId: fromLocationId,
            quantity: qty,
            status: 'AVAILABLE',
          });
          if (reservedToMove > 0) {
            const bal = await tx.inventoryBalance.findFirst({
              where: {
                inventoryItemId: line.inventoryItemId,
                warehouseId: transfer.fromWarehouseId,
                locationId: fromLocationId,
              },
            });
            if (bal && Number(bal.reservedQty) < reservedToMove) {
              await tx.inventoryBalance.update({
                where: { id: bal.id },
                data: { reservedQty: roundMoney(reservedToMove) },
              });
            }
          }
        }

        await this.applyMovement({
          type: InventoryTxType.WAREHOUSE_TRANSFER,
          inventoryItemId: line.inventoryItemId,
          warehouseId: transfer.fromWarehouseId,
          locationId: fromLocationId,
          quantity: qty,
          outbound: true,
          userId,
          referenceType: 'WarehouseTransfer',
          referenceId: transfer.id,
          notes: `Transfer ${transfer.number} out`,
          idempotencyKey: `transfer-out:${id}:${line.id}`,
          reservedDelta: lotTracked ? -reservedToMove : 0,
          db: tx,
        });
        await this.applyMovement({
          type: InventoryTxType.WAREHOUSE_TRANSFER,
          inventoryItemId: line.inventoryItemId,
          warehouseId: transfer.toWarehouseId,
          locationId: toLocationId,
          quantity: qty,
          userId,
          referenceType: 'WarehouseTransfer',
          referenceId: transfer.id,
          notes: `Transfer ${transfer.number} in`,
          idempotencyKey: `transfer-in:${id}:${line.id}`,
          reservedDelta: lotTracked ? reservedToMove : 0,
          db: tx,
        });
      }

      return tx.warehouseTransfer.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: { lines: true, fromWarehouse: true, toWarehouse: true },
      });
    });
  }

  /**
   * Move SEMI/FG lots with a warehouse transfer (FIFO whole lots).
   * Lots land in the destination bin rather than being un-binned.
   */
  private async moveLotsForWarehouseTransfer(
    db: Prisma.TransactionClient,
    params: {
      inventoryItemId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
    },
  ): Promise<{ reservedQty: number; movedQty: number }> {
    const lots = await db.inventoryLot.findMany({
      where: {
        inventoryItemId: params.inventoryItemId,
        warehouseId: params.fromWarehouseId,
        status: { in: ['AVAILABLE', 'RESERVED'] },
        OR: [{ locationId: params.fromLocationId }, { locationId: null }],
      },
      orderBy: { producedAt: 'asc' },
    });
    let remaining = params.quantity;
    let reservedQty = 0;
    let movedQty = 0;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const lotQty = Number(lot.quantity);
      if (!(lotQty > 0) || lotQty > remaining + 1e-9) continue;
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: {
          warehouseId: params.toWarehouseId,
          locationId: params.toLocationId,
        },
      });
      remaining = Number(roundMoney(remaining - lotQty));
      movedQty = Number(roundMoney(movedQty + lotQty));
      if (lot.status === 'RESERVED') {
        reservedQty = Number(roundMoney(reservedQty + lotQty));
      }
    }
    return { reservedQty, movedQty };
  }

  listTransfers(query: PaginationDto & { warehouseType?: string }) {
    const where = query.warehouseType
      ? { fromWarehouse: { type: query.warehouseType as never } }
      : {};
    return this.prisma.$transaction([
      this.prisma.warehouseTransfer.count({ where }),
      this.prisma.warehouseTransfer.findMany({
        where,
        include: { fromWarehouse: true, toWarehouse: true, lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]).then(([totalItems, data]) => ({
      data,
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    }));
  }

  async createCount(
    dto: {
      warehouseId: string;
      notes?: string;
      lines: { inventoryItemId: string; countedQty?: number; locationId?: string | null }[];
    },
    userId: string,
  ) {
    await this.assertMutableItemIds(dto.lines.map((l) => l.inventoryItemId));
    const number = await this.sequences.next('CNT', 'CNT');
    const lines = await Promise.all(
      dto.lines.map(async (l) => {
        const locationId = await resolveBinId(this.prisma, dto.warehouseId, l.locationId);
        const balance = await this.prisma.inventoryBalance.findFirst({
          where: {
            inventoryItemId: l.inventoryItemId,
            warehouseId: dto.warehouseId,
            locationId,
          },
        });
        const systemQty = Number(balance?.availableQty ?? 0);
        const countedQty = l.countedQty != null ? Number(l.countedQty) : undefined;
        return {
          inventoryItemId: l.inventoryItemId,
          locationId,
          systemQty: roundMoney(systemQty),
          countedQty: countedQty != null ? roundMoney(countedQty) : undefined,
          varianceQty:
            countedQty != null ? roundMoney(countedQty - systemQty) : undefined,
        };
      }),
    );

    return this.prisma.inventoryCount.create({
      data: {
        number,
        warehouseId: dto.warehouseId,
        notes: dto.notes,
        status: 'DRAFT',
        createdById: userId,
        lines: { create: lines },
      },
      include: { lines: { include: { inventoryItem: true, location: true } } },
    });
  }

  async scanCount(
    dto: {
      warehouseId: string;
      code: string;
      countedQty: number;
      notes?: string;
      postImmediately?: boolean;
      locationId?: string | null;
    },
    userId: string,
  ) {
    const item = await this.findByCode(dto.code.trim(), ['inventory.cost.read']);
    const count = await this.createCount(
      {
        warehouseId: dto.warehouseId,
        notes: dto.notes ?? `Scan ${dto.code.trim()}`,
        lines: [
          {
            inventoryItemId: item.id,
            countedQty: Number(dto.countedQty),
            locationId: dto.locationId,
          },
        ],
      },
      userId,
    );
    if (dto.postImmediately) {
      return this.postCount(count.id, userId);
    }
    return count;
  }

  async postCount(id: string, userId: string) {
    const count = await this.prisma.inventoryCount.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    if (count.status === 'POSTED') return count;

    for (const line of count.lines) {
      if (line.countedQty == null) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'All lines must have counted quantities before posting.',
        });
      }
      const variance = Number(line.countedQty) - Number(line.systemQty);
      if (variance === 0) continue;
      const locationId = await resolveBinId(
        this.prisma,
        count.warehouseId,
        line.locationId,
      );
      await this.applyMovement({
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: line.inventoryItemId,
        warehouseId: count.warehouseId,
        locationId,
        quantity: Math.abs(variance),
        outbound: variance < 0,
        userId,
        referenceType: 'InventoryCount',
        referenceId: count.id,
        notes: `Count ${count.number} adjustment`,
        allowNegative: true,
      });
    }

    return this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'POSTED', countedAt: new Date() },
      include: { lines: { include: { inventoryItem: true, location: true } } },
    });
  }

  async listCounts(query: PaginationDto & { warehouseType?: string }) {
    const where = query.warehouseType
      ? {
          warehouseId: {
            in: (
              await this.prisma.warehouse.findMany({
                where: { type: query.warehouseType as never },
                select: { id: true },
              })
            ).map((row) => row.id),
          },
        }
      : {};
    return this.prisma.$transaction([
      this.prisma.inventoryCount.count({ where }),
      this.prisma.inventoryCount.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]).then(([totalItems, data]) => ({
      data,
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    }));
  }

  listWarehouses(type?: string) {
    return this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as never } : {}),
      },
      include: { locations: true, _count: { select: { balances: true } } },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async lowStock(permissions?: string[]) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null, itemClass: 'RAW_MATERIAL' },
      include: { balances: true },
    });
    return stripInventoryCostList(
      items
        .map((item) => {
          const qty = aggregateStockQty(item.balances);
          return withItemScanCode({
            ...item,
            ...qty,
            availableQty: qty.onHandQty,
          });
        })
        .filter((item) => item.onHandQty <= Number(item.minStock)),
      permissions,
    );
  }

  async listOpenReceipts(inventoryItemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId },
      select: { id: true, sku: true, unit: true, archivedAt: true, isActive: true },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });

    const RECEIVABLE = new Set<PurchaseOrderStatus>([
      PurchaseOrderStatus.APPROVED,
      PurchaseOrderStatus.SENT,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ]);
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: {
        archivedAt: null,
        status: { in: [...RECEIVABLE] },
        lines: { some: { inventoryItemId: item.id } },
      },
      select: {
        id: true,
        number: true,
        status: true,
        expectedDeliveryDate: true,
        warehouseId: true,
        supplier: { select: { name: true, nameEn: true, nameAr: true, nameHe: true } },
        lines: {
          where: { inventoryItemId: item.id },
          select: { inventoryItemId: true, quantity: true, unit: true },
        },
        goodsReceipts: {
          select: {
            lines: {
              where: { inventoryItemId: item.id },
              select: { receivedQty: true },
            },
          },
        },
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });

    return purchaseOrders.flatMap((po) => {
      const orderedQty = po.lines.reduce((s, l) => s + Number(l.quantity), 0);
      const receivedQty = po.goodsReceipts.reduce(
        (s, grn) => s + grn.lines.reduce((g, l) => g + Number(l.receivedQty), 0),
        0,
      );
      const remainingQty = roundMoney(orderedQty - receivedQty);
      if (!(Number(remainingQty) > 0)) return [];
      const supplierName =
        po.supplier.nameEn || po.supplier.name || po.supplier.nameAr || po.supplier.nameHe || '';
      return [
        {
          purchaseOrderId: po.id,
          purchaseOrderNumber: po.number,
          supplierName,
          supplierNameAr: po.supplier.nameAr ?? null,
          supplierNameHe: po.supplier.nameHe ?? null,
          orderedQty: roundMoney(orderedQty),
          receivedQty: roundMoney(receivedQty),
          remainingQty,
          unit: po.lines[0]?.unit || item.unit,
          expectedDeliveryDate: po.expectedDeliveryDate,
          suggestedWarehouseId: po.warehouseId,
          status: po.status,
        },
      ];
    });
  }

  private async assertMutableItemIds(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: unique } },
      select: { id: true, archivedAt: true, isActive: true },
    });
    if (items.length !== unique.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    }
    for (const row of items) assertItemMutable(row);
  }

  private async nextInventorySku(
    category?: string,
    itemClass?: InventoryItemClassValue,
    materialGroup?: RawMaterialGroupValue | null,
  ): Promise<string> {
    const prefix = itemClass
      ? skuPrefixForItemClass(itemClass, materialGroup, category)
      : skuPrefixForCategory(category);
    const rows = await this.prisma.inventoryItem.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    return nextSkuFromExisting(
      prefix,
      rows.map((row) => row.sku),
    );
  }

  private isSkuConflict(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }

  private normalizeCustomMeasurements(
    rows:
      | Array<{
          id?: string;
          nameEn: string;
          nameAr: string;
          nameHe?: string;
          value?: number | null;
          unit?: string | null;
        }>
      | null
      | undefined,
  ): Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string;
    value: number | null;
    unit?: string;
  }> | null {
    if (rows == null) return null;
    return rows
      .filter((r) => r && String(r.nameEn ?? '').trim() && String(r.nameAr ?? '').trim())
      .map((r, index) => {
        const unitRaw = String(r.unit ?? 'cm').trim().slice(0, 24);
        const unit = unitRaw || 'cm';
        return {
          id: String(r.id || '').trim() || `m-${Date.now().toString(36)}-${index}`,
          nameEn: String(r.nameEn).trim(),
          nameAr: String(r.nameAr).trim(),
          ...(r.nameHe?.trim() ? { nameHe: r.nameHe.trim() } : {}),
          value:
            r.value != null && Number.isFinite(Number(r.value)) ? Number(r.value) : null,
          unit,
        };
      });
  }

  async overview() {
    const [groups, wipLots, fgLots, fgBalances] = await Promise.all([
      this.listGroups(),
      this.prisma.inventoryLot.findMany({
        where: { status: { in: ['AVAILABLE', 'RESERVED'] }, inventoryItem: { itemClass: 'SEMI_FINISHED_GOOD' } },
        select: { quantity: true, status: true },
      }),
      this.prisma.inventoryLot.findMany({
        where: { status: { in: ['AVAILABLE', 'RESERVED'] }, inventoryItem: { itemClass: 'FINISHED_GOOD' } },
        select: { quantity: true, status: true, salesOrderId: true },
      }),
      this.prisma.inventoryBalance.findMany({
        where: { inventoryItem: { itemClass: 'FINISHED_GOOD', archivedAt: null } },
        select: { availableQty: true, reservedQty: true },
      }),
    ]);
    const rawMaterials = {
      itemCount: groups.reduce((s, g) => s + g.materialCount, 0),
      lowStockCount: groups.reduce((s, g) => s + g.lowStockCount, 0),
      groups: Object.fromEntries(
        groups.map((g) => [g.categoryGroup.toUpperCase(), g]),
      ),
    };
    const semiQty = wipLots.reduce((s, l) => s + Number(l.quantity), 0);
    const fgAvail = fgBalances.reduce((s, b) => s + Number(b.availableQty), 0);
    const fgReserved = fgBalances.reduce((s, b) => s + Number(b.reservedQty), 0);
    const fgFree = Math.max(0, fgAvail - fgReserved);
    const fgLotQty = fgLots.reduce((s, l) => s + Number(l.quantity), 0);
    return {
      rawMaterials,
      semiFinished: {
        itemCount: wipLots.length,
        totalQty: roundMoney(semiQty),
        waitingCount: wipLots.filter((l) => l.status === 'AVAILABLE').length,
      },
      finishedGoods: {
        itemCount: fgBalances.length,
        lotCount: fgLots.length,
        onHandQty: roundMoney(fgAvail),
        reservedQty: roundMoney(fgReserved),
        freeQty: roundMoney(fgFree),
        availableQty: roundMoney(fgAvail),
        readyForDeliveryQty: roundMoney(fgLotQty),
        waitingForTruckQty: roundMoney(fgLotQty),
      },
    };
  }

  async listSemiFinished(query: ListSemiFinishedDto | (PaginationDto & { q?: string; warehouseId?: string; origin?: 'normal' | 'returned' })) {
    const originWhere = inventoryLotOriginWhere(
      parseProductionOrigin((query as { origin?: string }).origin),
    );
    const where: Prisma.InventoryLotWhereInput = {
      status: { in: ['AVAILABLE', 'RESERVED', 'REQUIRES_REVIEW', 'PARTIALLY_CONSUMED'] },
      inventoryItem: {
        itemClass: 'SEMI_FINISHED_GOOD',
        archivedAt: null,
        ...(query.q
          ? {
              OR: [
                { nameEn: { contains: query.q, mode: 'insensitive' } },
                { nameAr: { contains: query.q, mode: 'insensitive' } },
                { sku: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(originWhere ?? {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.inventoryLot.count({ where }),
      this.prisma.inventoryLot.findMany({
        where,
        include: {
          inventoryItem: { include: { product: true } },
          warehouse: true,
          productionOrder: {
            select: {
              id: true,
              number: true,
              productDescription: true,
              salesOrder: {
                select: {
                  id: true,
                  number: true,
                  projectName: true,
                  customer: { select: { id: true, nameEn: true, nameAr: true, code: true } },
                },
              },
              returnRequest: {
                select: {
                  id: true,
                  number: true,
                  salesOrder: {
                    select: {
                      id: true,
                      number: true,
                      projectName: true,
                      customer: { select: { id: true, nameEn: true, nameAr: true, code: true } },
                    },
                  },
                },
              },
              workflowSnapshot: {
                select: {
                  nodes: {
                    select: {
                      stageCode: true,
                      consumesSemiFinished: true,
                      isSkipped: true,
                      nameEnSnapshot: true,
                      nameArSnapshot: true,
                    },
                  },
                },
              },
            },
          },
          stageInstance: { include: { stageDefinition: true } },
          location: { select: { id: true, code: true, name: true } },
          wipPiece: { select: { kit: { select: { id: true, qrCode: true } } } },
        },
        orderBy: { producedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    const data = await this.withLotTraceability(rows);
    return {
      data: data.map((lot) => {
        const next = lot.productionOrder?.workflowSnapshot?.nodes.find(
          (n) => n.consumesSemiFinished && !n.isSkipped,
        );
        return {
          ...lot,
          wipKit: lot.wipPiece?.kit ?? null,
          salesOrderNumber:
            lot.productionOrder?.salesOrder?.number ??
            lot.productionOrder?.returnRequest?.salesOrder?.number ??
            null,
          dealerNameEn:
            lot.productionOrder?.salesOrder?.customer?.nameEn ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.nameEn ??
            null,
          dealerNameAr:
            lot.productionOrder?.salesOrder?.customer?.nameAr ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.nameAr ??
            null,
          projectName:
            lot.productionOrder?.salesOrder?.projectName ??
            lot.productionOrder?.returnRequest?.salesOrder?.projectName ??
            null,
          nextConsumingStageCode: next?.stageCode ?? null,
          nextConsumingStageNameEn: next?.nameEnSnapshot ?? null,
          nextConsumingStageNameAr: next?.nameArSnapshot ?? null,
        };
      }),
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
  }

  /**
   * Finished Goods outbound desk — lots in warehouse or history presence window.
   * Enriched with package labels, leave-by delivery, and load progress (checkmarks ≠ issue).
   */
  async listFinishedLots(query: ListFinishedLotsDto) {
    const scope = query.scope === 'history' ? 'history' : 'inWarehouse';
    const q = String(query.q ?? '').trim();
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    let fromStart: Date | null = null;
    let toEnd: Date | null = null;
    if (scope === 'history') {
      const fromRaw = query.from
        ? new Date(query.from)
        : new Date(now.getTime() - 30 * dayMs);
      const toRaw = query.to ? new Date(query.to) : now;
      fromStart = new Date(fromRaw);
      fromStart.setHours(0, 0, 0, 0);
      toEnd = new Date(toRaw);
      toEnd.setHours(23, 59, 59, 999);
    }

    const textOr: Prisma.InventoryLotWhereInput[] = q
      ? [
          {
            inventoryItem: {
              OR: [
                { nameEn: { contains: q, mode: 'insensitive' } },
                { nameAr: { contains: q, mode: 'insensitive' } },
                { nameHe: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                {
                  product: {
                    OR: [
                      { nameEn: { contains: q, mode: 'insensitive' } },
                      { nameAr: { contains: q, mode: 'insensitive' } },
                      { nameHe: { contains: q, mode: 'insensitive' } },
                      { sku: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            },
          },
          { qrCode: { contains: q, mode: 'insensitive' } },
          {
            productionOrder: {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { productDescription: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          {
            salesOrder: {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { projectName: { contains: q, mode: 'insensitive' } },
                { externalOrderNumber: { contains: q, mode: 'insensitive' } },
                {
                  customer: {
                    OR: [
                      { nameEn: { contains: q, mode: 'insensitive' } },
                      { nameAr: { contains: q, mode: 'insensitive' } },
                      { name: { contains: q, mode: 'insensitive' } },
                      { code: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
                {
                  deliveries: {
                    some: { number: { contains: q, mode: 'insensitive' } },
                  },
                },
              ],
            },
          },
        ]
      : [];

    if (q) {
      textOr.push({
        productionOrder: {
          returnRequest: {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { salesOrder: { number: { contains: q, mode: 'insensitive' } } },
            ],
          },
        },
      });
      const matchingReturns = await this.prisma.returnRequest.findMany({
        where: { number: { contains: q, mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchingReturns.length) {
        textOr.push({
          sourceKey: {
            in: matchingReturns.map((r) => `${RETURN_QUARANTINE_PREFIX}${r.id}`),
          },
        });
      }
    }

    const originWhere = inventoryLotOriginWhere(query.origin);
    const historyStatuses: Prisma.InventoryLotWhereInput['status'] =
      scope === 'history' && query.origin === 'returned'
        ? { in: ['AVAILABLE', 'RESERVED', 'DELIVERED', 'SCRAPPED', 'DAMAGED', 'QUARANTINED'] }
        : scope === 'inWarehouse'
          ? { in: ['AVAILABLE', 'RESERVED'] }
          : { in: ['AVAILABLE', 'RESERVED', 'DELIVERED'] };
    const andFilters: Prisma.InventoryLotWhereInput[] = [];
    if (originWhere) andFilters.push(originWhere);
    if (textOr.length) andFilters.push({ OR: textOr });
    const where: Prisma.InventoryLotWhereInput = {
      inventoryItem: { itemClass: 'FINISHED_GOOD', archivedAt: null },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      status: historyStatuses,
      ...(scope === 'history' && toEnd ? { producedAt: { lte: toEnd } } : {}),
      ...(andFilters.length ? { AND: andFilters } : {}),
    };

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const lotInclude = {
      inventoryItem: { include: { product: true } },
      warehouse: true,
      location: { select: { id: true, code: true, name: true } },
      productionOrder: {
        select: {
          id: true,
          number: true,
          productDescription: true,
          originType: true,
          returnRequest: {
            select: {
              id: true,
              number: true,
              lifecycleState: true,
              salesOrder: {
                select: {
                  id: true,
                  number: true,
                  projectName: true,
                  customer: {
                    select: {
                      id: true,
                      nameEn: true,
                      nameAr: true,
                      nameHe: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      salesOrder: {
        select: {
          id: true,
          number: true,
          projectName: true,
          status: true,
          customer: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
              nameHe: true,
              name: true,
              code: true,
            },
          },
            deliveries: {
              where: {
                status: {
                  in: ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] as Array<
                    'PLANNED' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
                  >,
                },
              },
              orderBy: { deliveryDate: 'asc' as const },
              take: 3,
            select: {
              id: true,
              number: true,
              status: true,
              deliveryDate: true,
            },
          },
        },
      },
      stageInstance: { include: { stageDefinition: true } },
    };

    const loadFinishedLotPage = (
      pageWhere: Prisma.InventoryLotWhereInput,
      skip: number,
      take: number,
    ) =>
      this.prisma.inventoryLot.findMany({
        where: pageWhere,
        include: lotInclude as Prisma.InventoryLotInclude,
        orderBy: { producedAt: 'asc' as const },
        skip,
        take,
      }) as never;

    let totalItems: number;
    let rows: any[] = [];

    if (scope === 'history' && fromStart && toEnd) {
      const candidates = await this.prisma.inventoryLot.findMany({
        where,
        select: {
          id: true,
          status: true,
          producedAt: true,
          inventoryItemId: true,
          productionOrderId: true,
          salesOrder: {
            select: {
              deliveries: {
                where: { status: { in: ['PLANNED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] } },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { producedAt: 'asc' },
      });
      const delivered = candidates.filter((c) => c.status === 'DELIVERED');
      const candidateDeliveryIds = [
        ...new Set(delivered.flatMap((c) => (c.salesOrder?.deliveries ?? []).map((d) => d.id))),
      ];
      const candidatePoIds = [
        ...new Set(delivered.map((c) => c.productionOrderId).filter((id): id is string => Boolean(id))),
      ];
      const windowTxOr: Prisma.InventoryTransactionWhereInput[] = [
        ...(candidateDeliveryIds.length ? [{ referenceId: { in: candidateDeliveryIds } }] : []),
        ...(candidatePoIds.length ? [{ referenceId: { in: candidatePoIds } }] : []),
      ];
      const windowTxs =
        windowTxOr.length > 0
          ? await this.prisma.inventoryTransaction.findMany({
              where: {
                type: 'DELIVERY_ISSUE',
                OR: windowTxOr,
              },
              select: { referenceId: true, inventoryItemId: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            })
          : [];
      const { leftAtByDelivery, leftAtByItemPo } = indexDeliveryIssueLeftAt(windowTxs);
      const keptIds = candidates
        .filter((c) =>
          lotOverlapsHistoryWindow(
            c.producedAt,
            resolveLotLeftAt(c, leftAtByDelivery, leftAtByItemPo),
            fromStart,
            toEnd,
          ),
        )
        .map((c) => c.id);
      totalItems = keptIds.length;
      const pageIds = keptIds.slice(skip, skip + pageSize);
      rows = pageIds.length
        ? await loadFinishedLotPage({ id: { in: pageIds } }, 0, pageIds.length)
        : [];
    } else {
      totalItems = await this.prisma.inventoryLot.count({ where });
      rows = await loadFinishedLotPage(where, skip, pageSize);
    }

    const lotIds = rows.map((r) => r.id);
    const quarantineReturnIds = [
      ...new Set(
        rows
          .map((r) => returnIdFromQuarantineSourceKey(r.sourceKey))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const quarantineReturns =
      quarantineReturnIds.length > 0
        ? await this.prisma.returnRequest.findMany({
            where: { id: { in: quarantineReturnIds } },
            select: { id: true, number: true, lifecycleState: true },
          })
        : [];
    const quarantineReturnById = new Map(quarantineReturns.map((r) => [r.id, r]));
    const poIds = [
      ...new Set(rows.map((r) => r.productionOrderId).filter((id): id is string => Boolean(id))),
    ];
    const stageInstanceIds = [
      ...new Set(rows.map((r) => r.stageInstanceId).filter((id): id is string => Boolean(id))),
    ];
    const deliveryIds = [
      ...new Set(
        rows.flatMap((r) => (r.salesOrder?.deliveries ?? []).map((d: { id: string }) => d.id)),
      ),
    ];

    const [issueTxs, snapByStage, packNodes, loadPieces, inspections] = await Promise.all([
      lotIds.length
        ? this.prisma.inventoryTransaction.findMany({
            where: {
              type: 'DELIVERY_ISSUE',
              OR: [
                { referenceId: { in: deliveryIds.length ? deliveryIds : ['__none__'] } },
                ...(poIds.length
                  ? [{ referenceId: { in: poIds } }]
                  : []),
              ],
              createdAt: { gte: rows.reduce((min, r) => (r.producedAt < min ? r.producedAt : min), rows[0]?.producedAt ?? now) },
            },
            select: {
              id: true,
              referenceId: true,
              inventoryItemId: true,
              createdAt: true,
              warehouseId: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 2000,
          })
        : Promise.resolve([]),
      stageInstanceIds.length
        ? this.prisma.productionOrderWorkflowSnapshotNode.findMany({
            where: { stageInstanceId: { in: stageInstanceIds } },
            select: {
              stageInstanceId: true,
              expectedPieceCount: true,
              metadata: true,
            },
          })
        : Promise.resolve([]),
      poIds.length
        ? this.prisma.productionOrderWorkflowSnapshotNode.findMany({
            where: {
              snapshot: { productionOrderId: { in: poIds } },
              OR: [
                { inventoryTracking: InventoryTracking.PRODUCES_FINISHED },
                { stageCode: { in: ['PACKAGING', 'PACK'] } },
              ],
              isSkipped: false,
            },
            select: {
              expectedPieceCount: true,
              metadata: true,
              snapshot: { select: { productionOrderId: true } },
            },
          })
        : Promise.resolve([]),
      deliveryIds.length
        ? this.prisma.deliveryLoadPiece.findMany({
            where: { deliveryId: { in: deliveryIds } },
            select: { deliveryId: true, pieceIndex: true, loadedAt: true },
          })
        : Promise.resolve([]),
      poIds.length
        ? this.prisma.qualityInspection.findMany({
            where: { productionOrderId: { in: poIds }, result: { not: null } },
            orderBy: [{ inspectedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              productionOrderId: true,
              result: true,
              inspectedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const packMetaByStage = new Map<string, { count: number; labels: PieceLabel[] }>();
    for (const n of snapByStage) {
      if (!n.stageInstanceId) continue;
      const labels = pieceLabelsFromMetadata(n.metadata);
      const count = Math.max(1, labels.length || Math.floor(Number(n.expectedPieceCount) || 1));
      packMetaByStage.set(n.stageInstanceId, { count, labels });
    }
    const packMetaByPo = new Map<string, { count: number; labels: PieceLabel[] }>();
    for (const n of packNodes) {
      const poId = n.snapshot.productionOrderId;
      const labels = pieceLabelsFromMetadata(n.metadata);
      const count = Math.max(1, labels.length || Math.floor(Number(n.expectedPieceCount) || 1));
      if (!packMetaByPo.has(poId)) packMetaByPo.set(poId, { count, labels });
    }

    const loadByDelivery = new Map<string, { total: number; loaded: number }>();
    for (const p of loadPieces) {
      const cur = loadByDelivery.get(p.deliveryId) ?? { total: 0, loaded: 0 };
      cur.total += 1;
      if (p.loadedAt) cur.loaded += 1;
      loadByDelivery.set(p.deliveryId, cur);
    }

    const leftAtByItemPo = new Map<string, Date>();
    for (const tx of issueTxs) {
      const key = `${tx.inventoryItemId}:${tx.referenceId ?? ''}`;
      if (!leftAtByItemPo.has(key)) leftAtByItemPo.set(key, tx.createdAt);
    }

    // Also index by sales-order delivery id for lot matching
    const leftAtByDelivery = new Map<string, Date>();
    for (const tx of issueTxs) {
      if (!tx.referenceId) continue;
      const prev = leftAtByDelivery.get(tx.referenceId);
      if (!prev || tx.createdAt > prev) leftAtByDelivery.set(tx.referenceId, tx.createdAt);
    }

    const qcByPo = new Map<string, { result: string; inspectedAt: Date }>();
    for (const row of inspections) {
      if (!qcByPo.has(row.productionOrderId) && row.result) {
        qcByPo.set(row.productionOrderId, {
          result: row.result,
          inspectedAt: row.inspectedAt,
        });
      }
    }

    const enriched = rows
      .map((lot) => {
        const packMeta =
          (lot.stageInstanceId ? packMetaByStage.get(lot.stageInstanceId) : undefined) ??
          (lot.productionOrderId ? packMetaByPo.get(lot.productionOrderId) : undefined) ??
          null;
        const packagesPerUnit = packMeta?.count ?? 1;
        const pieceLabels = packMeta?.labels ?? [];
        const qty = Math.max(1, Math.floor(Number(lot.quantity) || 1));
        const packageCount = qty * packagesPerUnit;

        const openDelivery =
          (lot.salesOrder?.deliveries ?? []).find((d: { status: string }) =>
            ['PLANNED', 'READY'].includes(d.status),
          ) ??
          (lot.salesOrder?.deliveries ?? [])[0] ??
          null;
        const load = openDelivery ? loadByDelivery.get(openDelivery.id) : undefined;

        const leftAt = resolveLotLeftAt(lot, leftAtByDelivery, leftAtByItemPo);

        const enteredAt = lot.producedAt;
        const daysWaiting = Math.max(
          0,
          Math.floor(
            ((leftAt ?? now).getTime() - new Date(enteredAt).getTime()) / dayMs,
          ),
        );

        return {
          lot,
          packagesPerUnit,
          pieceLabels,
          packageCount,
          openDelivery,
          load,
          leftAt,
          enteredAt,
          daysWaiting,
        };
      });

    const traced = await this.withLotTraceability(enriched.map((s) => s.lot));
    const byId = new Map(traced.map((t) => [t.id, t]));

    return {
      data: enriched.map((row) => {
        const tracedLot = byId.get(row.lot.id);
        const lot = row.lot;
        const delivery = row.openDelivery;
        let agingBucket: 'READY_TODAY' | 'D1_3' | 'D4_7' | 'D8_PLUS' | 'NO_DELIVERY';
        if (!delivery || !['PLANNED', 'READY'].includes(delivery.status)) {
          agingBucket = lot.status === 'DELIVERED' ? 'READY_TODAY' : 'NO_DELIVERY';
        } else if (row.daysWaiting <= 0) agingBucket = 'READY_TODAY';
        else if (row.daysWaiting <= 3) agingBucket = 'D1_3';
        else if (row.daysWaiting <= 7) agingBucket = 'D4_7';
        else agingBucket = 'D8_PLUS';
        const qc = lot.productionOrderId ? qcByPo.get(lot.productionOrderId) : undefined;
        const packageSummary = row.pieceLabels.length
          ? row.pieceLabels
              .map((p, i) => {
                const name = p.nameEn || p.nameAr || `Package ${i + 1}`;
                return `${name} ×1`;
              })
              .join(' · ')
          : null;
        return {
          ...lot,
          ...(tracedLot ? { laterMovements: (tracedLot as { laterMovements?: unknown }).laterMovements } : {}),
          daysWaiting: row.daysWaiting,
          agingBucket,
          salesOrderNumber:
            lot.salesOrder?.number ??
            lot.productionOrder?.returnRequest?.salesOrder?.number ??
            null,
          projectName:
            lot.salesOrder?.projectName ??
            lot.productionOrder?.returnRequest?.salesOrder?.projectName ??
            null,
          dealerNameEn:
            lot.salesOrder?.customer?.nameEn ??
            lot.salesOrder?.customer?.name ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.nameEn ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.name ??
            null,
          dealerNameAr:
            lot.salesOrder?.customer?.nameAr ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.nameAr ??
            null,
          dealerNameHe:
            lot.salesOrder?.customer?.nameHe ??
            lot.productionOrder?.returnRequest?.salesOrder?.customer?.nameHe ??
            null,
          deliveryId: delivery?.id ?? null,
          deliveryStatus: delivery?.status ?? null,
          deliveryNumber: delivery?.number ?? null,
          deliveryDate: delivery?.deliveryDate ?? null,
          qcStatus: qc?.result ?? 'PASS',
          qcInspectedAt: qc?.inspectedAt?.toISOString() ?? null,
          packagingComplete: true,
          finishedAt: lot.producedAt,
          packagesPerUnit: row.packagesPerUnit,
          packageCount: row.packageCount,
          pieceLabels: row.pieceLabels,
          packageSummary,
          loadChecked: row.load?.loaded ?? 0,
          loadTotal: row.load?.total ?? 0,
          enteredAt: row.enteredAt.toISOString(),
          leftAt: row.leftAt?.toISOString() ?? null,
          location: lot.location ?? null,
          returnRequest: (() => {
            const fromPo = lot.productionOrder?.returnRequest;
            if (fromPo) {
              return {
                id: fromPo.id,
                number: fromPo.number,
                lifecycleState: fromPo.lifecycleState ?? null,
              };
            }
            const qid = returnIdFromQuarantineSourceKey(lot.sourceKey);
            const fromQ = qid ? quarantineReturnById.get(qid) : null;
            return fromQ
              ? {
                  id: fromQ.id,
                  number: fromQ.number,
                  lifecycleState: fromQ.lifecycleState,
                }
              : null;
          })(),
        };
      }),
      meta: paginatedMeta(page, pageSize, totalItems),
    };
  }

  async getLot(id: string) {
    const lot = await this.prisma.inventoryLot.findUnique({
      where: { id },
      include: {
        inventoryItem: { include: { product: true } },
        warehouse: true,
        productionOrder: { select: { id: true, number: true, productDescription: true } },
        stageInstance: { include: { stageDefinition: true } },
        wipPiece: { select: { kit: { select: { id: true, qrCode: true } } } },
      },
    });
    if (!lot) return null;
    const [mapped] = await this.withLotTraceability([lot]);
    return {
      ...mapped,
      wipKit: lot.wipPiece?.kit
        ? { id: lot.wipPiece.kit.id, qrCode: lot.wipPiece.kit.qrCode }
        : null,
    };
  }

  async listFabricHolding(q?: string, permissions: string[] = []) {
    const needle = q?.trim();
    const lots = await this.prisma.inventoryLot.findMany({
      where: {
        OR: [
          { fabricProcurementId: { not: null } },
          {
            fabricProcurementId: null,
            allocationMode: 'GENERAL_STOCK',
            inventoryItem: { category: 'FABRIC' },
          },
        ],
        ...(needle
          ? {
              OR: [
                { qrCode: { contains: needle, mode: 'insensitive' } },
                { salesOrder: { number: { contains: needle, mode: 'insensitive' } } },
                {
                  fabricProcurement: {
                    requirement: { requestedFabricLabel: { contains: needle, mode: 'insensitive' } },
                  },
                },
                { salesOrder: { customer: { nameEn: { contains: needle, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: {
        location: { select: { id: true, code: true, name: true } },
        warehouse: { select: { id: true, code: true, nameEn: true, nameAr: true } },
        inventoryItem: { select: { id: true, sku: true, nameEn: true, nameAr: true, imageUrl: true, unit: true } },
        salesOrder: {
          select: {
            id: true,
            number: true,
            customer: { select: { nameEn: true, nameAr: true } },
          },
        },
        fabricProcurement: {
          include: {
            requirement: true,
            salesOrderLine: {
              select: {
                description: true,
                product: { select: { nameEn: true, imageUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const showCost = permissions.includes('inventory.cost.read');
    const showSupplier = permissions.includes('supplier.read');
    const grouped = new Map<string, typeof lots>();
    for (const lot of lots) {
      const key = lot.fabricProcurementId ?? lot.id;
      const list = grouped.get(key) ?? [];
      list.push(lot);
      grouped.set(key, list);
    }
    const holding = [...grouped.values()].map((group) => {
      const first = group[0]!;
      const req = first.fabricProcurement?.requirement;
      const readiness = assessFabricReadiness({
        requirement: {
          id: req?.id ?? first.id,
          salesOrderId: first.salesOrderId ?? first.fabricProcurement?.salesOrderId ?? '',
          label: req?.requestedFabricLabel || req?.displayName || first.inventoryItem.nameEn,
          sku: req?.sku ?? first.inventoryItem.sku,
          inventoryItemId: req?.inventoryItemId ?? first.inventoryItemId,
          expectedQty: req?.expectedQty != null ? Number(req.expectedQty) : null,
          qtyIsEstimate: req?.qtyIsEstimate,
          unit: req?.unit || first.inventoryItem.unit,
          fabricRole: req?.fabricRole,
          stageCode: req?.stageCode,
        },
        procurement: first.fabricProcurement
          ? {
              state: first.fabricProcurement.state,
              fabricHoldOverriddenAt: first.fabricProcurement.fabricHoldOverriddenAt,
              expectedAvailableAt: first.fabricProcurement.expectedAvailableAt,
            }
          : null,
        lots: group.map((l) => ({
          id: l.id,
          quantity: Number(l.quantity),
          remainingQty: l.remainingQty != null ? Number(l.remainingQty) : null,
          status: l.status,
          allocationMode: l.allocationMode,
          salesOrderId: l.salesOrderId,
          locationId: l.locationId,
          inventoryItemId: l.inventoryItemId,
        })),
      });
      return {
        id: first.fabricProcurementId ?? first.id,
        label: readiness.label,
        role: readiness.role,
        sku: first.inventoryItem.sku,
        imageUrl: first.inventoryItem.imageUrl,
        salesOrderId: first.salesOrder?.id ?? first.salesOrderId ?? null,
        orderNumber: first.salesOrder?.number ?? null,
        dealerName: first.salesOrder?.customer.nameEn ?? first.salesOrder?.customer.nameAr ?? null,
        productName:
          first.fabricProcurement?.salesOrderLine?.description ??
          first.fabricProcurement?.salesOrderLine?.product?.nameEn ??
          null,
        productImageUrl: first.fabricProcurement?.salesOrderLine?.product?.imageUrl ?? null,
        stageCode: readiness.stageCode,
        derivedStatus: readiness.derivedStatus,
        expectedQty: readiness.expectedQty,
        arrivedQty: readiness.arrivedQty,
        unit: readiness.unit,
        supplier: showSupplier ? first.supplierId : null,
        lots: group.map((l) => ({
          id: l.id,
          qrCode: l.qrCode,
          remainingQty: l.remainingQty != null ? Number(l.remainingQty) : Number(l.quantity),
          status: l.status,
          locationLabel: l.location?.name?.trim() || l.location?.code || null,
          warehouseLabel: l.warehouse.nameEn || l.warehouse.code,
          unitCost: showCost && l.unitCost != null ? Number(l.unitCost) : null,
        })),
      };
    });
    return { holding };
  }

  async findLotByCode(raw: string) {
    const code = String(raw ?? '').trim();
    if (!code) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lot not found.' });
    }
    const lot = await this.prisma.inventoryLot.findFirst({
      where: { qrCode: code },
      include: {
        inventoryItem: { include: { product: true } },
        warehouse: true,
        location: true,
        productionOrder: { select: { id: true, number: true, productDescription: true } },
        stageInstance: { include: { stageDefinition: true } },
        wipPiece: { select: { kit: { select: { id: true, qrCode: true } } } },
        fabricProcurement: {
          select: {
            id: true,
            salesOrderId: true,
            state: true,
            fabricHoldOverriddenAt: true,
            expectedAvailableAt: true,
            requirement: {
              select: {
                id: true,
                requestedFabricLabel: true,
                fabricRole: true,
                stageCode: true,
                expectedQty: true,
                unit: true,
                sku: true,
                inventoryItemId: true,
                qtyIsEstimate: true,
                displayName: true,
              },
            },
            salesOrderLine: {
              select: {
                description: true,
                product: { select: { nameEn: true, nameAr: true, imageUrl: true } },
              },
            },
          },
        },
        salesOrder: {
          select: {
            id: true,
            number: true,
            customer: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    });
    if (!lot) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lot not found.' });
    }
    const [mapped] = await this.withLotTraceability([lot]);
    const req = lot.fabricProcurement?.requirement;
    const fabricReadiness = lot.fabricProcurement
      ? assessFabricReadiness({
          requirement: {
            id: req?.id ?? lot.id,
            salesOrderId: lot.fabricProcurement.salesOrderId ?? lot.salesOrderId ?? '',
            label: req?.requestedFabricLabel || req?.displayName || lot.inventoryItem.nameEn,
            sku: req?.sku ?? lot.inventoryItem.sku,
            inventoryItemId: req?.inventoryItemId ?? lot.inventoryItemId,
            expectedQty: req?.expectedQty != null ? Number(req.expectedQty) : null,
            qtyIsEstimate: req?.qtyIsEstimate,
            unit: req?.unit || lot.inventoryItem.unit,
            fabricRole: req?.fabricRole,
            stageCode: req?.stageCode,
          },
          procurement: {
            state: lot.fabricProcurement.state,
            fabricHoldOverriddenAt: lot.fabricProcurement.fabricHoldOverriddenAt,
            expectedAvailableAt: lot.fabricProcurement.expectedAvailableAt,
          },
          lots: [
            {
              id: lot.id,
              quantity: Number(lot.quantity),
              remainingQty: lot.remainingQty != null ? Number(lot.remainingQty) : null,
              status: lot.status,
              allocationMode: lot.allocationMode,
              salesOrderId: lot.salesOrderId,
              locationId: lot.locationId,
              inventoryItemId: lot.inventoryItemId,
            },
          ],
        })
      : null;
    return {
      ...mapped,
      wipKit: lot.wipPiece?.kit
        ? { id: lot.wipPiece.kit.id, qrCode: lot.wipPiece.kit.qrCode }
        : null,
      fabricProcurement: lot.fabricProcurement
        ? {
            id: lot.fabricProcurement.id,
            salesOrderId: lot.fabricProcurement.salesOrderId,
            label: lot.fabricProcurement.requirement.requestedFabricLabel,
            role: lot.fabricProcurement.requirement.fabricRole,
            stageCode: lot.fabricProcurement.requirement.stageCode,
            state: lot.fabricProcurement.state,
            derivedStatus: fabricReadiness?.derivedStatus ?? null,
            expectedQty: fabricReadiness?.expectedQty ?? null,
            arrivedQty: fabricReadiness?.arrivedQty ?? null,
            unit: fabricReadiness?.unit ?? lot.inventoryItem.unit,
            overridden: fabricReadiness?.overridden ?? false,
          }
        : null,
      scanKind:
        lot.fabricProcurementId || String(lot.qrCode ?? '').startsWith('FB-')
          ? 'ORDER_FABRIC'
          : null,
      location: lot.location ?? null,
      salesOrder: lot.salesOrder
        ? { id: lot.salesOrder.id, number: lot.salesOrder.number }
        : null,
      dealerNameEn: lot.salesOrder?.customer?.nameEn ?? null,
      dealerNameAr: lot.salesOrder?.customer?.nameAr ?? null,
      productNameEn:
        lot.fabricProcurement?.salesOrderLine?.description ||
        lot.fabricProcurement?.salesOrderLine?.product?.nameEn ||
        mapped?.productNameEn ||
        null,
      productImageUrl:
        lot.fabricProcurement?.salesOrderLine?.product?.imageUrl ??
        lot.inventoryItem.product?.imageUrl ??
        null,
    };
  }

  private async withLotTraceability<
    T extends {
      id: string;
      inventoryItemId: string;
      producedAt: Date;
      productionOrderId: string | null;
      inventoryItem: {
        sku: string;
        nameEn: string;
        nameAr: string;
        nameHe: string | null;
        product: { nameEn: string; nameAr: string; nameHe: string | null } | null;
      };
      warehouse: { nameEn: string; nameAr: string; code: string };
      productionOrder: { number: string; productDescription: string } | null;
      stageInstance: {
        stageDefinition: { nameEn: string; nameAr: string; nameHe: string | null } | null;
      } | null;
    },
  >(lots: T[]) {
    if (!lots.length) return [];
    const itemIds = [...new Set(lots.map((l) => l.inventoryItemId))];
    const oldest = lots.reduce(
      (min, l) => (l.producedAt < min ? l.producedAt : min),
      lots[0]!.producedAt,
    );
    const txs = await this.prisma.inventoryTransaction.findMany({
      where: {
        inventoryItemId: { in: itemIds },
        createdAt: { gte: oldest },
        type: {
          in: [
            'SEMI_FINISHED_ISSUE',
            'FINISHED_GOODS_RECEIPT',
            'DELIVERY_ISSUE',
            'DELIVERY_RESTORE',
            'CUSTOMER_RETURN',
            'SCRAP',
            'DAMAGE',
            'PRODUCTION_RETURN',
          ],
        },
      },
      include: { warehouse: true },
      orderBy: { createdAt: 'asc' },
    });
    return lots.map((lot) => {
      const laterMovements = txs
        .filter(
          (tx) =>
            tx.inventoryItemId === lot.inventoryItemId &&
            tx.createdAt >= lot.producedAt &&
            (!lot.productionOrderId || !tx.referenceId || tx.referenceId === lot.productionOrderId),
        )
        .map((tx) => ({
          type: tx.type,
          quantity: Number(tx.quantity),
          createdAt: tx.createdAt,
          warehouseNameEn: tx.warehouse.nameEn,
          warehouseNameAr: tx.warehouse.nameAr,
        }));
      return {
        ...lot,
        productNameEn: lot.inventoryItem.product?.nameEn ?? lot.productionOrder?.productDescription ?? null,
        productNameAr: lot.inventoryItem.product?.nameAr ?? lot.productionOrder?.productDescription ?? null,
        productionOrderNumber: lot.productionOrder?.number ?? null,
        producingStageNameEn: lot.stageInstance?.stageDefinition?.nameEn ?? null,
        producingStageNameAr: lot.stageInstance?.stageDefinition?.nameAr ?? null,
        laterMovements,
      };
    });
  }

  async listFinishedGoods(query: PaginationDto & { q?: string; warehouseId?: string }) {
    return this.listItems(
      {
        ...query,
        itemClass: 'FINISHED_GOOD',
        warehouseId: query.warehouseId,
        q: query.q,
      },
      ['inventory.cost.read'],
    );
  }

  async resolveDefaultWarehouse(type: WarehouseTypeValue) {
    const flagged = await this.prisma.warehouse.findFirst({
      where: { type, isDefault: true, isActive: true },
    });
    if (flagged) return flagged;
    return this.prisma.warehouse.findFirst({ where: { type, isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  private async pickRawWarehouseStock(
    tx: Prisma.TransactionClient,
    inventoryItemId: string,
  ): Promise<{ warehouseId: string; available: number; reserved: number; free: number } | null> {
    const rows = await tx.inventoryBalance.findMany({
      where: {
        inventoryItemId,
        warehouse: { type: 'RAW_MATERIALS', isActive: true },
      },
    });
    const byWh = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byWh.get(row.warehouseId) ?? [];
      list.push(row);
      byWh.set(row.warehouseId, list);
    }
    let best: { warehouseId: string; available: number; reserved: number; free: number } | null =
      null;
    for (const [warehouseId, list] of byWh) {
      const stock = warehouseStockFromBalances(list);
      if (!best || stock.free > best.free) best = { warehouseId, ...stock };
    }
    return best;
  }

  async reserveQty(
    inventoryItemId: string,
    warehouseId: string,
    quantity: number,
    userId: string,
    db?: Prisma.TransactionClient,
  ) {
    void userId;
    const client = db ?? this.prisma;
    const rows = await client.inventoryBalance.findMany({
      where: { inventoryItemId, warehouseId },
      orderBy: { availableQty: 'desc' },
    });
    const free = rows.reduce(
      (s, r) => s + Number(r.availableQty) - Number(r.reservedQty),
      0,
    );
    if (free + 1e-9 < quantity) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Not enough free stock to reserve.',
      });
    }
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 1e-9) break;
      if (!row.locationId) continue;
      const rowFree = Number(row.availableQty) - Number(row.reservedQty);
      if (rowFree <= 0) continue;
      const take = Math.min(rowFree, remaining);
      await client.inventoryBalance.update({
        where: { id: row.id },
        data: { reservedQty: roundMoney(Number(row.reservedQty) + take) },
      });
      remaining -= take;
    }
    if (remaining > 1e-9) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Not enough free stock to reserve.',
      });
    }
  }

  async releaseReservation(
    inventoryItemId: string,
    warehouseId: string,
    quantity: number,
    db?: Prisma.TransactionClient,
  ) {
    const client = db ?? this.prisma;
    const rows = await client.inventoryBalance.findMany({
      where: { inventoryItemId, warehouseId },
      orderBy: { reservedQty: 'desc' },
    });
    let remaining = quantity;
    for (const row of rows) {
      if (remaining <= 1e-9) break;
      const reserved = Number(row.reservedQty);
      if (reserved <= 0) continue;
      const take = Math.min(reserved, remaining);
      await client.inventoryBalance.update({
        where: { id: row.id },
        data: { reservedQty: roundMoney(reserved - take) },
      });
      remaining -= take;
    }
  }

  /**
   * FG lots are the physical truth for bay load. Balances can lag (e.g. demo
   * data or partial reservations). Top them up so issue can clear the lot.
   */
  private async ensureLotBalanceForIssue(
    db: Prisma.TransactionClient,
    lot: {
      inventoryItemId: string;
      warehouseId: string;
      locationId: string | null;
      quantity: unknown;
      status: string;
    },
  ) {
    const qty = Number(lot.quantity);
    if (!(qty > 0)) return;
    const locationId = lot.locationId ?? null;
    const balance = await db.inventoryBalance.findFirst({
      where: {
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        locationId,
      },
    });
    const needReserved = lot.status === 'RESERVED' ? qty : 0;
    if (!balance) {
      await db.inventoryBalance.create({
        data: {
          inventoryItemId: lot.inventoryItemId,
          warehouseId: lot.warehouseId,
          locationId,
          availableQty: roundMoney(qty),
          reservedQty: roundMoney(needReserved),
        },
      });
      return;
    }
    const avail = Number(balance.availableQty);
    const reserved = Number(balance.reservedQty);
    const nextAvail = Math.max(avail, qty);
    const nextReserved = Math.max(reserved, needReserved);
    if (nextAvail === avail && nextReserved === reserved) return;
    await db.inventoryBalance.update({
      where: { id: balance.id },
      data: {
        availableQty: roundMoney(nextAvail),
        reservedQty: roundMoney(nextReserved),
      },
    });
  }

  async issueForDelivery(
    deliveryId: string,
    salesOrderId: string | null,
    userId: string,
    db: Prisma.TransactionClient,
    lotIds?: string[],
  ) {
    const lots = await db.inventoryLot.findMany({
      where: lotIds?.length
        ? { id: { in: lotIds }, status: { in: ['AVAILABLE', 'RESERVED'] } }
        : salesOrderId
          ? {
              salesOrderId,
              status: { in: ['AVAILABLE', 'RESERVED'] },
              inventoryItem: { itemClass: 'FINISHED_GOOD' },
            }
          : { id: { in: [] } },
    });
    for (const lot of lots) {
      await this.ensureLotBalanceForIssue(db, lot);
      await this.applyMovement({
        type: InventoryTxType.DELIVERY_ISSUE,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        quantity: Number(lot.quantity),
        userId,
        idempotencyKey: `delivery-issue:${deliveryId}:${lot.id}`,
        referenceType: 'Delivery',
        referenceId: deliveryId,
        reservedDelta: lot.status === 'RESERVED' ? -Number(lot.quantity) : 0,
        locationId: lot.locationId,
        db,
      });
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: { status: 'DELIVERED' },
      });
    }
  }

  /**
   * Shipment-fail restore only (OUT_FOR_DELIVERY → FAILED/CANCELLED).
   * NOT customer RMA — returns use quarantineReturn after physical receive.
   * Prefer lots issued for this deliveryId (DELIVERY_ISSUE referenceId=deliveryId),
   * including load-sheet pieces; fall back to SO DELIVERED lots only when those lot
   * ids have a DELIVERY_ISSUE for this delivery.
   */
  async restoreForDelivery(deliveryId: string, salesOrderId: string | null, userId: string, db: Prisma.TransactionClient) {
    if (!salesOrderId) return;

    const issueTxs = await db.inventoryTransaction.findMany({
      where: {
        type: InventoryTxType.DELIVERY_ISSUE,
        referenceType: 'Delivery',
        referenceId: deliveryId,
      },
      select: { idempotencyKey: true },
    });
    const issuedLotIds = new Set<string>();
    for (const tx of issueTxs) {
      // idempotencyKey = delivery-issue:${deliveryId}:${lotId}
      const prefix = `delivery-issue:${deliveryId}:`;
      if (tx.idempotencyKey?.startsWith(prefix)) {
        issuedLotIds.add(tx.idempotencyKey.slice(prefix.length));
      }
    }

    const loadPieces = await db.deliveryLoadPiece.findMany({
      where: { deliveryId },
      select: { inventoryLotId: true },
    });
    for (const p of loadPieces) {
      issuedLotIds.add(p.inventoryLotId);
    }

    let lots =
      issuedLotIds.size > 0
        ? await db.inventoryLot.findMany({
            where: {
              id: { in: [...issuedLotIds] },
              status: 'DELIVERED',
              inventoryItem: { itemClass: 'FINISHED_GOOD' },
            },
          })
        : [];

    // Fallback: SO DELIVERED lots that actually have DELIVERY_ISSUE for this delivery only.
    if (!lots.length) {
      const soLots = await db.inventoryLot.findMany({
        where: {
          salesOrderId,
          status: 'DELIVERED',
          inventoryItem: { itemClass: 'FINISHED_GOOD' },
        },
      });
      const verified: typeof soLots = [];
      for (const lot of soLots) {
        const issue = await db.inventoryTransaction.findFirst({
          where: {
            type: InventoryTxType.DELIVERY_ISSUE,
            referenceType: 'Delivery',
            referenceId: deliveryId,
            idempotencyKey: `delivery-issue:${deliveryId}:${lot.id}`,
          },
          select: { id: true },
        });
        if (issue) verified.push(lot);
      }
      lots = verified;
    }

    for (const lot of lots) {
      await this.applyMovement({
        type: InventoryTxType.DELIVERY_RESTORE,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        quantity: Number(lot.quantity),
        userId,
        idempotencyKey: `delivery-restore:${deliveryId}:${lot.id}`,
        referenceType: 'Delivery',
        referenceId: deliveryId,
        reservedDelta: lot.allocationMode === 'ORDER_ALLOCATED' ? Number(lot.quantity) : 0,
        locationId: lot.locationId,
        db,
      });
      await db.inventoryLot.update({
        where: { id: lot.id },
        data: {
          status: lot.allocationMode === 'ORDER_ALLOCATED' ? 'RESERVED' : 'AVAILABLE',
        },
      });
    }
  }

  async quarantineReturn(
    returnId: string,
    salesOrderId: string | null,
    quantity: number,
    userId: string,
    identity?: {
      salesOrderLineId?: string | null;
      productId?: string | null;
      sourceKey?: string;
      warehouseId?: string;
      locationId?: string | null;
      pieceId?: string;
    },
  ) {
    const sourceKey =
      identity?.sourceKey ||
      returnQuarantineSourceKey({ returnId, pieceId: identity?.pieceId }) ||
      `${RETURN_QUARANTINE_PREFIX}${returnId}`;
    const existingLot = await this.prisma.inventoryLot.findUnique({ where: { sourceKey } });
    if (existingLot) return existingLot;

    const fg = identity?.warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: identity.warehouseId } })
      : await this.resolveDefaultWarehouse('FINISHED_GOODS');
    if (!fg) {
      throw new BadRequestException({
        code: 'RETURN_NO_STOCK_BASIS',
        message: 'No finished-goods warehouse configured for return quarantine.',
      });
    }
    const quarantine = identity?.locationId
      ? await this.prisma.warehouseLocation.findFirst({
          where: { id: identity.locationId, warehouseId: fg.id },
        })
      : await this.prisma.warehouseLocation.findFirst({
          where: { warehouseId: fg.id, code: 'QUARANTINE' },
        });
    const basisOr: Prisma.InventoryLotWhereInput[] = [
      ...(identity?.salesOrderLineId ? [{ salesOrderLineId: identity.salesOrderLineId }] : []),
      ...(salesOrderId ? [{ salesOrderId }, { productionOrder: { salesOrderId } }] : []),
    ];
    const lot = basisOr.length
      ? await this.prisma.inventoryLot.findFirst({
          where: {
            inventoryItem: { itemClass: 'FINISHED_GOOD' },
            OR: basisOr,
          },
          orderBy: { producedAt: 'desc' },
        })
      : null;
    if (!lot) {
      throw new BadRequestException({
        code: 'RETURN_NO_STOCK_BASIS',
        message: 'No finished-goods lot found to basis this customer return.',
      });
    }
    await this.applyMovement({
      type: InventoryTxType.CUSTOMER_RETURN,
      inventoryItemId: lot.inventoryItemId,
      warehouseId: fg.id,
      quantity,
      userId,
      idempotencyKey: sourceKey,
      referenceType: identity?.pieceId ? 'ReturnPiece' : 'ReturnRequest',
      referenceId: identity?.pieceId ?? returnId,
      locationId: quarantine?.id ?? null,
      // Physical stock is back, but quarantined units are not sellable until fate is set.
      reservedDelta: quantity,
    });
    return this.prisma.inventoryLot.create({
      data: {
        inventoryItemId: lot.inventoryItemId,
        warehouseId: fg.id,
        locationId: quarantine?.id ?? null,
        salesOrderId,
        salesOrderLineId: identity?.salesOrderLineId ?? undefined,
        quantity,
        status: 'QUARANTINED',
        allocationMode: 'ORDER_ALLOCATED',
        sourceKey,
      },
    });
  }

  async findReturnQuarantineLot(returnId: string, pieceId?: string) {
    const include = { inventoryItem: { select: { standardCost: true } } } as const;
    if (pieceId) {
      return this.prisma.inventoryLot.findUnique({
        where: { sourceKey: `${RETURN_PIECE_QUARANTINE_PREFIX}${pieceId}` },
        include,
      });
    }
    const legacy = await this.prisma.inventoryLot.findUnique({
      where: { sourceKey: `${RETURN_QUARANTINE_PREFIX}${returnId}` },
      include,
    });
    if (legacy) return legacy;
    const pieces = await this.prisma.returnPiece.findMany({
      where: { returnRequestId: returnId },
      select: { id: true },
    });
    if (!pieces.length) return null;
    return this.prisma.inventoryLot.findFirst({
      where: {
        sourceKey: { in: pieces.map((piece) => `${RETURN_PIECE_QUARANTINE_PREFIX}${piece.id}`) },
        status: 'QUARANTINED',
      },
      include,
    });
  }

  async writeOffReturnPieceQuarantine(args: {
    pieceId: string;
    userId: string;
    reason: string;
    db?: Prisma.TransactionClient;
  }) {
    const db = args.db ?? this.prisma;
    const lot = await db.inventoryLot.findUnique({
      where: { sourceKey: `${RETURN_PIECE_QUARANTINE_PREFIX}${args.pieceId}` },
      include: { inventoryItem: { select: { standardCost: true } } },
    });
    if (!lot) return null;
    if (lot.status === 'SCRAPPED' || lot.status === 'CONSUMED') return lot;
    const qty = Number(lot.quantity);
    if (qty > 0) {
      await this.applyMovement({
        type: InventoryTxType.SCRAP,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        quantity: qty,
        unitCost: Number(lot.unitCost ?? lot.inventoryItem.standardCost ?? 0) || undefined,
        userId: args.userId,
        locationId: lot.locationId,
        idempotencyKey: `return-piece-writeoff:${args.pieceId}`,
        referenceType: 'ReturnPiece',
        referenceId: args.pieceId,
        reservedDelta: lot.status === 'QUARANTINED' ? -qty : 0,
        notes: args.reason,
        db,
      });
    }
    return db.inventoryLot.update({
      where: { id: lot.id },
      data: { status: 'SCRAPPED', quantity: 0 },
    });
  }

  async resolveReturnFate(
    returnId: string,
    fate: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP',
    userId: string,
    opts?: {
      warehouseId?: string;
      locationId?: string | null;
      quantity?: number;
      unitCost?: number;
      pieceId?: string;
    },
  ) {
    const lot = await this.findReturnQuarantineLot(returnId, opts?.pieceId);
    if (!lot || lot.status !== 'QUARANTINED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_SELLABLE',
        message: 'Returned stock is not available until inspection is complete.',
      });
    }

    const requested = Number(opts?.quantity ?? lot.quantity);
    const qty = Math.min(requested, Number(lot.quantity));
    if (!(qty > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Fate quantity must be greater than zero.',
      });
    }
    const remaining = Number(lot.quantity) - qty;
    if (fate === 'REWORK') {
      const work = await this.prisma.productionOrder.findFirst({
        where: { returnRequestId: returnId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.returnRequest.update({
          where: { id: returnId },
          data: { inventoryFate: 'REWORK' },
        });
        if (work) {
          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: { productionOrderId: work.id },
          });
        }
      });
      return lot;
    }

    if (fate === 'RETURN_TO_STOCK') {
      const targetWarehouseId = opts?.warehouseId ?? lot.warehouseId;
      const targetLocationId =
        opts?.locationId !== undefined ? opts.locationId : lot.locationId;
      const stockKey = `return-fate-stock:${returnId}`;
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: stockKey },
        });
        if (!existing) {
          const number = await this.sequences.next('INVTX', 'INV');
          await tx.inventoryTransaction.create({
            data: {
              number,
              type: InventoryTxType.INVENTORY_ADJUSTMENT,
              inventoryItemId: lot.inventoryItemId,
              warehouseId: targetWarehouseId,
              locationId: targetLocationId,
              quantity: roundMoney(qty),
              notes: 'Released from quarantine to finished goods',
              idempotencyKey: stockKey,
              createdById: userId,
              referenceType: 'ReturnRequest',
              referenceId: returnId,
            },
          });
        }
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            inventoryItemId: lot.inventoryItemId,
            warehouseId: lot.warehouseId,
            locationId: lot.locationId,
          },
        });
        if (balance) {
          const nextReserved = Math.max(0, Number(balance.reservedQty) - qty);
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { reservedQty: roundMoney(nextReserved) },
          });
        }
        if (remaining <= 0) {
          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: {
              status: 'AVAILABLE',
              warehouseId: targetWarehouseId,
              locationId: targetLocationId,
              allocationMode: 'GENERAL_STOCK',
            },
          });
        } else {
          await tx.inventoryLot.update({
            where: { id: lot.id },
            data: { quantity: roundMoney(remaining) },
          });
          await tx.inventoryLot.create({
            data: {
              inventoryItemId: lot.inventoryItemId,
              warehouseId: targetWarehouseId,
              locationId: targetLocationId,
              quantity: roundMoney(qty),
              unitCost: lot.unitCost,
              status: 'AVAILABLE',
              allocationMode: 'GENERAL_STOCK',
              sourceKey: `return-restock:${returnId}`,
            },
          });
        }
        await tx.returnRequest.update({
          where: { id: returnId },
          data: { inventoryFate: 'RETURN_TO_STOCK' },
        });
      });
      if (remaining > 0) {
        const restocked = await this.prisma.inventoryLot.findUnique({
          where: {
            sourceKey: `return-restock:${returnId}`,
          },
        });
        return restocked ?? lot;
      }
      return lot;
    }

    const txType = fate === 'DAMAGED' ? InventoryTxType.DAMAGE : InventoryTxType.SCRAP;
    const unitCost = Number(
      opts?.unitCost ?? lot.unitCost ?? lot.inventoryItem.standardCost ?? 0,
    );
    const scrapKey = `return-fate:${returnId}`;
    await this.prisma.$transaction(async (tx) => {
      await this.applyMovement({
        type: txType,
        inventoryItemId: lot.inventoryItemId,
        warehouseId: lot.warehouseId,
        quantity: qty,
        unitCost: unitCost > 0 ? unitCost : undefined,
        userId,
        locationId: lot.locationId,
        idempotencyKey: scrapKey,
        referenceType: 'ReturnRequest',
        referenceId: returnId,
        reservedDelta: -qty,
        notes: fate === 'SCRAP' ? 'Return scrap write-off' : 'Return damaged write-off',
        db: tx,
      });
      await tx.inventoryLot.update({
        where: { id: lot.id },
        data:
          remaining <= 0
            ? { status: fate === 'DAMAGED' ? 'DAMAGED' : 'SCRAPPED' }
            : { quantity: roundMoney(remaining) },
      });
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { inventoryFate: fate },
      });
    });
    return lot;
  }

  async tryReserveForSalesOrder(
    salesOrderId: string,
    _userId: string,
    db?: Prisma.TransactionClient,
  ): Promise<{ ready: boolean; risk: boolean }> {
    const run = async (tx: Prisma.TransactionClient) => {
      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id: salesOrderId },
        include: {
          lines: { include: { product: { select: { bomDefaults: true } } } },
          productionSetup: {
            include: {
              lines: {
                include: {
                  materialRequirements: true,
                  salesOrderLine: { select: { id: true, quantity: true, productionRequired: true } },
                },
              },
            },
          },
        },
      });
      const needs: Array<{ inventoryItemId: string; warehouseId: string; quantity: number }> = [];
      let ready = true;

      const setupLines = order.productionSetup?.lines ?? [];
      if (setupLines.length > 0) {
        for (const lineSetup of setupLines) {
          if (!lineSetup.salesOrderLine.productionRequired) continue;
          const lineQty = Number(lineSetup.salesOrderLine.quantity) || 1;
          for (const req of lineSetup.materialRequirements) {
            if (String(req.category ?? '').toUpperCase() === 'FABRIC') {
              continue;
            }
            if (!req.inventoryItemId) {
              ready = false;
              continue;
            }
            const neededQty = req.expectedQty == null ? null : Number(req.expectedQty);
            if (neededQty == null) {
              continue;
            }
            const stock = await this.pickRawWarehouseStock(tx, req.inventoryItemId);
            const needed = neededQty * lineQty;
            const free = stock?.free ?? 0;
            if (!stock || free < needed) {
              ready = false;
              continue;
            }
            needs.push({
              inventoryItemId: req.inventoryItemId,
              warehouseId: stock.warehouseId,
              quantity: needed,
            });
          }
        }
      } else {
        for (const line of order.lines) {
          if (!line.productionRequired) continue;
          const bom = (line.product?.bomDefaults ?? null) as BomDefaults | null;
          const lines = bomReservationNeeds(bom, Number(line.quantity));
          for (const need of lines) {
            const item = need.sku
              ? await tx.inventoryItem.findFirst({
                  where: { sku: need.sku, archivedAt: null, isActive: true },
                })
              : need.category
                ? await tx.inventoryItem.findFirst({
                    where: {
                      category: need.category as never,
                      archivedAt: null,
                      isActive: true,
                      itemClass: 'RAW_MATERIAL',
                    },
                    include: { balances: true },
                  })
                : null;
            if (!item) {
              ready = false;
              continue;
            }
            const stock = await this.pickRawWarehouseStock(tx, item.id);
            const free = stock?.free ?? 0;
            if (!stock || free < need.qty) {
              ready = false;
              continue;
            }
            needs.push({
              inventoryItemId: item.id,
              warehouseId: stock.warehouseId,
              quantity: need.qty,
            });
          }
        }
      }

      if (!ready) return { ready: false, risk: true };
      for (const need of needs) {
        await this.reserveQty(need.inventoryItemId, need.warehouseId, need.quantity, _userId, tx);
      }
      return { ready: true, risk: false };
    };

    if (db) return run(db);
    return this.prisma.$transaction((tx) => run(tx));
  }

  async releaseForSalesOrder(salesOrderId: string, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      const order = await tx.salesOrder.findUniqueOrThrow({
        where: { id: salesOrderId },
        include: {
          lines: { include: { product: { select: { bomDefaults: true } } } },
        },
      });
      for (const line of order.lines) {
        if (!line.productionRequired) continue;
        const bom = (line.product?.bomDefaults ?? null) as BomDefaults | null;
        const lines = bomReservationNeeds(bom, Number(line.quantity));
        for (const need of lines) {
          const item = need.sku
            ? await tx.inventoryItem.findFirst({
                where: { sku: need.sku, archivedAt: null },
              })
            : need.category
              ? await tx.inventoryItem.findFirst({
                  where: { category: need.category as never, archivedAt: null, itemClass: 'RAW_MATERIAL' },
                })
              : null;
          if (!item) continue;
          const stock = await this.pickRawWarehouseStock(tx, item.id);
          if (!stock) continue;
          await this.releaseReservation(item.id, stock.warehouseId, need.qty, tx);
        }
      }
    };
    if (db) return run(db);
    return this.prisma.$transaction((tx) => run(tx));
  }

  async retryWaitingMaterialOrders(userId: string) {
    const waiting = await this.prisma.salesOrder.findMany({
      where: { status: 'WAITING_FOR_MATERIALS', archivedAt: null },
      select: {
        id: true,
        customerId: true,
        priority: true,
        createdAt: true,
        requiredDeliveryDate: true,
        productionOrders: {
          select: {
            id: true,
            customerId: true,
            priority: true,
            committedDeliveryDate: true,
            requiredDeliveryDate: true,
            createdAt: true,
          },
        },
      },
    });
    const ranked = [...waiting].sort((a, b) =>
      comparePriority(salesOrderUrgency(a), salesOrderUrgency(b)),
    );
    const waitingIds = ranked.map((so) => so.id);
    for (const so of ranked) {
      const result = await this.tryReserveForSalesOrder(so.id, userId);
      if (!result.ready) continue;
      await this.prisma.salesOrder.update({
        where: { id: so.id },
        data: { status: 'READY_FOR_PRODUCTION' },
      });
      await this.prisma.productionOrder.updateMany({
        where: { salesOrderId: so.id, status: 'WAITING_FOR_MATERIALS' },
        data: { status: 'PLANNED' },
      });
    }
    await this.enqueueMaterialArrivalReplans(waitingIds);
  }

  private async enqueueMaterialArrivalReplans(waitingSalesOrderIds: string[]) {
    if (!this.schedulingQueue) return;
    const fromWaiting = waitingSalesOrderIds.length
      ? await this.prisma.productionOrder.findMany({
          where: { salesOrderId: { in: waitingSalesOrderIds } },
          select: { id: true },
        })
      : [];
    const stillWaiting = await this.prisma.productionOrder.findMany({
      where: { status: 'WAITING_FOR_MATERIALS' },
      select: { id: true },
    });
    const constrained = await this.prisma.productionSchedule.findMany({
      where: {
        status: { in: ['DRAFT', 'PROPOSED', 'APPROVED', 'NEEDS_REVIEW'] },
        OR: [{ unschedulableReason: 'MATERIAL_NOT_READY' }, { materialReadyAt: { not: null } }],
      },
      select: { productionOrderId: true },
    });
    const ids = new Set<string>();
    for (const row of fromWaiting) ids.add(row.id);
    for (const row of stillWaiting) ids.add(row.id);
    for (const row of constrained) ids.add(row.productionOrderId);
    for (const productionOrderId of ids) {
      this.schedulingQueue
        .enqueue('REPLAN', { productionOrderId, event: 'material-arrival' })
        .catch(() => undefined);
    }
  }
}

function salesOrderUrgency(so: {
  id: string;
  customerId: string;
  priority: PrioritySortItem['priority'];
  createdAt: Date;
  requiredDeliveryDate: Date | null;
  productionOrders: Array<{
    committedDeliveryDate: Date | null;
    requiredDeliveryDate: Date | null;
    createdAt: Date;
    priority: PrioritySortItem['priority'];
    customerId: string | null;
    id: string;
  }>;
}): PrioritySortItem {
  const pos = so.productionOrders ?? [];
  const soonest =
    pos
      .map((p) => p.committedDeliveryDate ?? p.requiredDeliveryDate)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? so.requiredDeliveryDate;
  const first = pos[0];
  return {
    id: so.id,
    customerId: first?.customerId ?? so.customerId ?? so.id,
    priority: first?.priority ?? so.priority,
    isPinned: false,
    committedDeliveryDate: soonest,
    requestedDeliveryDate: so.requiredDeliveryDate,
    createdAt: so.createdAt,
  };
}
