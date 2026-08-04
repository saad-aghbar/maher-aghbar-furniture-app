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
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryStatus, SalesOrderStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';
import { InvoicesService } from '../invoices/invoices.service';

const DELIVERY_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  PLANNED: [DeliveryStatus.READY, DeliveryStatus.CANCELLED, DeliveryStatus.FAILED],
  READY: [DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.CANCELLED, DeliveryStatus.FAILED, DeliveryStatus.RESCHEDULED],
  OUT_FOR_DELIVERY: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, DeliveryStatus.RESCHEDULED],
  DELIVERED: [],
  FAILED: [DeliveryStatus.PLANNED, DeliveryStatus.READY],
  RESCHEDULED: [DeliveryStatus.PLANNED, DeliveryStatus.READY, DeliveryStatus.CANCELLED],
  CANCELLED: [],
};

class CreateDeliveryDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  salesOrderId!: string;

  @IsString()
  deliveryAddress!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateDeliveryLocationDto {
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

class UpdateDeliveryStatusDto {
  @IsString()
  status!: DeliveryStatus;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  signatureData?: string;

  @IsOptional()
  @IsString()
  photoDocumentId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly invoices: InvoicesService,
  ) {}

  @Get()
  @RequirePermissions('delivery.read')
  async list(
    @Query() query: PaginationDto & { status?: string; q?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = {
      ...(user.customerId ? { customerId: user.customerId } : {}),
      ...(query.status ? { status: query.status as DeliveryStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { number: { contains: query.q, mode: 'insensitive' as const } },
              { customer: { name: { contains: query.q, mode: 'insensitive' as const } } },
              {
                salesOrder: {
                  number: { contains: query.q, mode: 'insensitive' as const },
                },
              },
              {
                salesOrder: {
                  externalOrderNumber: { contains: query.q, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, nameAr: true, nameEn: true, nameHe: true, code: true },
          },
          items: true,
          salesOrder: {
            select: { id: true, number: true, status: true, externalOrderNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('delivery.update')
  async create(@Body() dto: CreateDeliveryDto) {
    const so = await this.prisma.salesOrder.findFirst({
      where: { id: dto.salesOrderId, archivedAt: null },
      include: { lines: true },
    });
    if (!so) {
      throw new BadRequestException({ code: 'BAD_REQUEST', message: 'Sales order not found.' });
    }
    if (so.status !== SalesOrderStatus.READY_FOR_DELIVERY) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Sales order must be READY_FOR_DELIVERY before planning delivery.',
      });
    }
    if (so.customerId !== dto.customerId) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Customer does not match sales order.',
      });
    }

    const number = await this.sequences.next('DEL', 'DEL');

    // Prefer explicit coords; else copy from RFQ linked through quotation.
    let latitude = dto.latitude;
    let longitude = dto.longitude;
    if (latitude == null || longitude == null) {
      const soWithQuote = await this.prisma.salesOrder.findUnique({
        where: { id: dto.salesOrderId },
        include: {
          quotation: { include: { request: { select: { deliveryLat: true, deliveryLng: true } } } },
        },
      });
      const rfq = soWithQuote?.quotation?.request;
      if (rfq?.deliveryLat != null && rfq?.deliveryLng != null) {
        latitude = Number(rfq.deliveryLat);
        longitude = Number(rfq.deliveryLng);
      }
    }

    return this.prisma.delivery.create({
      data: {
        number,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId,
        deliveryAddress: dto.deliveryAddress,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        driverId: dto.driverId,
        notes: dto.notes,
        status: DeliveryStatus.PLANNED,
        items: {
          create: so.lines
            .filter((l) => l.deliveryRequired)
            .map((l) => ({
              description: l.description,
              quantity: l.quantity,
            })),
        },
      },
      include: { items: true, customer: true, salesOrder: true },
    });
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  get(@Param('id') id: string) {
    return this.prisma.delivery.findUniqueOrThrow({
      where: { id },
      include: {
        customer: {
          include: {
            addresses: {
              where: { archivedAt: null },
              take: 5,
              orderBy: { isDefaultDelivery: 'desc' },
            },
          },
        },
        items: true,
        driver: true,
        salesOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            externalOrderNumber: true,
            deliveryAddress: true,
            quotation: {
              select: {
                request: {
                  select: { deliveryLat: true, deliveryLng: true, deliveryAddress: true },
                },
              },
            },
          },
        },
      },
    });
  }

  @Patch(':id/location')
  @RequirePermissions('delivery.update')
  updateLocation(@Param('id') id: string, @Body() dto: UpdateDeliveryLocationDto) {
    return this.prisma.delivery.update({
      where: { id },
      data: {
        ...(dto.deliveryAddress != null ? { deliveryAddress: dto.deliveryAddress } : {}),
        ...(dto.latitude != null ? { latitude: dto.latitude } : {}),
        ...(dto.longitude != null ? { longitude: dto.longitude } : {}),
      },
    });
  }

  @Patch(':id/status')
  @RequirePermissions('delivery.update')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.delivery.findUniqueOrThrow({ where: { id } });
    const allowed = DELIVERY_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot transition delivery from ${existing.status} to ${dto.status}.`,
      });
    }
    if (dto.status === DeliveryStatus.DELIVERED && !dto.signatureData && !dto.recipientName) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'POD requires signature or recipient name.',
      });
    }

    const podNote = dto.photoDocumentId ? `POD photo document: ${dto.photoDocumentId}` : null;
    const driverId =
      dto.driverId ??
      (dto.status === DeliveryStatus.OUT_FOR_DELIVERY ? user.id : undefined);

    const delivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: {
          status: dto.status,
          recipientName: dto.recipientName,
          failureReason: dto.failureReason,
          signatureData: dto.signatureData,
          notes: (() => {
            if (dto.notes != null && dto.notes !== '') {
              return [existing.notes, dto.notes, podNote].filter(Boolean).join(' | ');
            }
            if (podNote) {
              return [existing.notes, podNote].filter(Boolean).join(' | ');
            }
            return undefined;
          })(),
          ...(driverId ? { driverId } : {}),
        },
      });

      if (dto.status === DeliveryStatus.DELIVERED && existing.salesOrderId) {
        await tx.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: SalesOrderStatus.DELIVERED },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          action: 'delivery.status',
          entityType: 'Delivery',
          entityId: id,
          newValues: {
            status: dto.status,
            hasSignature: Boolean(dto.signatureData),
            photoDocumentId: dto.photoDocumentId,
            driverId,
          },
        },
      });

      return updated;
    });

    if (dto.status === DeliveryStatus.DELIVERED && existing.salesOrderId) {
      await this.invoices.ensureFromSalesOrder(existing.salesOrderId, user.id).catch(() => {
        /* JoFotara/network failures must not block delivery confirmation */
      });
    }

    return delivery;
  }
}
