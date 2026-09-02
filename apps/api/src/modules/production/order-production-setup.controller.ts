import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@maher/types';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  PatchLineSetupDto,
  PutLineMaterialsDto,
} from './order-production-setup.dto';
import { OrderProductionSetupService } from './order-production-setup.service';

@ApiTags('production-setup')
@Controller('sales-orders/:salesOrderId/production-setup')
export class OrderProductionSetupController {
  constructor(private readonly setups: OrderProductionSetupService) {}

  @RequirePermissions('production.setup.view')
  @Get()
  get(@Param('salesOrderId') salesOrderId: string, @CurrentUser() user: AuthUser) {
    return this.setups.ensureSetup(salesOrderId, user);
  }

  @RequirePermissions('production.setup.view')
  @Get('release-preview')
  releasePreview(
    @Param('salesOrderId') salesOrderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.setups.releasePreview(salesOrderId, user);
  }

  @RequirePermissions('production.setup.edit')
  @Patch('lines/:lineId')
  patchLine(
    @Param('salesOrderId') salesOrderId: string,
    @Param('lineId') lineId: string,
    @Body() dto: PatchLineSetupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.setups.patchLine(salesOrderId, lineId, dto, user);
  }

  @RequirePermissions('production.setup.edit')
  @Put('lines/:lineId/materials')
  putMaterials(
    @Param('salesOrderId') salesOrderId: string,
    @Param('lineId') lineId: string,
    @Body() dto: PutLineMaterialsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.setups.putMaterials(salesOrderId, lineId, dto, user);
  }

  @RequirePermissions('production.setup.edit')
  @Post('lines/:lineId/seed-from-catalog')
  seedFromCatalog(
    @Param('salesOrderId') salesOrderId: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.setups.seedFromCatalog(salesOrderId, lineId, user);
  }

  @RequirePermissions('production.setup.edit')
  @Post('ensure-plan')
  ensurePlan(
    @Param('salesOrderId') salesOrderId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.setups.ensurePlanOrders(salesOrderId, user);
  }

  @RequirePermissions('production.setup.edit')
  @Post('mark-ready')
  markReady(@Param('salesOrderId') salesOrderId: string, @CurrentUser() user: AuthUser) {
    return this.setups.markReady(salesOrderId, user);
  }

  @RequirePermissions('production.setup.release')
  @Post('release')
  release(@Param('salesOrderId') salesOrderId: string, @CurrentUser() user: AuthUser) {
    return this.setups.release(salesOrderId, user);
  }
}
