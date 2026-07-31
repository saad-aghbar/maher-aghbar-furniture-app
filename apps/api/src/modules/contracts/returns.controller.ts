import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReason, ReturnResolution } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { PaginationDto, paginatedMeta } from '../../common/dto/pagination.dto';
import { roundMoney } from '../../common/helpers/money.util';

class CreateReturnDto {
  @IsUUID()
  customerId!: string;

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
}

@ApiTags('returns')
@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  @Get()
  @RequirePermissions('sales-order.read')
  async list(@Query() query: PaginationDto) {
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.returnRequest.count(),
      this.prisma.returnRequest.findMany({
        include: { customer: true, salesOrder: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { data, meta: paginatedMeta(query.page, query.pageSize, totalItems) };
  }

  @Post()
  @RequirePermissions('sales-order.update')
  async create(@Body() dto: CreateReturnDto) {
    const number = await this.sequences.next('RET', 'RET');
    return this.prisma.returnRequest.create({
      data: {
        number,
        customerId: dto.customerId,
        salesOrderId: dto.salesOrderId,
        productDesc: dto.productDesc,
        quantity: roundMoney(dto.quantity),
        reason: dto.reason,
        description: dto.description,
        approvalStatus: 'PENDING',
      },
    });
  }

  @Patch(':id/resolve')
  @RequirePermissions('sales-order.update')
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: ReturnResolution; approvalStatus?: string },
  ) {
    return this.prisma.returnRequest.update({
      where: { id },
      data: {
        resolution: body.resolution,
        approvalStatus: body.approvalStatus ?? 'APPROVED',
      },
    });
  }
}
