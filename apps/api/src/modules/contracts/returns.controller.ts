import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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

  @IsOptional()
  @IsString()
  reasonPhotoKey?: string;

  @IsOptional()
  @IsString()
  issuePhotoKey?: string;
}

class ResolveReturnDto {
  @IsIn(['APPROVED', 'REJECTED'])
  approvalStatus!: 'APPROVED' | 'REJECTED';
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
    return {
      ...rest,
      reasonPhotoKey,
      issuePhotoKey,
      reasonPhotoUrl: this.photoUrl(reasonPhotoKey),
      issuePhotoUrl: this.photoUrl(issuePhotoKey),
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
    const created = await this.prisma.returnRequest.create({
      data: {
        number,
        customerId,
        salesOrderId: dto.salesOrderId,
        productDesc: dto.productDesc,
        quantity: roundMoney(dto.quantity),
        reason: dto.reason,
        description: dto.description,
        reasonPhotoKey: dto.reasonPhotoKey?.trim() || null,
        issuePhotoKey: dto.issuePhotoKey?.trim() || null,
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

  @Patch(':id/resolve')
  @RequirePermissions('sales-order.update')
  resolve(@Param('id') id: string, @Body() body: ResolveReturnDto) {
    const resolution =
      body.approvalStatus === 'APPROVED'
        ? ReturnResolution.REPLACEMENT
        : ReturnResolution.REJECTED;
    return this.prisma.returnRequest.update({
      where: { id },
      data: {
        resolution,
        approvalStatus: body.approvalStatus,
      },
    });
  }
}
