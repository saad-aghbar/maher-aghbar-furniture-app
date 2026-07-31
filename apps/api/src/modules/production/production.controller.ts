import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { ListProductionOrdersDto } from './dto/production.dto';
import { ProductionService } from './production.service';

@ApiTags('production')
@Controller('production-orders')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @RequirePermissions('production-order.read')
  @Get()
  list(@Query() query: ListProductionOrdersDto) {
    return this.production.list(query);
  }

  @RequirePermissions('production-order.read')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.production.getById(id);
  }

  @RequirePermissions('production-order.update')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.production.start(id);
  }
}
