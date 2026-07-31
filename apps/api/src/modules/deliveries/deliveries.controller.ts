import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryStatus } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';

class CreateDeliveryDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @IsString()
  deliveryAddress!: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
}

@ApiTags('deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get()
  @RequirePermissions('delivery.read')
  async list(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.delivery.count(),
      this.prisma.delivery.findMany({
        include: { customer: true, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('delivery.update')
  async create(@Body() dto: CreateDeliveryDto) {
    const number = await this.sequences.next('DEL', 'DEL');
    return this.prisma.delivery.create({
      data: {
        number,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId,
        deliveryAddress: dto.deliveryAddress,
        notes: dto.notes,
        status: DeliveryStatus.PLANNED,
      },
    });
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  get(@Param('id') id: string) {
    return this.prisma.delivery.findUniqueOrThrow({
      where: { id },
      include: { customer: true, items: true, driver: true },
    });
  }

  @Patch(':id/status')
  @RequirePermissions('delivery.update')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    const delivery = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: dto.status,
        recipientName: dto.recipientName,
        failureReason: dto.failureReason,
        driverId: dto.status === DeliveryStatus.OUT_FOR_DELIVERY ? user.id : undefined,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'delivery.status',
        entityType: 'Delivery',
        entityId: id,
        newValues: { status: dto.status },
      },
    });
    return delivery;
  }
}
