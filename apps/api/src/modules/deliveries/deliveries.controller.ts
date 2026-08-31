import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryStatus, Prisma, SalesOrderStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta, pageSkipTake } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { StagePipelineService } from '../production/stage-pipeline.service';
import { assertCustomerOwns } from '../../common/helpers/customer-scope';
import { DeliveryLoadService } from './delivery-load.service';

const DELIVERY_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  PLANNED: [DeliveryStatus.READY, DeliveryStatus.CANCELLED, DeliveryStatus.FAILED],
  READY: [
    DeliveryStatus.OUT_FOR_DELIVERY,
    DeliveryStatus.CANCELLED,
    DeliveryStatus.FAILED,
    DeliveryStatus.RESCHEDULED,
  ],
  // Staff may ship / fail / reschedule. Commercial DELIVERED is dealer confirm-receipt only.
  OUT_FOR_DELIVERY: [DeliveryStatus.FAILED, DeliveryStatus.RESCHEDULED],
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

function parseBool(value: unknown): boolean {
  if (value === true || value === 'true' || value === '1') return true;
  return false;
}

type AttentionReason = 'OVERDUE_PLANNED' | 'INCOMPLETE_LOAD';

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function attentionReasonsFor(row: {
  status: DeliveryStatus | string;
  deliveryDate?: Date | null;
  loadPieces?: Array<{ loadedAt: Date | null }>;
}): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  const open = row.status === DeliveryStatus.PLANNED || row.status === DeliveryStatus.READY;
  if (!open) return reasons;
  if (row.deliveryDate && row.deliveryDate < startOfUtcDay()) {
    reasons.push('OVERDUE_PLANNED');
  }
  const pieces = row.loadPieces ?? [];
  if (pieces.length > 0 && pieces.some((p) => !p.loadedAt)) {
    reasons.push('INCOMPLETE_LOAD');
  }
  return reasons;
}

function mapDeliveryListRow<
  T extends {
    status: DeliveryStatus | string;
    deliveryDate?: Date | null;
    loadPieces?: Array<{ loadedAt: Date | null }>;
  },
