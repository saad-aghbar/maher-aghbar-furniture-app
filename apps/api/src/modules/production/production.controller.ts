import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
import { ProductionService } from './production.service';
import { ProductionInventoryService } from './production-inventory.service';

class ReturnUnusedMaterialDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

@ApiTags('production')
@Controller('production-orders')
export class ProductionController {
  constructor(
    private readonly production: ProductionService,
    private readonly productionInventory: ProductionInventoryService,
  ) {}

  @RequirePermissions('production-order.read')
  @Get()
  list(@Query() query: ListProductionOrdersDto, @CurrentUser() user: AuthUser) {
    return this.production.list(query, user);
  }

  @RequireAnyPermissions(
    'production-order.assign',
    'production.workflow.manage',
    'production.workflow.stage.manage',
  )
  @Get('assignable-workers')
  listAssignableWorkers(
    @Query('q') q?: string,
    @Query('stageDefinitionId') stageDefinitionId?: string,
  ) {
    return this.production.listAssignableWorkers(q, stageDefinitionId);
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

  @RequirePermissions('production-order.read')
  @Get(':id/materials')
  listMaterials(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.customerId) {
      return { materials: [], transactions: [] };
    }
    return this.productionInventory.listMaterialActivity(id);
  }

  @RequireAnyPermissions('production-order.update', 'inventory.receive')
  @Post(':id/materials/return')
  returnUnused(
    @Param('id') id: string,
    @Body() dto: ReturnUnusedMaterialDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productionInventory.returnUnusedMaterial({
      productionOrderId: id,
      inventoryItemId: dto.inventoryItemId,
      quantity: dto.quantity,
      warehouseId: dto.warehouseId,
      userId: user.id,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
