import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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
  cancel(@Param('id') id: string, @Body() body: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.salesOrders.cancel(id, user.id, body.reason);
  }
}
