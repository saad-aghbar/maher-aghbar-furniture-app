import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InventoryTxType, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import {
  INVENTORY_CATEGORY_GROUPS,
  categoriesForGroup,
  nextSkuFromExisting,
  skuPrefixForCategory,
  summarizeInventoryMeasurements,
  type InventoryCategoryGroup,
} from '../../common/helpers/inventory-category.util';
import { roundMoney } from '../../common/helpers/money.util';
import { PurchasingService } from '../purchasing/purchasing.service';
import { stripInventoryCostFields, stripInventoryCostList } from './inventory-cost.util';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    @Inject(forwardRef(() => PurchasingService))
    private readonly purchasing: PurchasingService,
  ) {}

  async listGroups(permissions?: string[]) {
    void permissions; // groups have no cost fields; signature kept for controller consistency
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null, isActive: true },
      select: {
        id: true,
        category: true,
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
    query: PaginationDto & { category?: string; categoryGroup?: string },
    permissions?: string[],
  ) {
    const groupCategories = categoriesForGroup(query.categoryGroup);
    const where: Prisma.InventoryItemWhereInput = {
      archivedAt: null,
      ...(query.category ? { category: query.category as never } : {}),
      ...(groupCategories?.length ? { category: { in: groupCategories } } : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { materialType: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.inventoryItem.count({ where }),
      this.prisma.inventoryItem.findMany({
        where,
        include: { balances: { include: { warehouse: true } } },
        orderBy: { sku: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: stripInventoryCostList(data, permissions),
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findByCode(code: string, permissions?: string[]) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        archivedAt: null,
        OR: [{ sku: code }, { barcode: code }, { qrCode: code }],
      },
      include: { balances: { include: { warehouse: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    return stripInventoryCostFields(item, permissions);
  }

  async getItem(id: string, permissions?: string[]) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, archivedAt: null },
      include: { balances: { include: { warehouse: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    return stripInventoryCostFields(item, permissions);
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
      unit?: string;
      category?: string;
      minStock?: number;
      maxStock?: number;
      standardCost?: number;
      barcode?: string;
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
    const sku = providedSku || (await this.nextInventorySku(dto.category));

    const data = {
      sku,
      nameAr: dto.nameAr.trim(),
      nameEn: dto.nameEn.trim(),
      unit: dto.unit?.trim() || 'pcs',
      category: (dto.category as never) || undefined,
      minStock: roundMoney(dto.minStock ?? 0),
      maxStock: dto.maxStock != null ? roundMoney(dto.maxStock) : undefined,
      standardCost: roundMoney(dto.standardCost ?? 0),
      barcode: dto.barcode?.trim() || undefined,
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
        data.sku = await this.nextInventorySku(dto.category);
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
    return item;
  }

  async updateItem(
    id: string,
    dto: Partial<{
      nameAr: string;
      nameEn: string;
      unit: string;
      category: string;
      minStock: number;
      maxStock: number;
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
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category as never } : {}),
        ...(dto.minStock !== undefined ? { minStock: roundMoney(dto.minStock) } : {}),
        ...(dto.maxStock !== undefined ? { maxStock: roundMoney(dto.maxStock) } : {}),
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
    return item;
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
          nameAr: material.nameAr,
          nameEn: material.nameEn,
          unit: material.unit,
          category: material.category,
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

  private async applyMovement(params: {
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
  }) {
    if (params.quantity <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantity must be positive.' });
    }

    if (params.idempotencyKey) {
      const existing = await this.prisma.inventoryTransaction.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return existing;
    }

    const isOutbound =
      params.outbound === true ||
      params.type === InventoryTxType.PRODUCTION_ISSUE ||
      params.type === InventoryTxType.DELIVERY_ISSUE ||
      params.type === InventoryTxType.DAMAGE ||
      params.type === InventoryTxType.SCRAP;
    const signedQty = isOutbound ? -params.quantity : params.quantity;

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.findFirst({
        where: {
          inventoryItemId: params.inventoryItemId,
          warehouseId: params.warehouseId,
          locationId: null,
        },
      });

      const current = Number(balance?.availableQty ?? 0);
      const next = current + signedQty;
      if (next < 0 && !params.allowNegative) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Inventory cannot go negative.',
        });
      }

      if (balance) {
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: { availableQty: roundMoney(next) },
        });
      } else {
        await tx.inventoryBalance.create({
          data: {
            inventoryItemId: params.inventoryItemId,
            warehouseId: params.warehouseId,
            availableQty: roundMoney(next),
          },
        });
      }

      const number = await this.sequences.next('INVTX', 'INV');
      return tx.inventoryTransaction.create({
        data: {
          number,
          type: params.type,
          inventoryItemId: params.inventoryItemId,
          warehouseId: params.warehouseId,
          quantity: roundMoney(signedQty),
          unitCost: params.unitCost != null ? roundMoney(params.unitCost) : undefined,
          notes: params.notes,
          idempotencyKey: params.idempotencyKey,
          createdById: params.userId,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
        },
      });
    });
  }

  async receive(
    dto: {
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      unitCost?: number;
      notes?: string;
      idempotencyKey?: string;
    },
    userId: string,
  ) {
    const result = await this.applyMovement({
      type: InventoryTxType.PURCHASE_RECEIPT,
      ...dto,
      userId,
    });
    await this.purchasing.maybeAutoReorderAfterStockChange(dto.inventoryItemId, userId);
    return result;
  }

  async issue(
    dto: {
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      notes?: string;
      idempotencyKey?: string;
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
      lines: { inventoryItemId: string; quantity: number }[];
    },
    userId: string,
  ) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Source and destination warehouses must differ.',
      });
    }
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

    for (const line of transfer.lines) {
      await this.applyMovement({
        type: InventoryTxType.WAREHOUSE_TRANSFER,
        inventoryItemId: line.inventoryItemId,
        warehouseId: transfer.fromWarehouseId,
        quantity: Number(line.quantity),
        outbound: true,
        userId,
        referenceType: 'WarehouseTransfer',
        referenceId: transfer.id,
        notes: `Transfer ${transfer.number} out`,
      });
      await this.applyMovement({
        type: InventoryTxType.WAREHOUSE_TRANSFER,
        inventoryItemId: line.inventoryItemId,
        warehouseId: transfer.toWarehouseId,
        quantity: Number(line.quantity),
        userId,
        referenceType: 'WarehouseTransfer',
        referenceId: transfer.id,
        notes: `Transfer ${transfer.number} in`,
      });
    }

    return this.prisma.warehouseTransfer.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { lines: true, fromWarehouse: true, toWarehouse: true },
    });
  }

  listTransfers(query: PaginationDto) {
    return this.prisma.$transaction([
      this.prisma.warehouseTransfer.count(),
      this.prisma.warehouseTransfer.findMany({
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
      lines: { inventoryItemId: string; countedQty?: number }[];
    },
    userId: string,
  ) {
    const number = await this.sequences.next('CNT', 'CNT');
    const lines = await Promise.all(
      dto.lines.map(async (l) => {
        const balance = await this.prisma.inventoryBalance.findFirst({
          where: {
            inventoryItemId: l.inventoryItemId,
            warehouseId: dto.warehouseId,
            locationId: null,
          },
        });
        const systemQty = Number(balance?.availableQty ?? 0);
        const countedQty = l.countedQty != null ? Number(l.countedQty) : undefined;
        return {
          inventoryItemId: l.inventoryItemId,
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
      include: { lines: { include: { inventoryItem: true } } },
    });
  }

  async scanCount(
    dto: {
      warehouseId: string;
      code: string;
      countedQty: number;
      notes?: string;
      postImmediately?: boolean;
    },
    userId: string,
  ) {
    const item = await this.findByCode(dto.code.trim(), ['inventory.cost.read']);
    const count = await this.createCount(
      {
        warehouseId: dto.warehouseId,
        notes: dto.notes ?? `Scan ${dto.code.trim()}`,
        lines: [{ inventoryItemId: item.id, countedQty: Number(dto.countedQty) }],
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
      await this.applyMovement({
        type: InventoryTxType.INVENTORY_ADJUSTMENT,
        inventoryItemId: line.inventoryItemId,
        warehouseId: count.warehouseId,
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
      include: { lines: { include: { inventoryItem: true } } },
    });
  }

  listCounts(query: PaginationDto) {
    return this.prisma.$transaction([
      this.prisma.inventoryCount.count(),
      this.prisma.inventoryCount.findMany({
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

  listWarehouses() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async lowStock(permissions?: string[]) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      include: { balances: true },
    });
    return stripInventoryCostList(
      items
        .map((item) => {
          const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
          return { ...item, availableQty: available };
        })
        .filter((item) => item.availableQty <= Number(item.minStock)),
      permissions,
    );
  }

  private async nextInventorySku(category?: string): Promise<string> {
    const prefix = skuPrefixForCategory(category);
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
}
