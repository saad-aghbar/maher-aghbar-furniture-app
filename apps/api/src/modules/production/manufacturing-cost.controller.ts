import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ManufacturingCostService } from './manufacturing-cost.service';

@ApiTags('manufacturing-cost')
@Controller()
export class ManufacturingCostController {
  constructor(private readonly manufacturingCost: ManufacturingCostService) {}

  @RequirePermissions('inventory.cost.read')
  @Get('production-orders/:id/manufacturing-cost')
  forProductionOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.manufacturingCost.forProductionOrder(id, user);
  }

  @RequirePermissions('inventory.cost.read')
  @Get('sales-orders/:id/manufacturing-cost')
  forSalesOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.manufacturingCost.forSalesOrder(id, user);
  }
}
