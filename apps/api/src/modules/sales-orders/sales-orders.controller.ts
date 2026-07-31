import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListSalesOrdersDto } from './dto/sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';

@ApiTags('sales-orders')
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersService) {}

  @RequirePermissions('sales-order.read')
  @Get()
  list(@Query() query: ListSalesOrdersDto) {
    return this.salesOrders.list(query);
  }

  @RequirePermissions('sales-order.read')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.salesOrders.getById(id);
  }

  @RequirePermissions('sales-order.update')
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesOrders.confirm(id, user.id);
  }
}
