import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma, PurchaseOrderStatus, PurchaseRequestStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { AuthUser } from '@maher/types';
import { PurchasingService } from './purchasing.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryTxType } from '@maher/database';
import {
  classifyPurchaseOrder,
  purchaseVariance,
} from './purchase-order-presentation';
import {
  acceptedReceiptQty,
  isOverReceipt,
  remainingOrderedQty,
} from './goods-receipt-cost';

class PurchaseLineDto {
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

class PatchPurchaseOrderDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  expectedDeliveryDate?: string | null;
}

class UpdateDraftPurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines?: PurchaseLineDto[];
}

class CreatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  preferredSupplierId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

class SupplierOfferDto {
  @IsUUID()
  supplierId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  leadTimeDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qualityScore?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isSelected?: boolean;
}

@ApiTags('purchasing')
@Controller()
export class PurchasingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly purchasing: PurchasingService,
    private readonly inventory: InventoryService,
  ) {}

  private async assertPurchasableItems(ids: Array<string | undefined>) {
    const inventoryIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!inventoryIds.length) return;
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: inventoryIds } },
      select: { id: true, isPurchasable: true, sku: true },
    });
    const blocked = items.filter((i) => !i.isPurchasable);
    if (blocked.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only purchasable raw materials can be added to purchasing documents.',
      });
    }
  }

  @Get('purchase-requests')
  @RequirePermissions('purchase-request.read')
  async listRequests(
    @Query() query: PaginationDto & { status?: string; q?: string; supplierId?: string },
  ) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const mode = 'insensitive' as const;
    const and: Prisma.PurchaseRequestWhereInput[] = [];

    if (query.supplierId) {
      and.push({
        OR: [
          { preferredSupplierId: query.supplierId },
          { offers: { some: { supplierId: query.supplierId } } },
          { purchaseOrder: { is: { supplierId: query.supplierId } } },
        ],
      });
    }

    if (query.q) {
      const q = query.q;
      const supplierNameOr = {
        OR: [
          { name: { contains: q, mode } },
          { nameAr: { contains: q, mode } },
          { nameEn: { contains: q, mode } },
          { nameHe: { contains: q, mode } },
          { code: { contains: q, mode } },
        ],
      };
      and.push({
        OR: [
          { number: { contains: q, mode } },
          { reason: { contains: q, mode } },
          { offers: { some: { supplier: supplierNameOr } } },
          { purchaseOrder: { is: { supplier: supplierNameOr } } },
        ],
      });
    }

    const where: Prisma.PurchaseRequestWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status as PurchaseRequestStatus } : {}),
      ...(and.length ? { AND: and } : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseRequest.count({ where }),
      this.prisma.purchaseRequest.findMany({
        where,
        include: {
          lines: true,
          warehouse: true,
          preferredSupplier: {
            select: { id: true, name: true, nameAr: true, nameEn: true, nameHe: true, code: true },
          },
          offers: { include: { supplier: true } },
          purchaseOrder: {
            select: {
              id: true,
              number: true,
              status: true,
              supplier: {
                select: { id: true, name: true, nameAr: true, nameEn: true, nameHe: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Get('purchase-requests/:id')
  @RequirePermissions('purchase-request.read')
  getRequest(@Param('id') id: string) {
    return this.prisma.purchaseRequest.findUniqueOrThrow({
      where: { id },
      include: {
        lines: { include: { inventoryItem: true } },
        warehouse: true,
        preferredSupplier: true,
        offers: { include: { supplier: true } },
        purchaseOrder: true,
      },
    });
  }

  @Post('purchase-requests')
  @RequirePermissions('purchase-request.create')
  async createRequest(@Body() dto: CreatePurchaseRequestDto, @CurrentUser() user: AuthUser) {
    await this.assertPurchasableItems(dto.lines.map((l) => l.inventoryItemId));
    const number = await this.sequences.next('PR', 'PR');
    return this.prisma.purchaseRequest.create({
      data: {
        number,
        requestedById: user.id,
        warehouseId: dto.warehouseId,
        preferredSupplierId: dto.preferredSupplierId,
        reason: dto.reason,
        status: PurchaseRequestStatus.SUBMITTED,
        lines: {
          create: dto.lines.map((l) => ({
            description: l.description,
            quantity: roundMoney(l.quantity),
            unit: l.unit?.trim() || 'pcs',
            inventoryItemId: l.inventoryItemId,
          })),
        },
      },
      include: { lines: true, preferredSupplier: true },
    });
  }

  @Post('purchase-requests/:id/approve')
  @RequirePermissions('purchase-order.approve')
  async approveRequest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    if (pr.status !== PurchaseRequestStatus.SUBMITTED) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only submitted purchase requests can be approved.',
      });
    }
    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: { status: PurchaseRequestStatus.APPROVED },
      include: { lines: true, offers: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-request.approve',
        entityType: 'PurchaseRequest',
        entityId: id,
      },
    });
    return updated;
  }

  @Post('purchase-requests/:id/offers')
  @RequirePermissions('purchase-request.create')
  async addOffer(
    @Param('id') id: string,
    @Body() dto: SupplierOfferDto,
    @CurrentUser() user: AuthUser,
  ) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    if (
      pr.status !== PurchaseRequestStatus.SUBMITTED &&
      pr.status !== PurchaseRequestStatus.APPROVED
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Cannot add offers in current status.',
      });
    }
    if (dto.isSelected) {
      await this.prisma.supplierQuoteOffer.updateMany({
        where: { purchaseRequestId: id },
        data: { isSelected: false },
      });
    }
    const offer = await this.prisma.supplierQuoteOffer.create({
      data: {
        purchaseRequestId: id,
        supplierId: dto.supplierId,
        unitPrice: roundMoney(dto.unitPrice),
        leadTimeDays: dto.leadTimeDays,
        qualityScore:
          dto.qualityScore != null ? roundMoney(dto.qualityScore) : undefined,
        notes: dto.notes,
        isSelected: Boolean(dto.isSelected),
      },
      include: { supplier: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-request.offer',
        entityType: 'PurchaseRequest',
        entityId: id,
        newValues: { offerId: offer.id, supplierId: dto.supplierId },
      },
    });
    return offer;
  }

  @Post('purchase-requests/:id/offers/:offerId/select')
  @RequirePermissions('purchase-request.create')
  async selectOffer(
    @Param('id') id: string,
    @Param('offerId') offerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const offer = await this.prisma.supplierQuoteOffer.findFirst({
      where: { id: offerId, purchaseRequestId: id },
    });
    if (!offer) {
      throw new BadRequestException({
        code: 'NOT_FOUND',
        message: 'Offer not found on this purchase request.',
      });
    }
    await this.prisma.supplierQuoteOffer.updateMany({
      where: { purchaseRequestId: id },
      data: { isSelected: false },
    });
    const selected = await this.prisma.supplierQuoteOffer.update({
      where: { id: offerId },
      data: { isSelected: true },
      include: { supplier: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-request.select-offer',
        entityType: 'PurchaseRequest',
        entityId: id,
        newValues: { offerId },
      },
    });
    return selected;
  }

  @Post('purchase-requests/:id/convert')
  @RequirePermissions('purchase-order.create')
  async convertToPo(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({
      where: { id },
      include: { lines: true, offers: true },
    });
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase request must be approved before conversion.',
      });
    }
    if (pr.purchaseOrderId) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase request already converted.',
      });
    }
    const selected =
      pr.offers.find((o) => o.isSelected) ??
      [...pr.offers].sort((a, b) => {
        const priceDiff = Number(a.unitPrice) - Number(b.unitPrice);
        if (priceDiff !== 0) return priceDiff;
        return Number(b.qualityScore ?? 0) - Number(a.qualityScore ?? 0);
      })[0];
    if (!selected) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Add at least one supplier offer before converting.',
      });
    }
    await this.purchasing.assertSupplierCertified(selected.supplierId);
    const selectedUnitPrice = Number(selected.unitPrice);

    const number = await this.sequences.next('PORD', 'PORD');
    const lines = pr.lines.map((l) => {
      const lineTotal = Number(l.quantity) * selectedUnitPrice;
      return {
        description: l.description,
        quantity: roundMoney(Number(l.quantity)),
        unitPrice: roundMoney(selectedUnitPrice),
        taxRate: roundMoney(0.16),
        lineTotal: roundMoney(lineTotal * 1.16),
        inventoryItemId: l.inventoryItemId ?? undefined,
      };
    });
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
    const taxAmount = subtotal * 0.16;

    const po = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          number,
          supplierId: selected.supplierId,
          warehouseId: pr.warehouseId ?? undefined,
          status: PurchaseOrderStatus.DRAFT,
          subtotal: roundMoney(subtotal),
          taxAmount: roundMoney(taxAmount),
          total: roundMoney(subtotal + taxAmount),
          notes: pr.reason ?? undefined,
          lines: { create: lines },
        },
        include: { lines: true, supplier: true },
      });
      await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: PurchaseRequestStatus.ORDERED,
          purchaseOrderId: created.id,
        },
      });
      await tx.supplierQuoteOffer.update({
        where: { id: selected.id },
        data: { isSelected: true },
      });
      return created;
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-request.convert',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        newValues: { purchaseRequestId: id },
      },
    });
    return po;
  }

  @Post('purchase-requests/from-low-stock')
  @RequirePermissions('purchase-request.create')
  async createFromLowStock(@CurrentUser() user: AuthUser) {
    const created = await this.purchasing.createFromLowStock({
      requestedById: user.id,
      reason: 'AUTO_REORDER',
      throwIfEmpty: true,
    });
    return this.prisma.purchaseRequest.findUniqueOrThrow({
      where: { id: created!.id },
      include: { lines: true },
    });
  }

  @Get('purchase-orders')
  @RequirePermissions('purchase-order.read')
  async listOrders(
    @Query()
    query: PaginationDto & {
      status?: string;
      q?: string;
      supplierId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const mode = 'insensitive' as const;
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.getTime())) {
        // Inclusive end-of-day when date-only
        if (/^\d{4}-\d{2}-\d{2}$/.test(query.dateTo.trim())) {
          to.setHours(23, 59, 59, 999);
        }
        createdAt.lte = to;
      }
    }
    const where: Prisma.PurchaseOrderWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode } },
              { supplier: { name: { contains: query.q, mode } } },
              { supplier: { nameAr: { contains: query.q, mode } } },
              { supplier: { nameEn: { contains: query.q, mode } } },
              { supplier: { nameHe: { contains: query.q, mode } } },
              { supplier: { code: { contains: query.q, mode } } },
              { lines: { some: { description: { contains: query.q, mode } } } },
              {
                lines: {
                  some: { inventoryItem: { sku: { contains: query.q, mode } } },
                },
              },
              {
                lines: {
                  some: { inventoryItem: { nameEn: { contains: query.q, mode } } },
                },
              },
              { goodsReceipts: { some: { number: { contains: query.q, mode } } } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          lines: { include: { inventoryItem: true } },
          purchaseRequest: true,
          goodsReceipts: { include: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const enriched = data.map((po) => {
      const orderedQty = po.lines.reduce((s, l) => s + Number(l.quantity), 0);
      let receivedAcceptedQty = 0;
      for (const grn of po.goodsReceipts) {
        for (const line of grn.lines) {
          receivedAcceptedQty +=
            Number(line.receivedQty) - Number(line.rejectedQty ?? 0);
        }
      }
      return {
        ...po,
        presentation: classifyPurchaseOrder({
          status: po.status,
          expectedDeliveryDate: po.expectedDeliveryDate,
          orderedQty,
          receivedAcceptedQty,
        }),
        receivedAcceptedQty,
        orderedQty,
      };
    });
    return { data: enriched, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Get('material-demand')
  @RequirePermissions('purchase-order.read')
  async materialDemand(
    @Query() query: { q?: string; category?: string },
  ) {
    const rows = await this.purchasing.materialDemand();
    const q = query.q?.trim().toLowerCase();
    const category = query.category?.trim().toUpperCase();
    return rows.filter((row) => {
      if (category) {
        const cat = String((row as { category?: string | null }).category ?? '').toUpperCase();
        if (cat !== category) return false;
      }
      if (!q) return true;
      const hay = [row.sku, row.nameEn, row.nameAr, row.nameHe]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  @Patch('purchase-orders/:id')
  @RequirePermissions('purchase-order.create')
  patchOrder(
    @Param('id') id: string,
    @Body() dto: PatchPurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const expectedDeliveryDate = dto.expectedDeliveryDate
      ? new Date(dto.expectedDeliveryDate)
      : dto.expectedDeliveryDate === null
        ? null
        : undefined;
    if (expectedDeliveryDate === undefined) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'expectedDeliveryDate is required.',
      });
    }
    return this.purchasing.patchPurchaseOrderEta(id, expectedDeliveryDate, user.id);
  }

  /**
   * Draft-only structural edit (lines/prices/supplier/notes).
   * After SENT/any GRN: rejected — use ETA patch or cancel if allowed.
   */
  @Patch('purchase-orders/:id/draft')
  @RequirePermissions('purchase-order.create')
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: UpdateDraftPurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { goodsReceipts: { select: { id: true } } },
    });
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException({
        code: 'PO_NOT_EDITABLE',
        message: 'Only draft purchase orders can be structurally edited.',
      });
    }
    if (existing.goodsReceipts.length > 0) {
      throw new BadRequestException({
        code: 'PO_HAS_RECEIPTS',
        message: 'Cannot edit a purchase order that already has goods receipts.',
      });
    }
    if (dto.supplierId) {
      await this.purchasing.assertSupplierCertified(dto.supplierId);
    }
    if (dto.lines?.length) {
      if (dto.lines.some((l) => l.unitPrice == null)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'unitPrice is required on purchase order lines.',
        });
      }
      await this.assertPurchasableItems(dto.lines.map((l) => l.inventoryItemId));
    }

    const inventoryIds = dto.lines?.length
      ? [
          ...new Set(
            dto.lines.map((l) => l.inventoryItemId).filter((x): x is string => Boolean(x)),
          ),
        ]
      : [];
    const inventoryUnits = inventoryIds.length
      ? Object.fromEntries(
          (
            await this.prisma.inventoryItem.findMany({
              where: { id: { in: inventoryIds } },
              select: { id: true, unit: true },
            })
          ).map((i) => [i.id, i.unit]),
        )
      : ({} as Record<string, string>);

    const po = await this.prisma.$transaction(async (tx) => {
      if (dto.lines?.length) {
        await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
        const lines = dto.lines.map((l) => {
          const unitPrice = Number(l.unitPrice);
          const lineTotal = Number(l.quantity) * unitPrice;
          const unit =
            l.unit?.trim() ||
            (l.inventoryItemId ? inventoryUnits[l.inventoryItemId] : undefined) ||
            'pcs';
          return {
            purchaseOrderId: id,
            description: l.description,
            quantity: roundMoney(l.quantity),
            unit,
            unitPrice: roundMoney(unitPrice),
            taxRate: roundMoney(0.16),
            lineTotal: roundMoney(lineTotal * 1.16),
            inventoryItemId: l.inventoryItemId,
          };
        });
        await tx.purchaseOrderLine.createMany({ data: lines });
        const subtotal = lines.reduce(
          (s, l) => s + Number(l.quantity) * Number(l.unitPrice),
          0,
        );
        const taxAmount = subtotal * 0.16;
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
            ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.expectedDeliveryDate
              ? { expectedDeliveryDate: new Date(dto.expectedDeliveryDate) }
              : {}),
            subtotal: roundMoney(subtotal),
            taxAmount: roundMoney(taxAmount),
            total: roundMoney(subtotal + taxAmount),
          },
        });
      } else {
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...(dto.supplierId ? { supplierId: dto.supplierId } : {}),
            ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.expectedDeliveryDate
              ? { expectedDeliveryDate: new Date(dto.expectedDeliveryDate) }
              : {}),
          },
        });
      }
      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: { lines: { include: { inventoryItem: true } }, supplier: true },
      });
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-order.update-draft',
        entityType: 'PurchaseOrder',
        entityId: id,
      },
    });
    return po;
  }

  /** Soft-cancel. Blocked after any GRN (historical integrity). No hard-delete. */
  @Post('purchase-orders/:id/cancel')
  @RequirePermissions('purchase-order.approve')
  async cancelOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { goodsReceipts: { select: { id: true } } },
    });
    if (existing.goodsReceipts.length > 0) {
      throw new BadRequestException({
        code: 'PO_HAS_RECEIPTS',
        message: 'Cannot cancel a purchase order that has goods receipts. No hard-delete of received POs.',
      });
    }
    if (
      existing.status === PurchaseOrderStatus.RECEIVED ||
      existing.status === PurchaseOrderStatus.CLOSED ||
      existing.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase order cannot be cancelled in current status.',
      });
    }
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-order.cancel',
        entityType: 'PurchaseOrder',
        entityId: id,
      },
    });
    return po;
  }

  @Post('purchase-orders')
  @RequirePermissions('purchase-order.create')
  async createOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    if (dto.lines.some((l) => l.unitPrice == null)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'unitPrice is required on purchase order lines.',
      });
    }
    await this.purchasing.assertSupplierCertified(dto.supplierId);
    await this.assertPurchasableItems(dto.lines.map((l) => l.inventoryItemId));
    const number = await this.sequences.next('PORD', 'PORD');

    const inventoryIds = [
      ...new Set(dto.lines.map((l) => l.inventoryItemId).filter((id): id is string => Boolean(id))),
    ];
    const inventoryUnits = inventoryIds.length
      ? Object.fromEntries(
          (
            await this.prisma.inventoryItem.findMany({
              where: { id: { in: inventoryIds } },
              select: { id: true, unit: true },
            })
          ).map((i) => [i.id, i.unit]),
        )
      : ({} as Record<string, string>);

    const lines = dto.lines.map((l) => {
      const unitPrice = Number(l.unitPrice);
      const lineTotal = Number(l.quantity) * unitPrice;
      const unit =
        l.unit?.trim() ||
        (l.inventoryItemId ? inventoryUnits[l.inventoryItemId] : undefined) ||
        'pcs';
      return {
        description: l.description,
        quantity: roundMoney(l.quantity),
        unit,
        unitPrice: roundMoney(unitPrice),
        taxRate: roundMoney(0.16),
        lineTotal: roundMoney(lineTotal * 1.16),
        inventoryItemId: l.inventoryItemId,
      };
    });
    const subtotal = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
    const taxAmount = subtotal * 0.16;
    const total = subtotal + taxAmount;

    const po = await this.prisma.purchaseOrder.create({
      data: {
        number,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        notes: dto.notes,
        ...(dto.expectedDeliveryDate
          ? { expectedDeliveryDate: new Date(dto.expectedDeliveryDate) }
          : {}),
        status: PurchaseOrderStatus.DRAFT,
        subtotal: roundMoney(subtotal),
        taxAmount: roundMoney(taxAmount),
        total: roundMoney(total),
        lines: { create: lines },
      },
      include: { lines: { include: { inventoryItem: true } }, supplier: true },
    });

    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-order.create',
        entityType: 'PurchaseOrder',
        entityId: po.id,
      },
    });

    return po;
  }

  @Post('purchase-orders/:id/approve')
  @RequirePermissions('purchase-order.approve')
  async approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only draft purchase orders can be approved.',
      });
    }
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.APPROVED },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-order.approve',
        entityType: 'PurchaseOrder',
        entityId: id,
      },
    });
    return po;
  }

  @Post('purchase-orders/:id/send')
  @RequirePermissions('purchase-order.approve')
  async send(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    if (existing.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Only approved purchase orders can be sent.',
      });
    }
    await this.purchasing.assertSupplierCertified(existing.supplierId);
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SENT },
      include: { supplier: true },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'purchase-order.send',
        entityType: 'PurchaseOrder',
        entityId: id,
      },
    });
    return po;
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('purchase-order.read')
  async getOrder(@Param('id') id: string) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        lines: { include: { inventoryItem: true } },
        goodsReceipts: {
          include: {
            lines: { include: { inventoryItem: true } },
            warehouse: true,
          },
          orderBy: { receiptDate: 'asc' },
        },
        purchaseRequest: true,
        supplierInvoices: {
          where: { archivedAt: null },
          select: { id: true, number: true, status: true, total: true },
        },
      },
    });

    const orderedQty = po.lines.reduce((s, l) => s + Number(l.quantity), 0);
    let receivedAcceptedQty = 0;
    let actualReceivedValue = 0;
    const receivedByItem = new Map<string, number>();
    for (const grn of po.goodsReceipts) {
      for (const line of grn.lines) {
        const accepted = Number(line.receivedQty) - Number(line.rejectedQty ?? 0);
        receivedAcceptedQty += accepted;
        if (line.unitCost != null && accepted > 0) {
          actualReceivedValue += accepted * Number(line.unitCost);
        } else if (line.extendedCost != null) {
          actualReceivedValue += Number(line.extendedCost);
        }
        if (line.inventoryItemId) {
          receivedByItem.set(
            line.inventoryItemId,
            (receivedByItem.get(line.inventoryItemId) ?? 0) + accepted,
          );
        }
      }
    }
    const expectedTotal = po.lines.reduce(
      (s, l) => s + Number(l.quantity) * Number(l.unitPrice),
      0,
    );
    const variance = purchaseVariance({ expectedTotal, actualReceivedValue });
    const presentation = classifyPurchaseOrder({
      status: po.status,
      expectedDeliveryDate: po.expectedDeliveryDate,
      orderedQty,
      receivedAcceptedQty,
    });

    const lines = po.lines.map((line) => {
      const received = line.inventoryItemId
        ? receivedByItem.get(line.inventoryItemId) ?? 0
        : 0;
      const ordered = Number(line.quantity);
      return {
        ...line,
        receivedQty: received,
        remainingQty: Math.max(0, ordered - received),
      };
    });

    // Attachments via existing uploads: category PURCHASE_ORDER:{id} / GOODS_RECEIPT:{grnId}
    const grnIds = po.goodsReceipts.map((g) => g.id);
    const attachmentCategories = [
      `PURCHASE_ORDER:${id}`,
      `PO_QUOTE:${id}`,
      `PO_ORDER:${id}`,
      ...grnIds.flatMap((gid) => [`GOODS_RECEIPT:${gid}`, `GRN_NOTE:${gid}`, `GRN_PHOTO:${gid}`]),
    ];
    const attachments = await this.prisma.document.findMany({
      where: {
        archivedAt: null,
        category: { in: attachmentCategories },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        category: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    return {
      ...po,
      lines,
      presentation,
      purchasingCosting: {
        expectedTotal: variance.expectedTotal,
        actualReceivedValue: variance.actualReceivedValue,
        purchaseVariance: variance.variance,
      },
      attachments,
    };
  }

  @Post('purchase-orders/:id/goods-receipts')
  @RequirePermissions('inventory.receive')
  async createGoodsReceipt(
    @Param('id') id: string,
    @Body()
    body: {
      warehouseId: string;
      deliveryDocRef?: string;
      notes?: string;
      /** Request-level key — retries return the same GRN instead of duplicating stock. */
      idempotencyKey?: string;
      lines: {
        inventoryItemId: string;
        orderedQty: number;
        receivedQty: number;
        rejectedQty?: number;
        /** Actual receipt unit cost; defaults to PO line unitPrice. */
        unitCost?: number;
        batchNumber?: string;
        qualityStatus?: string;
      }[];
    },
    @CurrentUser() user: AuthUser,
  ) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { lines: true, goodsReceipts: { include: { lines: true } } },
    });
    const warehouse = await this.prisma.warehouse.findUniqueOrThrow({
      where: { id: body.warehouseId },
    });
    if (warehouse.type !== 'RAW_MATERIALS') {
      throw new BadRequestException({
        code: 'WAREHOUSE_TYPE_MISMATCH',
        message: 'Goods receipts must go into a raw materials warehouse.',
      });
    }
    if (
      po.status !== PurchaseOrderStatus.APPROVED &&
      po.status !== PurchaseOrderStatus.SENT &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Purchase order is not receivable in current status.',
      });
    }

    const requestKey = body.idempotencyKey?.trim() || null;
    if (requestKey) {
      const existing = await this.prisma.goodsReceipt.findUnique({
        where: { idempotencyKey: requestKey },
        include: { lines: { include: { inventoryItem: true } }, warehouse: true },
      });
      if (existing) {
        if (existing.purchaseOrderId !== id) {
          throw new BadRequestException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key already used for another purchase order.',
          });
        }
        return existing;
      }
    }

    // Prior accepted by inventory item (received − rejected).
    const priorAccepted = new Map<string, number>();
    for (const r of po.goodsReceipts) {
      for (const l of r.lines) {
        const prev = priorAccepted.get(l.inventoryItemId) ?? 0;
        priorAccepted.set(
          l.inventoryItemId,
          prev + Number(l.receivedQty) - Number(l.rejectedQty ?? 0),
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
      const ordered = orderedByItem.get(line.inventoryItemId) ?? 0;
      const already = priorAccepted.get(line.inventoryItemId) ?? 0;
      const remaining = remainingOrderedQty(ordered, already);
      if (isOverReceipt(accepted, remaining)) {
        throw new BadRequestException({
          code: 'OVER_RECEIPT',
          message: `Cannot receive more than remaining ordered qty for item (${remaining}).`,
        });
      }
    }

    const number = await this.sequences.next('GRN', 'GRN');

    const receipt = await this.prisma.$transaction(async (tx) => {
      if (requestKey) {
        const race = await tx.goodsReceipt.findUnique({
          where: { idempotencyKey: requestKey },
          include: { lines: { include: { inventoryItem: true } }, warehouse: true },
        });
        if (race) return race;
      }

      const lineCreates = body.lines.map((l) => {
        const received = Number(l.receivedQty) || 0;
        const rejected = Number(l.rejectedQty ?? 0) || 0;
        const accepted = Math.max(0, received - rejected);
        const mappedPrice = priceByItem.get(l.inventoryItemId);
        const rawCost =
          l.unitCost != null && Number(l.unitCost) > 0
            ? Number(l.unitCost)
            : mappedPrice != null && mappedPrice > 0
              ? mappedPrice
              : null;
        const unitCost = rawCost != null ? Number(roundMoney(rawCost)) : null;
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
          _accepted: accepted,
          _unitCostNum: unitCost,
        };
      });

      const grn = await tx.goodsReceipt.create({
        data: {
          number,
          purchaseOrderId: id,
          warehouseId: body.warehouseId,
          deliveryDocRef: body.deliveryDocRef,
          notes: body.notes,
          createdById: user.id,
          ...(requestKey ? { idempotencyKey: requestKey } : {}),
          lines: {
            create: lineCreates.map(({ _accepted, _unitCostNum, ...rest }) => rest),
          },
        },
        include: { lines: { include: { inventoryItem: true } }, warehouse: true },
      });

      for (const prepared of lineCreates) {
        if (prepared._accepted <= 0) continue;
        await this.inventory.applyMovement({
          type: InventoryTxType.PURCHASE_RECEIPT,
          inventoryItemId: prepared.inventoryItemId,
          warehouseId: body.warehouseId,
          quantity: prepared._accepted,
          unitCost: prepared._unitCostNum ?? undefined,
          userId: user.id,
          referenceType: 'GoodsReceipt',
          referenceId: grn.id,
          notes: `GRN ${number}`,
          idempotencyKey: `grn:${grn.id}:${prepared.inventoryItemId}`,
          db: tx,
        });
      }

      const allReceipts = await tx.goodsReceipt.findMany({
        where: { purchaseOrderId: id },
        include: { lines: true },
      });
      const receivedByItem = new Map<string, number>();
      for (const r of allReceipts) {
        for (const l of r.lines) {
          const key = l.inventoryItemId;
          const prev = receivedByItem.get(key) ?? 0;
          receivedByItem.set(
            key,
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
        where: { id },
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
        userId: user.id,
        action: 'goods-receipt.create',
        entityType: 'GoodsReceipt',
        entityId: receipt.id,
        newValues: { purchaseOrderId: po.id },
      },
    });

    await this.inventory.retryWaitingMaterialOrders(user.id).catch(() => undefined);

    return receipt;
  }
}
