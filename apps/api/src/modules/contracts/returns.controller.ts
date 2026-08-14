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

class CreateReturnDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

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
  @IsIn(['APPROVED', 'REJECTED'])
  approvalStatus!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsIn(['RETURN_TO_STOCK', 'REWORK', 'DAMAGED', 'SCRAP'])
  inventoryFate?: 'RETURN_TO_STOCK' | 'REWORK' | 'DAMAGED' | 'SCRAP';

  @IsOptional()
  @IsUUID()
  reentryStageInstanceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
        include: {
          customer: true,
          salesOrder: {
            include: {
              lines: {
                orderBy: { sortOrder: 'asc' },
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
        },
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

    const number = await this.sequences.next('RET', 'RET');
    const reasonPacked = packPhotoKeys([
      ...(dto.reasonPhotoKeys ?? []),
      dto.reasonPhotoKey,
    ]);
    const issuePacked = packPhotoKeys([
      ...(dto.issuePhotoKeys ?? []),
      dto.issuePhotoKey,
    ]);
    const created = await this.prisma.returnRequest.create({
      data: {
        number,
        customerId,
        salesOrderId: dto.salesOrderId,
        productDesc: dto.productDesc,
        quantity: roundMoney(dto.quantity),
        reason: dto.reason,
        description: dto.description,
        reasonPhotoKey: reasonPacked,
        issuePhotoKey: issuePacked,
        approvalStatus: 'PENDING',
      },
      include: {
        customer: true,
        salesOrder: {
          include: {
            lines: {
              orderBy: { sortOrder: 'asc' },
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
      },
    });
    return this.enrichReturn(created);
  }

  @Get(':id')
  @RequirePermissions('sales-order.read')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id, ...customerScopeFilter(user) },
      include: {
        customer: true,
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

  @Patch(':id/resolve')
  @RequirePermissions('sales-order.update')
  async resolve(
    @Param('id') id: string,
    @Body() body: ResolveReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    const resolution =
      body.approvalStatus === 'APPROVED'
        ? ReturnResolution.REPLACEMENT
        : ReturnResolution.REJECTED;
    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        resolution,
        approvalStatus: body.approvalStatus,
        inventoryFate: body.approvalStatus === 'APPROVED' ? 'PENDING' : undefined,
      },
    });
    if (body.approvalStatus === 'APPROVED') {
      await this.inventory.quarantineReturn(
        updated.id,
        updated.salesOrderId,
        Number(updated.quantity),
        user.id,
      );
      if (body.inventoryFate) {
        await this.applyReturnFate(updated.id, body.inventoryFate, user.id, {
          stageInstanceId: body.reentryStageInstanceId,
          notes: body.notes,
        });
      }
    }
    await this.notifications
      .notifyCustomerUsers(updated.customerId, {
        templateCode:
          body.approvalStatus === 'APPROVED' ? 'RETURN_APPROVED' : 'RETURN_REJECTED',
        vars: { number: updated.number },
        linkUrl: `/returns/${updated.id}`,
      })
      .catch(() => undefined);
    return updated;
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
    await this.applyReturnFate(id, body.inventoryFate, user.id, {
      stageInstanceId: body.reentryStageInstanceId,
      notes: body.notes,
    });
    const row = await this.prisma.returnRequest.findUniqueOrThrow({ where: { id } });
    return row;
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
