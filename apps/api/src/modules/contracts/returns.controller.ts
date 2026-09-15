import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma, ReturnReason, ReturnResolution } from '@maher/database';
import type { AuthUser } from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequireAnyPermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { customerScopeFilter } from '../../common/helpers/customer-scope';
import { roundMoney } from '../../common/helpers/money.util';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OpsNotifyService } from '../notifications/ops-notify.service';
import { ManufacturingCostService } from '../production/manufacturing-cost.service';
import { ReturnsService } from './returns.service';
import { ReturnLifecycleState, ReturnResponsibility } from '@maher/database';
import { approvedReturnResolution } from './return-lifecycle';
import { packPhotoKeys, unpackPhotoKeys } from '../../common/helpers/photo-keys.util';
import { ReturnPieceService } from './return-piece.service';
import { summarizePieces } from './return-case-aggregate';
import { ReturnInspectionResult, ReturnRecoveryOutcome } from '@maher/database';

const RETURN_INCLUDE = {
  customer: true,
  product: {
    select: {
      id: true,
      sku: true,
      nameAr: true,
      nameEn: true,
      nameHe: true,
      imageUrl: true,
    },
  },
  salesOrderLine: {
    select: {
      id: true,
      description: true,
      quantity: true,
      productId: true,
      variantId: true,
      variantSku: true,
      variantLabel: true,
      product: {
        select: {
          id: true,
          sku: true,
          nameAr: true,
          nameEn: true,
          nameHe: true,
          imageUrl: true,
        },
      },
    },
  },
  workOrders: {
    select: {
      id: true,
      number: true,
      originType: true,
      status: true,
      releasedToFactoryAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  delivery: { select: { id: true, number: true, status: true } },
  reshipDeliveries: {
    select: {
      id: true,
      number: true,
      status: true,
      purpose: true,
      deliveryDate: true,
      deliveryAddress: true,
      notes: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  pieces: {
    include: {
      product: {
        select: { id: true, sku: true, nameAr: true, nameEn: true, nameHe: true, imageUrl: true },
      },
      salesOrder: { select: { id: true, number: true } },
      productionOrder: {
        select: {
          id: true,
          number: true,
          originType: true,
          status: true,
          progressPercent: true,
          releasedToFactoryAt: true,
        },
      },
      recoveryOrder: {
        select: {
          id: true,
          number: true,
          originType: true,
          status: true,
          progressPercent: true,
          releasedToFactoryAt: true,
        },
      },
      inventoryLot: {
        select: { id: true, status: true, qrCode: true, warehouseId: true, locationId: true },
      },
      recoveryLines: { orderBy: { recordedAt: 'asc' as const } },
    },
    orderBy: { pieceNo: 'asc' as const },
  },
  chargeInvoices: {
    where: { status: { not: 'CANCELLED' }, archivedAt: null },
    select: {
      id: true,
      number: true,
      total: true,
      status: true,
      outstandingAmount: true,
      dueDate: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 5,
  },
  salesOrder: {
    include: {
      lines: {
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              nameAr: true,
              nameEn: true,
              nameHe: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReturnRequestInclude;

class CreateReturnDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsOptional()
  @IsUUID()
  salesOrderLineId?: string;

  /** Optional link to the outbound delivery this return refers to. */
  @IsOptional()
  @IsUUID()
  deliveryId?: string;

  @IsString()
  productDesc!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @IsOptional()
  @IsString()
  description?: string;

  /** @deprecated Prefer reasonPhotoKeys — kept for older clients. */
  @IsOptional()
  @IsString()
  reasonPhotoKey?: string;

  /** @deprecated Prefer issuePhotoKeys — kept for older clients. */
  @IsOptional()
  @IsString()
  issuePhotoKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reasonPhotoKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issuePhotoKeys?: string[];

  @IsOptional()
  @IsArray()
  items?: Array<{ salesOrderLineId?: string; quantity: number }>;
}

class ResolveReturnDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEED_INFO'])
  approvalStatus!: 'APPROVED' | 'REJECTED' | 'NEED_INFO';

  /** On APPROVED: REPAIR or REPLACEMENT (default REPLACEMENT). CREDIT_NOTE/REFUND are blocked. */
  @IsOptional()
  @IsIn(['REPAIR', 'REPLACEMENT'])
  resolution?: 'REPAIR' | 'REPLACEMENT';

  @IsOptional()
  @IsString()
  needInfoNote?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class NeedInfoDto {
  @IsString()
  needInfoNote!: string;
}

class ListReturnsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

@ApiTags('returns')
@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly storage: LocalStorageService,
    private readonly notifications: NotificationsService,
    private readonly returns: ReturnsService,
    private readonly manufacturingCost: ManufacturingCostService,
    private readonly pieces: ReturnPieceService,
    @Optional() private readonly opsNotify?: OpsNotifyService,
  ) {}

  private photoUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;
    const token = this.storage.createAccessToken(key, 3600);
    return `/api/v1/uploads/download?token=${token}`;
  }

  private enrichReturn<T extends {
    reasonPhotoKey?: string | null;
    issuePhotoKey?: string | null;
    salesOrder?: {
      id?: string;
      number?: string;
      lines?: Array<{
        description?: string;
        product?: { id?: string; imageUrl?: string | null } | null;
      }>;
    } | null;
    salesOrderLine?: {
      product?: { id?: string; imageUrl?: string | null } | null;
    } | null;
    product?: { id?: string; imageUrl?: string | null } | null;
  }>(row: T) {
    const product = row.product ?? row.salesOrderLine?.product ?? row.salesOrder?.lines?.[0]?.product;
    const productImageUrl = product?.imageUrl?.trim() || null;
    const { reasonPhotoKey, issuePhotoKey, ...rest } = row;
    const reasonKeys = unpackPhotoKeys(reasonPhotoKey);
    const issueKeys = unpackPhotoKeys(issuePhotoKey);
    const reasonPhotoUrls = reasonKeys
      .map((k) => this.photoUrl(k))
      .filter((u): u is string => Boolean(u));
    const issuePhotoUrls = issueKeys
      .map((k) => this.photoUrl(k))
      .filter((u): u is string => Boolean(u));
    const lineLabel =
      row.salesOrderLine && 'variantLabel' in row.salesOrderLine
        ? ((row.salesOrderLine as { variantLabel?: string | null }).variantLabel ?? null)
        : null;
    return {
      ...rest,
      variantLabel: lineLabel,
      reasonPhotoKey,
      issuePhotoKey,
      reasonPhotoUrl: reasonPhotoUrls[0] ?? null,
      issuePhotoUrl: issuePhotoUrls[0] ?? null,
      reasonPhotoUrls,
      issuePhotoUrls,
      productImageUrl,
      productId: product?.id ?? null,
      pieceSummary: summarizePieces(('pieces' in row && Array.isArray((row as { pieces?: unknown[] }).pieces)
        ? (row as { pieces: Array<{ state?: string; decision?: string; outboundEligible?: boolean }> }).pieces
        : [])),
    };
  }

  @Get()
  @RequireAnyPermissions('return.read', 'sales-order.read')
  async list(@Query() query: ListReturnsDto, @CurrentUser() user: AuthUser) {
    const q = query.q?.trim();
    const and: Prisma.ReturnRequestWhereInput[] = [];

    if (query.customerId) {
      and.push({ customerId: query.customerId });
    }

    if (q) {
      and.push({
        OR: [
          { number: { contains: q, mode: 'insensitive' } },
          { productDesc: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { customer: { nameAr: { contains: q, mode: 'insensitive' } } },
          { customer: { nameEn: { contains: q, mode: 'insensitive' } } },
          { customer: { nameHe: { contains: q, mode: 'insensitive' } } },
          { customer: { code: { contains: q, mode: 'insensitive' } } },
          { salesOrder: { number: { contains: q, mode: 'insensitive' } } },
          { salesOrder: { externalOrderNumber: { contains: q, mode: 'insensitive' } } },
          {
            salesOrder: {
              lines: {
                some: {
                  OR: [
                    { description: { contains: q, mode: 'insensitive' } },
                    { product: { sku: { contains: q, mode: 'insensitive' } } },
                    { product: { nameEn: { contains: q, mode: 'insensitive' } } },
                    { product: { nameAr: { contains: q, mode: 'insensitive' } } },
                    { product: { nameHe: { contains: q, mode: 'insensitive' } } },
                  ],
                },
              },
            },
          },
        ],
      });
    }

    const where: Prisma.ReturnRequestWhereInput = {
      ...customerScopeFilter(user),
      ...(and.length ? { AND: and } : {}),
    };

    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.returnRequest.count({ where }),
      this.prisma.returnRequest.findMany({
        where,
        include: RETURN_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: data.map((row) => this.enrichReturn(row)),
      meta: paginatedMeta(query.page, query.pageSize, totalItems),
    };
  }

  @Post()
  @RequireAnyPermissions('return.create', 'sales-order.read')
  async create(@Body() dto: CreateReturnDto, @CurrentUser() user: AuthUser) {
    const customerId = user.customerId ?? dto.customerId;
    if (!customerId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'customerId is required.' });
    }
    if (user.customerId && dto.customerId && dto.customerId !== user.customerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot submit return for another customer.',
      });
    }

    if (dto.salesOrderId) {
      const so = await this.prisma.salesOrder.findFirst({
        where: { id: dto.salesOrderId, customerId, archivedAt: null },
        select: { id: true },
      });
      if (!so) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'salesOrderId is invalid for this customer.',
        });
      }
    }

    const items = (dto.items ?? []).filter((item) => Number(item.quantity) > 0);
    const derivedQty = items.length
      ? items.reduce((sum, item) => sum + Math.max(1, Math.round(Number(item.quantity) || 0)), 0)
      : Number(dto.quantity ?? 0);
    if (!(derivedQty > 0)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'quantity or items[] is required.',
      });
    }
    if (items.length) {
      for (const item of items) {
        await this.returns.assertReturnQuantity({
          customerId,
          salesOrderId: dto.salesOrderId,
          salesOrderLineId: item.salesOrderLineId ?? dto.salesOrderLineId,
          quantity: Math.max(1, Math.round(Number(item.quantity) || 0)),
        });
      }
    } else {
      await this.returns.assertReturnQuantity({
        customerId,
        salesOrderId: dto.salesOrderId,
        salesOrderLineId: dto.salesOrderLineId,
        quantity: derivedQty,
      });
    }
    const identity = await this.returns.resolveLineAndProduct({
      customerId,
      salesOrderId: dto.salesOrderId,
      salesOrderLineId: items[0]?.salesOrderLineId ?? dto.salesOrderLineId,
    });

    if (dto.deliveryId) {
      const delivery = await this.prisma.delivery.findFirst({
        where: {
          id: dto.deliveryId,
          customerId,
          ...(dto.salesOrderId ? { salesOrderId: dto.salesOrderId } : {}),
        },
        select: { id: true, salesOrderId: true },
      });
      if (!delivery) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'deliveryId is invalid for this customer.',
        });
      }
    }

    const number = await this.sequences.next('RET', 'RET');
    const reasonPacked = packPhotoKeys([
      ...(dto.reasonPhotoKeys ?? []),
      dto.reasonPhotoKey,
    ]);
    const issuePacked = packPhotoKeys([
      ...(dto.issuePhotoKeys ?? []),
      dto.issuePhotoKey,
    ]);
    // Report creates 0 inventory — physicalStatus NONE, approval PENDING.
    const created = await this.prisma.returnRequest.create({
      data: {
        number,
        customerId,
        salesOrderId: dto.salesOrderId,
        salesOrderLineId: identity.salesOrderLineId,
        productId: identity.productId,
        variantId: identity.variantId,
        sourceProductionOrderId: identity.sourceProductionOrderId,
        deliveryId: dto.deliveryId,
        productDesc: dto.productDesc,
        quantity: roundMoney(derivedQty),
        reason: dto.reason,
        description: dto.description,
        reasonPhotoKey: reasonPacked,
        issuePhotoKey: issuePacked,
        approvalStatus: 'PENDING',
        physicalStatus: 'NONE',
        lifecycleState: ReturnLifecycleState.REQUESTED,
        inventoryFate: 'PENDING',
      },
      include: RETURN_INCLUDE,
    });
    await this.pieces.materializePieces(
      created.id,
      items.length
        ? items.map((item) => ({
            salesOrderLineId: item.salesOrderLineId ?? dto.salesOrderLineId,
            quantity: Math.max(1, Math.round(Number(item.quantity) || 0)),
            productDesc: dto.productDesc,
          }))
        : undefined,
    );
    const withPieces = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id: created.id },
      include: RETURN_INCLUDE,
    });
    await this.notifyDealerReturn(withPieces.customerId, 'RETURN_SUBMITTED', withPieces.number, withPieces.id);
    return this.enrichReturn(withPieces);
  }

  @Get(':id')
  @RequireAnyPermissions('return.read', 'sales-order.read')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id, ...customerScopeFilter(user) },
      include: {
        ...RETURN_INCLUDE,
        salesOrder: {
          include: {
            lines: {
              orderBy: { sortOrder: 'asc' },
              include: {
                product: {
                  select: {
                    id: true,
                    sku: true,
                    nameAr: true,
                    nameEn: true,
                    nameHe: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }
    const reworkCost = await this.manufacturingCost.summaryForReturn(id, user);
    return { ...this.enrichReturn(row), reworkCost };
  }

  @Get(':id/capabilities')
  @RequireAnyPermissions('return.read', 'sales-order.read')
  capabilities(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pieces.capabilities(id, user);
  }

  @Get(':id/pieces')
  @RequireAnyPermissions('return.read', 'sales-order.read')
  listPieces(@Param('id') id: string) {
    return this.pieces.listForReturn(id);
  }

  @Post(':id/decisions')
  @RequireAnyPermissions('return.inspect', 'return.work', 'sales-order.update')
  async decidePieces(
    @Param('id') id: string,
    @Body()
    body: {
      items: Array<{
        pieceId: string;
        decision: 'REPAIR' | 'REPLACEMENT' | 'SCRAP_RECOVERY';
        inspectionNotes?: string;
        workflowId?: string;
      }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.pieces.decidePieces(id, user, body ?? { items: [] });
    const decided = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id: row.id },
      include: RETURN_INCLUDE,
    });
    await this.notifyDealerReturn(decided.customerId, 'RETURN_DECISION', decided.number, decided.id);
    if (decided.workOrders.length) {
      await this.notifyDealerReturn(
        decided.customerId,
        'RETURN_WORK_STARTED',
        decided.number,
        decided.id,
      );
    }
    return this.enrichReturn(decided);
  }

  @Post(':id/pieces/:pid/recovery-lines')
  @RequireAnyPermissions('return.inspect', 'return.recovery.post', 'sales-order.update')
  recordRecoveryLine(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @Body()
    body: {
      productionTaskId?: string;
      inventoryItemId?: string;
      label: string;
      quantity: number;
      unit?: string;
      condition?: ReturnInspectionResult;
      outcome: ReturnRecoveryOutcome;
      destinationWarehouseId?: string;
      destinationLocationId?: string;
      unitCost?: number;
      notes?: string;
      photoKeys?: string[];
    },
    @CurrentUser() user: AuthUser,
  ) {
    void id;
    return this.pieces.recordRecoveryLine(pid, user, body);
  }

  @Post(':id/recovery-lines/:lid/post')
  @RequireAnyPermissions('return.recovery.post', 'return.inspect', 'sales-order.update')
  postRecoveryLine(@Param('lid') lid: string, @CurrentUser() user: AuthUser) {
    return this.pieces.postRecoveryLine(lid, user);
  }

  @Patch(':id/recovery-lines/:lid')
  @RequireAnyPermissions('return.inspect', 'return.recovery.post', 'sales-order.update')
  updateRecoveryLine(
    @Param('lid') lid: string,
    @Body()
    body: {
      inventoryItemId?: string | null;
      label?: string;
      quantity?: number;
      unit?: string;
      outcome?: ReturnRecoveryOutcome;
      destinationWarehouseId?: string;
      destinationLocationId?: string | null;
      notes?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.pieces.updateRecoveryLine(lid, user, body);
  }

  @Delete(':id/recovery-lines/:lid')
  @RequireAnyPermissions('return.inspect', 'return.recovery.post', 'sales-order.update')
  deleteRecoveryLine(@Param('lid') lid: string, @CurrentUser() user: AuthUser) {
    return this.pieces.deleteRecoveryLine(lid, user);
  }

  /**
   * Admin review: APPROVED / REJECTED / NEED_INFO.
   * APPROVED sets WAITING_RETURN — does NOT quarantine stock (receive does).
   */
  @Patch(':id/resolve')
  @RequireAnyPermissions('return.approve', 'sales-order.update')
  async resolve(
    @Param('id') id: string,
    @Body() body: ResolveReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }

    if (body.approvalStatus === 'NEED_INFO') {
      return this.applyNeedInfo(existing.id, body.needInfoNote || body.notes || '', user);
    }

    if (body.approvalStatus === 'REJECTED') {
      const updated = await this.prisma.returnRequest.update({
        where: { id },
        data: {
          ...this.returns.applyState(existing.lifecycleState, ReturnLifecycleState.REJECTED),
          resolution: ReturnResolution.REJECTED,
        },
        include: RETURN_INCLUDE,
      });
      await this.prisma.auditEvent.create({
        data: {
          userId: user.id,
          action: 'return.reject',
          entityType: 'ReturnRequest',
          entityId: id,
          newValues: { approvalStatus: 'REJECTED' },
        },
      });
      await this.notifyDealerReturn(updated.customerId, 'RETURN_REJECTED', updated.number, updated.id);
      return this.enrichReturn(updated);
    }

    // APPROVED — no quarantine; wait for physical receive.
    // CREDIT_NOTE / REFUND stay readable on existing rows but cannot be opened here.
    const resolution = approvedReturnResolution(body.resolution) as ReturnResolution;

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        ...this.returns.applyState(existing.lifecycleState, ReturnLifecycleState.APPROVED),
        resolution,
        inventoryFate: 'PENDING',
        needInfoNote: null,
      },
      include: RETURN_INCLUDE,
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.approve',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          approvalStatus: 'APPROVED',
          resolution,
          physicalStatus: 'WAITING_RETURN',
        },
      },
    });
    await this.notifyDealerReturn(updated.customerId, 'RETURN_APPROVED', updated.number, updated.id);
    return this.enrichReturn(updated);
  }

  @Patch(':id/need-info')
  @RequireAnyPermissions('return.approve', 'sales-order.update')
  async needInfo(
    @Param('id') id: string,
    @Body() body: NeedInfoDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }
    return this.applyNeedInfo(id, body.needInfoNote, user);
  }

  /**
   * Physical receive at factory → CUSTOMER_RETURN / quarantine once.
   * Idempotent when already received.
   */
  @Post(':id/receive')
  @RequireAnyPermissions('return.receive', 'sales-order.update')
  async receive(
    @Param('id') id: string,
    @Body()
    body: {
      pieceIds?: string[];
      receivedQuantity?: number;
      receivedCondition?: string;
      receivedLocationId?: string;
      warehouseId?: string;
      receivedNotes?: string;
      photoKeys?: string[];
    } = {},
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }

    const updated = await this.pieces.receivePieces(id, user, {
      pieceIds: body.pieceIds,
      receivedCondition: body.receivedCondition,
      conditionNotes: body.receivedNotes,
      photoKeys: body.photoKeys,
      warehouseId: body.warehouseId,
      locationId: body.receivedLocationId,
    });
    await this.notifyDealerReturn(updated.customerId, 'RETURN_RECEIVED', updated.number, updated.id);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/mark-sent')
  @RequireAnyPermissions('return.create', 'return.receive', 'sales-order.read')
  async markSent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const updated = await this.returns.markInTransit(id, user);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: updated.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/inspect')
  @RequireAnyPermissions('return.inspect', 'sales-order.update')
  async inspect(
    @Param('id') id: string,
    @Body() body: { notes?: string; responsibility?: ReturnResponsibility },
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.returns.inspect(id, user, body ?? {});
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: updated.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/ready-to-return')
  @RequireAnyPermissions('return.inspect', 'return.work', 'sales-order.update')
  async markReadyToReturn(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.pieces.markCaseReady(id, user);
    const updated = await this.returns.markReadyToReturn(id);
    const ready = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id: updated.id },
      include: RETURN_INCLUDE,
    });
    await this.notifyDealerReturn(ready.customerId, 'RETURN_READY', ready.number, ready.id);
    return this.enrichReturn(ready);
  }

  @Post(':id/cancel')
  @RequireAnyPermissions('return.inspect', 'return.work', 'sales-order.update')
  async cancelReturn(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.pieces.cancelCase(id, user);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: row.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/pieces/:pid/cancel')
  @RequireAnyPermissions('return.inspect', 'return.work', 'sales-order.update')
  async cancelPiece(
    @Param('id') id: string,
    @Param('pid') pid: string,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.pieces.cancelPiece(id, pid, user);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: row.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/reship')
  @RequireAnyPermissions('return.work', 'delivery.update', 'sales-order.update')
  async scheduleReship(
    @Param('id') id: string,
    @Body() body: { address?: string; notes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.returns.scheduleReship(id, user, body ?? {});
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      select: { customerId: true, number: true },
    });
    if (row) {
      await this.notifyDealerReturn(
        row.customerId,
        'RETURN_RESHIP_SCHEDULED',
        row.number,
        id,
        { delivery: result.delivery.number },
      );
    }
    return result;
  }

  @Patch(':id/responsibility')
  @RequireAnyPermissions('return.inspect', 'sales-order.update')
  async setResponsibility(
    @Param('id') id: string,
    @Body()
    body: {
      responsibility: ReturnResponsibility;
      dealerAmount?: number;
      factoryAmount?: number;
      chargeAmount?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.returns.setResponsibility(id, user, body);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: updated.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/charge/send')
  @RequireAnyPermissions('return.inspect', 'sales-order.update')
  async sendCharge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const updated = await this.returns.sendCharge(id, user);
    await this.notifyDealerReturn(updated.customerId, 'RETURN_CHARGE_PROPOSED', updated.number, id);
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: updated.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/charge/respond')
  @RequireAnyPermissions('return.read', 'return.inspect', 'sales-order.read')
  async respondCharge(
    @Param('id') id: string,
    @Body() body: { accept: boolean; note?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const updated = await this.returns.respondCharge(id, user, body ?? { accept: false });
    if (!body?.accept) {
      await this.notifyDealerReturn(updated.customerId, 'RETURN_CHARGE_REJECTED', updated.number, id);
    }
    return this.enrichReturn(
      await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: updated.id }, include: RETURN_INCLUDE }),
    );
  }

  @Post(':id/charge')
  @RequireAnyPermissions('return.inspect', 'invoice.create', 'sales-order.update')
  async chargeDealer(
    @Param('id') id: string,
    @Body() body: { amount?: number; description?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const charged = await this.returns.chargeDealer(id, user, body ?? {});
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      select: { customerId: true, number: true },
    });
    if (row) {
      await this.notifyDealerReturn(row.customerId, 'RETURN_CHARGED', row.number, id, {
        invoice: charged.invoice.number,
      });
    }
    return charged;
  }

  private async applyNeedInfo(id: string, needInfoNote: string, user: AuthUser) {
    const note = needInfoNote?.trim();
    if (!note) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'needInfoNote is required.',
      });
    }
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        ...this.returns.applyState(
          (await this.prisma.returnRequest.findUnique({ where: { id } }))?.lifecycleState,
          ReturnLifecycleState.NEED_INFO,
        ),
        needInfoNote: note,
      },
      include: RETURN_INCLUDE,
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.need-info',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { approvalStatus: 'NEED_INFO', needInfoNote: note },
      },
    });
    await this.notifyDealerReturn(updated.customerId, 'RETURN_NEED_INFO', updated.number, updated.id);
    return this.enrichReturn(updated);
  }

  private async notifyDealerReturn(
    customerId: string,
    templateCode: string,
    number: string,
    returnId: string,
    extra: Record<string, string> = {},
  ) {
    if (this.opsNotify) {
      await this.opsNotify
        .onReturnCase({
          templateCode,
          id: returnId,
          number,
          customerId,
          delivery: extra.delivery,
          invoice: extra.invoice,
        })
        .catch(() => undefined);
      return;
    }
    await this.notifications
      .notifyCustomerUsers(customerId, {
        templateCode,
        vars: { number, delivery: extra.delivery, invoice: extra.invoice },
        linkUrl: `/returns/${returnId}`,
        eventId: `${templateCode}:${returnId}`,
        entityType: 'returnRequest',
        entityId: returnId,
      })
      .catch(() => undefined);
  }

}
