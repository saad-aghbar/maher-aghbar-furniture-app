import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderStatus, PurchaseRequestStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';
import type { AuthUser } from '@maher/types';

class PurchaseLineDto {
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

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

@ApiTags('purchasing')
@Controller()
export class PurchasingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get('purchase-requests')
  @RequirePermissions('purchase-request.read')
  async listRequests(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseRequest.count(),
      this.prisma.purchaseRequest.findMany({
        include: { lines: true, warehouse: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
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

  @Get('purchase-orders')
  @RequirePermissions('purchase-order.read')
  async listOrders(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where: { archivedAt: null } }),
      this.prisma.purchaseOrder.findMany({
        where: { archivedAt: null },
        include: { supplier: true, lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post('purchase-orders')
  @RequirePermissions('purchase-order.create')
  async createOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthUser) {
    const number = await this.sequences.next('PORD', 'PORD');
    const lines = dto.lines.map((l) => {
      const lineTotal = Number(l.quantity) * Number(l.unitPrice);
      return {
        description: l.description,
        quantity: roundMoney(l.quantity),
        unitPrice: roundMoney(l.unitPrice),
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
        lines: {
          create: lines,
        },
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

  @Get('purchase-orders/:id')
  @RequirePermissions('purchase-order.read')
  getOrder(@Param('id') id: string) {
    return this.prisma.purchaseOrder.findUniqueOrThrow({
      where: { id },
      include: { supplier: true, lines: true, goodsReceipts: { include: { lines: true } } },
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
      include: { lines: true },
    });
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

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
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
