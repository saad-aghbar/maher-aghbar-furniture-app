import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Optional,
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
import {
  Prisma,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
} from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { AuthUser } from '@maher/types';
import { PurchasingService } from './purchasing.service';
import { InventoryService } from '../inventory/inventory.service';
import { SupplierInvoicesService } from '../supplier-invoices/supplier-invoices.service';
import { FabricReceivingService } from './fabric-receiving.service';
import {
  classifyPurchaseOrder,
  purchaseVariance,
} from './purchase-order-presentation';
import { normalizePurchaseOrderOrigin } from './purchase-order-origin';
import { resolveLineWarehouse } from './purchase-order-lines';
import { receivePurchaseOrderGoods } from './receive-goods';
import { attachPurchaseRunMeta, PURCHASE_RUN_INCLUDE } from './purchase-run';
import { OpsNotifyService } from '../notifications/ops-notify.service';

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

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
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

  @IsOptional()
  @IsString()
  origin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

class BatchPurchaseOrderDto {
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

  @IsOptional()
  @IsString()
  origin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

class CreatePurchaseOrderBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPurchaseOrderDto)
  orders!: BatchPurchaseOrderDto[];
}

class CreatePurchaseRunDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPurchaseOrderDto)
  orders!: BatchPurchaseOrderDto[];
}

class SendPurchaseRunDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendPurchaseOrderBatchItemDto)
  orders?: SendPurchaseOrderBatchItemDto[];
}

class SendPurchaseOrderDto {
  @IsOptional()
  @IsString()
  body?: string;
}

class SendPurchaseOrderBatchItemDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  body?: string;
}

class SendPurchaseOrderBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendPurchaseOrderBatchItemDto)
  orders!: SendPurchaseOrderBatchItemDto[];
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
    private readonly supplierInvoices: SupplierInvoicesService,
    private readonly fabricReceiving: FabricReceivingService,
    @Optional() private readonly opsNotify?: OpsNotifyService,
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
    const created = await this.prisma.purchaseRequest.create({
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
    await this.opsNotify
      ?.onPurchaseRequest({
        topic: 'pr.created',
        id: created.id,
        number: created.number,
        actorUserId: user.id,
        requesterUserId: user.id,
      })
      .catch(() => undefined);
    return created;
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
    await this.opsNotify
      ?.onPurchaseRequest({
        topic: 'pr.approved',
        id: updated.id,
        number: updated.number,
        actorUserId: user.id,
        requesterUserId: pr.requestedById,
      })
      .catch(() => undefined);
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
    return this.purchasing.convertRequestToPo(id, user.id);
  }

  @Post('purchase-requests/:id/send-to-supplier')
  @RequirePermissions('purchase-order.approve')
  async sendRequestToSupplier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchasing.sendRequestToSupplier(id, user.id);
  }

  @Post('purchase-requests/from-low-stock')
  @RequirePermissions('purchase-request.create')
  async createFromLowStock(@CurrentUser() user: AuthUser) {
    const created = await this.purchasing.createFromLowStock({
      requestedById: user.id,
      reason: 'AUTO_REORDER',
      throwIfEmpty: true,
    });
    return created;
  }

  @Get('purchase-orders')
  @RequirePermissions('purchase-order.read')
  async listOrders(
    @Query()
    query: PaginationDto & {
      status?: string;
      q?: string;
      supplierId?: string;
      warehouseId?: string;
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
    const andFilters: Prisma.PurchaseOrderWhereInput[] = [];
    if (query.warehouseId) {
      andFilters.push({
        OR: [
          { warehouseId: query.warehouseId },
          { lines: { some: { warehouseId: query.warehouseId } } },
        ],
      });
    }
    if (query.q) {
      andFilters.push({
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
      });
    }
    const where: Prisma.PurchaseOrderWhereInput = {
      archivedAt: null,
      ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(andFilters.length ? { AND: andFilters } : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          warehouse: true,
          purchaseRun: { select: PURCHASE_RUN_INCLUDE },
          lines: { include: { inventoryItem: true, warehouse: true, location: true } },
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
        ...attachPurchaseRunMeta(po),
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

  @Get('purchase-orders/low-stock-draft')
  @RequirePermissions('purchase-order.read')
  async lowStockDraft(@Query() query: { q?: string }) {
    return this.purchasing.lowStockDraft({ q: query.q });
  }

  @Get('purchase-orders/buy-alert')
  @RequirePermissions('purchase-order.read')
  async buyAlert() {
    return this.purchasing.buyAlert();
  }

  @Get('purchase-orders/receivable')
  @RequirePermissions('inventory.receive')
  async listReceivable(@Query() query: { warehouseId?: string; q?: string }) {
    return this.purchasing.listReceivable(query);
  }

  @Post('purchase-orders/batch')
  @RequirePermissions('purchase-order.create')
  async createOrderBatch(@Body() dto: CreatePurchaseOrderBatchDto, @CurrentUser() user: AuthUser) {
    return this.purchasing.createOrdersBatch(dto.orders, user.id);
  }

  @Post('purchase-runs')
  @RequirePermissions('purchase-order.create')
  async createPurchaseRun(@Body() dto: CreatePurchaseRunDto, @CurrentUser() user: AuthUser) {
    return this.purchasing.createPurchaseRun(dto, user.id);
  }

  @Get('purchase-runs/:id')
  @RequirePermissions('purchase-order.read')
  getPurchaseRun(@Param('id') id: string) {
    return this.purchasing.getPurchaseRun(id);
  }

  @Post('purchase-runs/:id/approve')
  @RequirePermissions('purchase-order.approve')
  approvePurchaseRun(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchasing.approvePurchaseRun(id, user.id);
  }

  @Post('purchase-runs/:id/whatsapp-drafts')
  @RequirePermissions('purchase-order.approve')
  draftPurchaseRunWhatsApp(@Param('id') id: string) {
    return this.purchasing.draftPurchaseRunWhatsApp(id);
  }

  @Post('purchase-runs/:id/send')
  @RequirePermissions('purchase-order.approve')
  sendPurchaseRun(
    @Param('id') id: string,
    @Body() dto: SendPurchaseRunDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasing.sendPurchaseRun(id, user.id, dto.orders);
  }

  @Post('purchase-orders/send-batch')
  @RequirePermissions('purchase-order.approve')
  async sendOrderBatch(@Body() dto: SendPurchaseOrderBatchDto, @CurrentUser() user: AuthUser) {
    return this.purchasing.sendPurchaseOrdersBatch(dto.orders, user.id);
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
            warehouseId: resolveLineWarehouse(l, dto.warehouseId ?? existing.warehouseId),
            locationId: l.locationId,
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
    await this.opsNotify
      ?.onPurchaseOrder({
        topic: 'po.cancelled',
        id: po.id,
        number: po.number,
        actorUserId: user.id,
        transition: 'CANCELLED',
      })
      .catch(() => undefined);
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
        warehouseId: resolveLineWarehouse(l, dto.warehouseId),
        locationId: l.locationId,
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
        origin: normalizePurchaseOrderOrigin(dto.origin),
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
    await this.opsNotify
      ?.onPurchaseOrder({
        topic: 'po.approved',
        id: po.id,
        number: po.number,
        actorUserId: user.id,
        transition: 'APPROVED',
      })
      .catch(() => undefined);
    return po;
  }

  @Post('purchase-orders/:id/mark-sent')
  @RequirePermissions('purchase-order.approve')
  markSent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.purchasing.markPurchaseOrderSent(id, user.id);
  }

  @Post('purchase-orders/:id/whatsapp-draft')
  @RequirePermissions('purchase-order.approve')
  async draftWhatsApp(@Param('id') id: string) {
    return this.purchasing.draftPurchaseOrderWhatsApp(id);
  }

  @Post('purchase-orders/:id/send')
  @RequirePermissions('purchase-order.approve')
  async send(
    @Param('id') id: string,
    @Body() dto: SendPurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasing.sendPurchaseOrder(id, user.id, {
      body: dto.body,
      autoApprove: true,
    });
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('purchase-order.read')
  async getOrder(@Param('id') id: string) {
    const po = await this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        purchaseRun: { select: PURCHASE_RUN_INCLUDE },
        lines: { include: { inventoryItem: true, warehouse: true, location: true } },
        goodsReceipts: {
          include: {
            lines: { include: { inventoryItem: true, warehouse: true, location: true } },
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
      ...attachPurchaseRunMeta(po),
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
      warehouseId?: string;
      locationId?: string;
      photoDocumentId?: string;
      deliveryDocRef?: string;
      notes?: string;
      idempotencyKey?: string;
      lines: {
        inventoryItemId: string;
        orderedQty: number;
        receivedQty: number;
        rejectedQty?: number;
        unitCost?: number;
        batchNumber?: string;
        qualityStatus?: string;
        warehouseId?: string;
        locationId?: string;
      }[];
    },
    @CurrentUser() user: AuthUser,
  ) {
    return receivePurchaseOrderGoods(
      {
        prisma: this.prisma,
        sequences: this.sequences,
        inventory: this.inventory,
        fabricReceiving: this.fabricReceiving,
        supplierInvoices: this.supplierInvoices,
        opsNotify: this.opsNotify,
      },
      id,
      body,
      user.id,
    );
  }
}
