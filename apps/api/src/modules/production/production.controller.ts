import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
import { ProductionService } from './production.service';

@ApiTags('production')
@Controller('production-orders')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @RequirePermissions('production-order.read')
  @Get()
  list(@Query() query: ListProductionOrdersDto, @CurrentUser() user: AuthUser) {
    return this.production.list(query, user);
  }

  @RequirePermissions('production-order.assign')
  @Get('assignable-workers')
  listAssignableWorkers(@Query('q') q?: string) {
    return this.production.listAssignableWorkers(q);
  }

  @RequirePermissions('production-order.read')
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.production.getById(id, user);
  }

  @RequirePermissions('production-order.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionOrderDto) {
    return this.production.update(id, dto);
  }

  @RequirePermissions('production-order.update')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.production.start(id);
  }
}