>(row: T) {
  const { loadPieces, ...rest } = row;
  const pieces = loadPieces ?? [];
  const loaded = pieces.filter((p) => p.loadedAt).length;
  return {
    ...rest,
    load: pieces.length
      ? { total: pieces.length, loaded, incomplete: loaded < pieces.length }
      : null,
    attentionReasons: attentionReasonsFor(row),
  };
}

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
    private readonly inventory: InventoryService,
    private readonly pipeline: StagePipelineService,
    private readonly loadSheet: DeliveryLoadService,
  ) {}

  @Get()
  @RequirePermissions('delivery.read')
  async list(
    @Query()
    query: PaginationDto & {
      status?: string;
      q?: string;
      mine?: string | boolean;
      attention?: string | boolean;
      scope?: 'open' | 'completed' | 'all';
    },
    @CurrentUser() user: AuthUser,
  ) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const wantMine = parseBool(query.mine) || this.loadSheet.isDriverScoped(user);
    const wantAttention = parseBool(query.attention);

    if (wantMine && !user.customerId) {
      return this.loadSheet.listMine(user, {
        page,
        pageSize,
        skip,
        take,
        scope: query.scope,
        status: query.status,
        q: query.q,
      });
    }

    const today = startOfUtcDay();
    const attentionClause = wantAttention
      ? {
          OR: [
            {
              status: { in: [DeliveryStatus.PLANNED, DeliveryStatus.READY] },
              deliveryDate: { lt: today },
            },
            {
              status: { in: [DeliveryStatus.PLANNED, DeliveryStatus.READY] },
              loadPieces: { some: { loadedAt: null } },
            },
          ],
        }
      : null;

    const qClause = query.q
      ? {
          OR: [
            { number: { contains: query.q, mode: 'insensitive' as const } },
            { customer: { name: { contains: query.q, mode: 'insensitive' as const } } },
            { customer: { nameEn: { contains: query.q, mode: 'insensitive' as const } } },
            { customer: { nameAr: { contains: query.q, mode: 'insensitive' as const } } },
            { customer: { nameHe: { contains: query.q, mode: 'insensitive' as const } } },
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
            {
              salesOrder: {
                projectName: { contains: query.q, mode: 'insensitive' as const },
              },
            },
            {
              salesOrder: {
                productionOrders: {
                  some: { number: { contains: query.q, mode: 'insensitive' as const } },
                },
              },
            },
            {
              salesOrder: {
                lines: {
                  some: {
                    OR: [
                      { description: { contains: query.q, mode: 'insensitive' as const } },
                      {
                        product: {
                          OR: [
                            { nameEn: { contains: query.q, mode: 'insensitive' as const } },
                            { nameAr: { contains: query.q, mode: 'insensitive' as const } },
                            { nameHe: { contains: query.q, mode: 'insensitive' as const } },
                            { sku: { contains: query.q, mode: 'insensitive' as const } },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          ],
        }
      : null;

    const andClauses: Prisma.DeliveryWhereInput[] = [];
    if (attentionClause) andClauses.push(attentionClause);
    if (qClause) andClauses.push(qClause);

    const where: Prisma.DeliveryWhereInput = {
      ...(user.customerId ? { customerId: user.customerId } : {}),
      ...(query.status && !wantAttention ? { status: query.status as DeliveryStatus } : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
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
          loadPieces: { select: { loadedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return {
      data: data.map((row) => mapDeliveryListRow(row)),
      meta: paginatedMeta(page, pageSize, totalItems),
    };
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

  @Get(':id/load-sheet')
  @RequirePermissions('delivery.read')
  getLoadSheet(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loadSheet.getLoadSheet(id, user);
  }

  @Post(':id/load-pieces/:pieceId/check')
  @RequirePermissions('delivery.update')
  checkPiece(
    @Param('id') id: string,
    @Param('pieceId') pieceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.loadSheet.setPieceLoaded(id, pieceId, user, true);
  }

  @Post(':id/load-pieces/:pieceId/uncheck')
  @RequirePermissions('delivery.update')
  uncheckPiece(
    @Param('id') id: string,
    @Param('pieceId') pieceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.loadSheet.setPieceLoaded(id, pieceId, user, false);
  }

  @Post(':id/depart')
  @RequirePermissions('delivery.update')
  depart(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loadSheet.depart(id, user);
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const delivery = await this.prisma.delivery.findUnique({
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
    if (!delivery || !assertCustomerOwns(user, delivery.customerId)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    }
    if (user.customerId) {
      const { driver: _driver, ...rest } = delivery;
      return rest;
    }
    if (this.loadSheet.isDriverScoped(user) && delivery.driverId !== user.id) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    }
    return delivery;
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
    if (dto.status === DeliveryStatus.DELIVERED) {
      throw new BadRequestException({
        code: 'DELIVERY_DEALER_CONFIRM_REQUIRED',
        message:
          'Staff cannot mark delivered. Owning dealer must confirm receipt via confirm-receipt.',
      });
    }
    const allowed = DELIVERY_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Cannot transition delivery from ${existing.status} to ${dto.status}.`,
      });
    }

    // Piece 10: truck departure always goes through depart() so incomplete
    // package checklists cannot casually bypass DELIVERY_ISSUE timing.
    if (dto.status === DeliveryStatus.OUT_FOR_DELIVERY) {
      return this.loadSheet.depart(id, user);
    }

    const podNote = dto.photoDocumentId ? `POD photo document: ${dto.photoDocumentId}` : null;
    const driverId = dto.driverId;

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

      if (
        (dto.status === DeliveryStatus.FAILED || dto.status === DeliveryStatus.CANCELLED) &&
        existing.status === DeliveryStatus.OUT_FOR_DELIVERY
      ) {
        await this.inventory.restoreForDelivery(id, existing.salesOrderId, user.id, tx);
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

    // Depart (OUT_FOR_DELIVERY) returns early above — rollup/notify live in DeliveryLoadService.

    return delivery;
  }

  /**
   * Dealer receipt confirmation — sole commercial close for customer deliveries.
   * No inventory movement (FIN already issued on OUT_FOR_DELIVERY).
   */
  @Post(':id/confirm-receipt')
  @RequirePermissions('delivery.confirm-own-receipt')
  async confirmReceipt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.delivery.findUnique({ where: { id } });
    // Staff must never impersonate dealer receipt — ownership is required.
    if (!existing || !user.customerId || existing.customerId !== user.customerId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Delivery not found.' });
    }

    if (existing.status === DeliveryStatus.DELIVERED) {
      // Idempotent for same owner
      if (existing.customerConfirmedById === user.id || existing.customerConfirmedAt) {
        return existing;
      }
      throw new BadRequestException({
        code: 'DELIVERY_ALREADY_DELIVERED',
        message: 'Delivery is already marked delivered.',
      });
    }

    if (existing.status !== DeliveryStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException({
        code: 'DELIVERY_NOT_OUT_FOR_DELIVERY',
        message: 'Only out-for-delivery shipments can be confirmed received.',
      });
    }

    const now = new Date();
    const delivery = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.DELIVERED,
          customerConfirmedAt: now,
          customerConfirmedById: user.id,
          actualDeliveredAt: now,
        },
      });

      if (existing.salesOrderId) {
        await tx.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: SalesOrderStatus.DELIVERED },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          action: 'delivery.confirm-receipt',
          entityType: 'Delivery',
          entityId: id,
          newValues: {
            status: DeliveryStatus.DELIVERED,
            customerConfirmedAt: now.toISOString(),
            actualDeliveredAt: now.toISOString(),
          },
        },
      });

      return updated;
    });

    if (existing.salesOrderId) {
      const productionOrders = await this.prisma.productionOrder.findMany({
        where: { salesOrderId: existing.salesOrderId, archivedAt: null },
        select: { id: true },
      });
      for (const po of productionOrders) {
        await this.pipeline.rollupProgress(po.id).catch(() => undefined);
      }
      // Invoice should already exist from depart (ship). Idempotent safety net only.
      await this.invoices.ensureFromSalesOrder(existing.salesOrderId, user.id).catch(() => {
        /* must not block dealer confirmation */
      });
    }

    await this.notifications
      .notifyCustomerUsers(existing.customerId, {
        templateCode: 'DELIVERY_COMPLETED',
        vars: {
          orderNumber: delivery.number,
          number: delivery.number,
          date: now.toISOString().slice(0, 10),
        },
        linkUrl: `/sales-orders/${existing.salesOrderId ?? ''}`,
      })
      .catch(() => undefined);

    await this.notifications
      .notifyAdminUsers({
        templateCode: 'DELIVERY_COMPLETED',
        vars: {
          orderNumber: delivery.number,
          number: delivery.number,
          date: now.toISOString().slice(0, 10),
        },
        linkUrl: `/deliveries/${id}`,
      })
      .catch(() => undefined);

    return delivery;
  }
}
