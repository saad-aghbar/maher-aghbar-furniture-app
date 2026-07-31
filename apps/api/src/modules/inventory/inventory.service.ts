import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryTxType, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  async listItems(query: PaginationDto) {
    const where: Prisma.InventoryItemWhereInput = {
      archivedAt: null,
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
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
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  async findByCode(code: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        archivedAt: null,
        OR: [{ sku: code }, { barcode: code }, { qrCode: code }],
      },
      include: { balances: { include: { warehouse: true } } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found.' });
    return item;
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

  receive(
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
    return this.applyMovement({
      type: InventoryTxType.PURCHASE_RECEIPT,
      ...dto,
      userId,
    });
  }

  issue(
    dto: {
      inventoryItemId: string;
      warehouseId: string;
      quantity: number;
      notes?: string;
      idempotencyKey?: string;
    },
    userId: string,
  ) {
    return this.applyMovement({
      type: InventoryTxType.PRODUCTION_ISSUE,
      ...dto,
      userId,
    });
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

  async lowStock() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      include: { balances: true },
    });
    return items
      .map((item) => {
        const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
        return { ...item, availableQty: available };
      })
      .filter((item) => item.availableQty <= Number(item.minStock));
  }
}
