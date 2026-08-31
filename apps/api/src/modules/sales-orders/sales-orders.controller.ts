import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListSalesOrdersDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';

class ReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class CancelSalesOrderDto {
  @IsString()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class ConfirmCommercialLineDto {
  @IsUUID()
  lineId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class ConfirmCommercialPricesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmCommercialLineDto)
  lines!: ConfirmCommercialLineDto[];
}

@ApiTags('sales-orders')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersService) {}

  @RequirePermissions('sales-order.read')
  @Get()
  list(@Query() query: ListSalesOrdersDto, @CurrentUser() user: AuthUser) {
    return this.salesOrders.list(query, user);
  }

  @RequirePermissions('sales-order.read')
  @Get(':id/cancel-impact')
  cancelImpact(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrders.getCancelImpact(id, user);
  }

  @RequirePermissions('sales-order.read')
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrders.getById(id, user);
  }

  @RequirePermissions('sales-order.update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrders.update(id, dto, user);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/confirm-commercial-prices')
  confirmCommercialPrices(
    @Param('id') id: string,
    @Body() dto: ConfirmCommercialPricesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrders.confirmCommercialPrices(id, dto.lines, user);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/committed-delivery')
  setCommittedDelivery(
    @Param('id') id: string,
    @Body() body: { date: string; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrders.setCommittedDeliveryDate(id, user, body.date, body.reason);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrders.confirm(id, user.id);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/hold')
  hold(@Param('id') id: string, @Body() body: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.salesOrders.hold(id, user.id, body.reason);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: CancelSalesOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesOrders.cancel(id, user.id, {
      reasonCode: body.reasonCode,
      reason: body.reason,
    });
  }
}
