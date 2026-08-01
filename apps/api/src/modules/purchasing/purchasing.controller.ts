import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderStatus, PurchaseRequestStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { AuthUser } from '@maher/types';

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}

class CreatePurchaseRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

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
  ) {}

  @Get('purchase-requests')
  @RequirePermissions('purchase-request.read')
  async listRequests(@Query() query: PaginationDto & { status?: string; q?: string }) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = {
      archivedAt: null,
      ...(query.status ? { status: query.status as PurchaseRequestStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { reason: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseRequest.count({ where }),
      this.prisma.purchaseRequest.findMany({
        where,
        include: {
          lines: true,
          warehouse: true,
          offers: { include: { supplier: true } },
          purchaseOrder: { select: { id: true, number: true, status: true } },
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
        offers: { include: { supplier: true } },
        purchaseOrder: true,
      },
    });
  }

  @Post('purchase-requests')
  @RequirePermissions('purchase-request.create')
  async createRequest(@Body() dto: CreatePurchaseRequestDto, @CurrentUser() user: AuthUser) {
    const number = await this.sequences.next('PR', 'PR');
    return this.prisma.purchaseRequest.create({
      data: {
        number,
        requestedById: user.id,
        warehouseId: dto.warehouseId,
        reason: dto.reason,
        status: PurchaseRequestStatus.SUBMITTED,
        lines: {
          create: dto.lines.map((l) => ({
            description: l.description,
            quantity: roundMoney(l.quantity),
            inventoryItemId: l.inventoryItemId,
          })),
        },
      },
      include: { lines: true },
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
      [...pr.offers].sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice))[0];
    if (!selected) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Add at least one supplier offer before converting.',
      });
    }
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
    const items = await this.prisma.inventoryItem.findMany({
      where: { archivedAt: null },
      include: { balances: true },
    });
    const low = items.filter((item) => {
      const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
      return available <= Number(item.minStock);
    });
    if (!low.length) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'No low-stock items to order.',
      });
    }
    const number = await this.sequences.next('PR', 'PR');
    return this.prisma.purchaseRequest.create({
      data: {
        number,
        requestedById: user.id,
        reason: 'Auto-created from low stock',
        status: PurchaseRequestStatus.SUBMITTED,
        lines: {
          create: low.map((item) => {
            const available = item.balances.reduce((s, b) => s + Number(b.availableQty), 0);
            const qty = Math.max(Number(item.minStock) * 2 - available, 1);
            return {
              description: item.nameEn || item.nameAr || item.sku,
              quantity: roundMoney(qty),
              inventoryItemId: item.id,
            };
          }),
        },
      },
      include: { lines: true },
    });
  }

  @Get('purchase-orders')
  @RequirePermissions('purchase-order.read')
  async listOrders(@Query() query: PaginationDto & { status?: string; q?: string }) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = {
      archivedAt: null,
      ...(query.status ? { status: query.status as PurchaseOrderStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { supplier: { name: { contains: query.q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: true, lines: true, purchaseRequest: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
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
    const number = await this.sequences.next('PORD', 'PORD');
    const lines = dto.lines.map((l) => {
      const unitPrice = Number(l.unitPrice);
      const lineTotal = Number(l.quantity) * unitPrice;
      return {
        description: l.description,
        quantity: roundMoney(l.quantity),
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
        status: PurchaseOrderStatus.DRAFT,
        subtotal: roundMoney(subtotal),
        taxAmount: roundMoney(taxAmount),
        total: roundMoney(total),
        lines: { create: lines },
      },
      include: { lines: true, supplier: true },
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
  getOrder(@Param('id') id: string) {
    return this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: {
        supplier: true,
        lines: true,
        goodsReceipts: { include: { lines: true } },
        purchaseRequest: true,
      },
    });
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
      lines: {
        inventoryItemId: string;
        orderedQty: number;
        receivedQty: number;
        rejectedQty?: number;
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
    const number = await this.sequences.next('GRN', 'GRN');

    const receipt = await this.prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceipt.create({
        data: {
          number,
          purchaseOrderId: id,
          warehouseId: body.warehouseId,
          deliveryDocRef: body.deliveryDocRef,
          notes: body.notes,
          createdById: user.id,
          lines: {
            create: body.lines.map((l) => ({
              inventoryItemId: l.inventoryItemId,
              orderedQty: roundMoney(l.orderedQty),
              receivedQty: roundMoney(l.receivedQty),
              rejectedQty: roundMoney(l.rejectedQty ?? 0),
              batchNumber: l.batchNumber,
              qualityStatus: l.qualityStatus,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of body.lines) {
        if (line.receivedQty <= 0) continue;
        const accepted = line.receivedQty - (line.rejectedQty ?? 0);
        if (accepted <= 0) continue;

        const balance = await tx.inventoryBalance.findFirst({
          where: {
            inventoryItemId: line.inventoryItemId,
            warehouseId: body.warehouseId,
            locationId: null,
          },
        });
        const next = Number(balance?.availableQty ?? 0) + accepted;
        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { availableQty: roundMoney(next) },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              inventoryItemId: line.inventoryItemId,
              warehouseId: body.warehouseId,
              availableQty: roundMoney(next),
            },
          });
        }

        const txNumber = await this.sequences.next('INVTX', 'INV');
        await tx.inventoryTransaction.create({
          data: {
            number: txNumber,
            type: 'PURCHASE_RECEIPT',
            inventoryItemId: line.inventoryItemId,
            warehouseId: body.warehouseId,
            quantity: roundMoney(accepted),
            referenceType: 'GoodsReceipt',
            referenceId: grn.id,
            createdById: user.id,
            notes: `GRN ${number}`,
          },
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
        return got >= Number(line.quantity);
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

    return receipt;
  }
}
