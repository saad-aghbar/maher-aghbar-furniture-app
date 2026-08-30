import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
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
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { customerScopeFilter } from '../../common/helpers/customer-scope';
import { roundMoney } from '../../common/helpers/money.util';
import { LocalStorageService } from '../../integrations/storage/local-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionReworkService } from '../production/production-rework.service';

/** Pack one or many storage keys into the existing String column (JSON array when >1). */
function packPhotoKeys(keys: Array<string | null | undefined>): string | null {
  const clean = keys
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean);
  if (!clean.length) return null;
  if (clean.length === 1) return clean[0]!;
  return JSON.stringify(clean);
}

/** Unpack legacy single key or JSON array of keys. */
function unpackPhotoKeys(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
          .map((s) => s.trim());
      }
    } catch {
      /* fall through — treat as literal key */
    }
  }
  return [trimmed];
}

const RETURN_INCLUDE = {
  customer: true,
  delivery: { select: { id: true, number: true, status: true } },
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

  /** Optional link to the outbound delivery this return refers to. */
  @IsOptional()
  @IsUUID()
  deliveryId?: string;

  @IsString()
  productDesc!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

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
}

class ResolveReturnDto {
  @IsIn(['APPROVED', 'REJECTED', 'NEED_INFO'])
  approvalStatus!: 'APPROVED' | 'REJECTED' | 'NEED_INFO';

  /** On APPROVED: REPAIR or REPLACEMENT (default REPLACEMENT). Not applied as stock. */
  @IsOptional()
  @IsIn(['REPAIR', 'REPLACEMENT', 'CREDIT_NOTE', 'REFUND'])
  resolution?: 'REPAIR' | 'REPLACEMENT' | 'CREDIT_NOTE' | 'REFUND';

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
    private readonly inventory: InventoryService,
    private readonly rework: ProductionReworkService,
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
  }>(row: T) {
    const firstLine = row.salesOrder?.lines?.[0];
    const product = firstLine?.product;
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
    return {
      ...rest,
      reasonPhotoKey,
      issuePhotoKey,
      reasonPhotoUrl: reasonPhotoUrls[0] ?? null,
      issuePhotoUrl: issuePhotoUrls[0] ?? null,
      reasonPhotoUrls,
      issuePhotoUrls,
      productImageUrl,
      productId: product?.id ?? null,
    };
  }

  @Get()
  @RequirePermissions('sales-order.read')
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
  @RequirePermissions('sales-order.read')
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
        deliveryId: dto.deliveryId,
        productDesc: dto.productDesc,
        quantity: roundMoney(dto.quantity),
        reason: dto.reason,
        description: dto.description,
        reasonPhotoKey: reasonPacked,
        issuePhotoKey: issuePacked,
        approvalStatus: 'PENDING',
        physicalStatus: 'NONE',
        inventoryFate: 'PENDING',
      },
      include: RETURN_INCLUDE,
    });
    return this.enrichReturn(created);
  }

  @Get(':id')
  @RequirePermissions('sales-order.read')
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
    return this.enrichReturn(row);
  }

  /**
   * Admin review: APPROVED / REJECTED / NEED_INFO.
   * APPROVED sets WAITING_RETURN — does NOT quarantine stock (receive does).
   */
  @Patch(':id/resolve')
  @RequirePermissions('sales-order.update')
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
          approvalStatus: 'REJECTED',
          resolution: ReturnResolution.REJECTED,
          physicalStatus: existing.physicalStatus === 'NONE' ? 'NONE' : existing.physicalStatus,
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
      await this.notifications
        .notifyCustomerUsers(updated.customerId, {
          templateCode: 'RETURN_REJECTED',
          vars: { number: updated.number },
          linkUrl: `/returns/${updated.id}`,
        })
        .catch(() => undefined);
      return this.enrichReturn(updated);
    }

    // APPROVED — no quarantine; wait for physical receive.
    const resolution =
      body.resolution === 'REPAIR'
        ? ReturnResolution.REPAIR
        : body.resolution === 'CREDIT_NOTE'
          ? ReturnResolution.CREDIT_NOTE
          : body.resolution === 'REFUND'
            ? ReturnResolution.REFUND
            : body.resolution === 'REPLACEMENT'
              ? ReturnResolution.REPLACEMENT
              : ReturnResolution.REPLACEMENT;

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        resolution,
        physicalStatus: 'WAITING_RETURN',
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
    await this.notifications
      .notifyCustomerUsers(updated.customerId, {
        templateCode: 'RETURN_APPROVED',
        vars: { number: updated.number },
        linkUrl: `/returns/${updated.id}`,
      })
      .catch(() => undefined);
    return this.enrichReturn(updated);
  }

  @Patch(':id/need-info')
  @RequirePermissions('sales-order.update')
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
  @RequirePermissions('sales-order.update')
  async receive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }

    if (existing.receivedAt || existing.physicalStatus === 'RETURNED') {
      const row = await this.prisma.returnRequest.findUniqueOrThrow({
        where: { id },
        include: RETURN_INCLUDE,
      });
      return this.enrichReturn(row);
    }

    if (existing.approvalStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before physical receive.',
      });
    }

    try {
      await this.inventory.quarantineReturn(
        existing.id,
        existing.salesOrderId,
        Number(existing.quantity),
        user.id,
      );
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw err;
    }

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        receivedAt: new Date(),
        receivedById: user.id,
        physicalStatus: 'RETURNED',
      },
      include: RETURN_INCLUDE,
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.receive',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          physicalStatus: 'RETURNED',
          receivedAt: updated.receivedAt?.toISOString() ?? null,
        },
      },
    });
    await this.notifications
      .notifyCustomerUsers(updated.customerId, {
        templateCode: 'RETURN_RECEIVED',
        vars: { number: updated.number },
        linkUrl: `/returns/${updated.id}`,
      })
      .catch(() => undefined);
    return this.enrichReturn(updated);
  }

  @Patch(':id/inventory-fate')
  @RequirePermissions('sales-order.update')
  async setInventoryFate(
    @Param('id') id: string,
    @Body()
    body: {
      inventoryFate: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP';
      reentryStageInstanceId?: string;
      notes?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    if (!['RETURN_TO_STOCK', 'REWORK', 'DAMAGED', 'SCRAP'].includes(body.inventoryFate)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid inventory fate.',
      });
    }
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }
    if (!existing.receivedAt && existing.physicalStatus !== 'RETURNED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_RECEIVED',
        message: 'Inspect / fate only after physical receive.',
      });
    }
    await this.applyReturnFate(id, body.inventoryFate, user.id, {
      stageInstanceId: body.reentryStageInstanceId,
      notes: body.notes,
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.fate',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: { inventoryFate: body.inventoryFate },
      },
    });
    const row = await this.prisma.returnRequest.findUniqueOrThrow({
      where: { id },
      include: RETURN_INCLUDE,
    });
    return this.enrichReturn(row);
  }

  /**
   * Create a new ProductionOrder for REPLACEMENT — never mutates the original PO.
   * Requires approved + received return with resolution REPLACEMENT (sets if missing).
   */
  @Post(':id/create-replacement')
  @RequirePermissions('sales-order.update')
  async createReplacement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: {
            lines: { orderBy: { sortOrder: 'asc' }, take: 1 },
            productionOrders: {
              where: {
                OR: [
                  { notes: { contains: `REPLACEMENT — ${id}` } },
                  { productDescription: { contains: 'REPLACEMENT —' } },
                ],
              },
              take: 5,
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Return not found.' });
    }
    if (row.approvalStatus !== 'APPROVED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_APPROVED',
        message: 'Return must be approved before creating a replacement PO.',
      });
    }
    if (!row.receivedAt && row.physicalStatus !== 'RETURNED') {
      throw new BadRequestException({
        code: 'RETURN_NOT_RECEIVED',
        message: 'Receive the return before creating a replacement production order.',
      });
    }
    if (!row.salesOrderId || !row.salesOrder) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Return has no sales order to attach a replacement PO.',
      });
    }

    const label = `REPLACEMENT — ${row.number}`;
    const existingPo = await this.prisma.productionOrder.findFirst({
      where: {
        salesOrderId: row.salesOrderId,
        OR: [
          { notes: { contains: label } },
          { productDescription: { contains: label } },
          { notes: { contains: `REPLACEMENT — ${id}` } },
        ],
      },
    });
    if (existingPo) {
      return { productionOrder: existingPo, created: false };
    }

    if (row.resolution !== ReturnResolution.REPLACEMENT) {
      await this.prisma.returnRequest.update({
        where: { id },
        data: { resolution: ReturnResolution.REPLACEMENT },
      });
    }

    const line = row.salesOrder.lines[0];
    const poNumber = await this.sequences.next('PO', 'PO');
    const productionOrder = await this.prisma.productionOrder.create({
      data: {
        number: poNumber,
        salesOrderId: row.salesOrderId,
        salesOrderLineId: line?.id,
        customerId: row.customerId,
        productId: line?.productId ?? undefined,
        productDescription: `${label} — ${row.productDesc}`,
        quantity: row.quantity,
        status: 'PLANNED',
        createdById: user.id,
        notes: `${label}; returnId=${id}; original return ${row.number}`,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'return.replacement-po',
        entityType: 'ReturnRequest',
        entityId: id,
        newValues: {
          productionOrderId: productionOrder.id,
          productionOrderNumber: productionOrder.number,
        },
      },
    });
    return { productionOrder, created: true };
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
        approvalStatus: 'NEED_INFO',
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
    await this.notifications
      .notifyCustomerUsers(updated.customerId, {
        templateCode: 'RETURN_NEED_INFO',
        vars: { number: updated.number, note },
        linkUrl: `/returns/${updated.id}`,
      })
      .catch(() => undefined);
    return this.enrichReturn(updated);
  }

  private async applyReturnFate(
    returnId: string,
    fate: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP',
    userId: string,
    opts?: { stageInstanceId?: string; notes?: string },
  ) {
    await this.inventory.resolveReturnFate(returnId, fate, userId);
    if (fate !== 'REWORK') return;
    const row = await this.prisma.returnRequest.findUniqueOrThrow({ where: { id: returnId } });
    const created = await this.rework.createForReturn({
      returnId,
      salesOrderId: row.salesOrderId,
      description: opts?.notes || `Customer return ${row.number}`,
      userId,
    });
    if (opts?.stageInstanceId) {
      await this.rework.startRework({
        reworkId: created.id,
        stageInstanceId: opts.stageInstanceId,
        notes: opts.notes,
        userId,
      });
    }
  }
}
