import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AuthUser } from '@maher/types';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListProductionOrdersDto, UpdateProductionOrderDto } from './dto/production.dto';
import { ProductionService } from './production.service';
import { ProductionInventoryService } from './production-inventory.service';
import { MaterialUsageService } from './material-usage.service';
import { OrderPlanSetupService } from './order-plan-setup.service';
import { STAGE_INVENTORY_BEHAVIORS } from '../../common/helpers/inventory-stage-behavior.util';

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

class PlanSetupBomLineDto {
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string | null;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  expectedQty!: number;

  @IsOptional()
  @IsIn(['CATALOG', 'FACTORY_MODIFIED', 'CUSTOM'])
  source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';

  @IsOptional()
  @IsBoolean()
  needsReview?: boolean;
}

class PlanSetupMaterialInputDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qtyPerUnit!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

class PlanSetupStageDto {
  @IsString()
  workflowNodeId!: string;

  @IsString()
  stageDefinitionId!: string;

  @IsIn([...STAGE_INVENTORY_BEHAVIORS])
  behavior!: (typeof STAGE_INVENTORY_BEHAVIORS)[number];

  @IsOptional()
  @IsBoolean()
  consumesRawMaterials?: boolean;

  @IsOptional()
  @IsBoolean()
  consumesSemiFinished?: boolean;

  @IsOptional()
  @IsString()
  outputNameEn?: string | null;

  @IsOptional()
  @IsString()
  outputNameAr?: string | null;

  @IsOptional()
  @IsString()
  outputNameHe?: string | null;

  @IsOptional()
  @IsNumber()
  outputQtyPerUnit?: number | null;

  @IsOptional()
  @IsNumber()
  expectedPieceCount?: number | null;

  @IsOptional()
  @IsArray()
  pieceLabels?: Array<{ nameEn: string; nameAr?: string | null; nameHe?: string | null }>;

  @IsOptional()
  @IsString()
  defaultWarehouseId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consumeOutputIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consumeWorkflowNodeIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanSetupMaterialInputDto)
  materialInputs?: PlanSetupMaterialInputDto[];
}

class PutPlanSetupDto {
  @IsOptional()
  @IsString()
  workflowId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanSetupBomLineDto)
  bomLines?: PlanSetupBomLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanSetupStageDto)
  stages?: PlanSetupStageDto[];
}

@ApiTags('production')
@Controller('production-orders')
export class ProductionController {
  constructor(
    private readonly production: ProductionService,
    private readonly productionInventory: ProductionInventoryService,
    private readonly materialUsage: MaterialUsageService,
    private readonly planSetup: OrderPlanSetupService,
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
    @Query('taskId') taskId?: string,
    @Query('plannedStart') plannedStart?: string,
    @Query('plannedCompletion') plannedCompletion?: string,
  ) {
    return this.production.listAssignableWorkers(q, stageDefinitionId, {
      taskId,
      plannedStart,
      plannedCompletion,
    });
  }

  @RequirePermissions('production-order.read')
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.production.getById(id, user);
  }

  @RequireAnyPermissions('production-order.read', 'production.setup.view')
  @Get(':id/plan-setup')
  getPlanSetup(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.planSetup.getPlanSetup(id, user);
  }

  @RequireAnyPermissions(
    'production-order.update',
    'production.setup.edit',
    'production-order.assign',
  )
  @Put(':id/plan-setup')
  putPlanSetup(
    @Param('id') id: string,
    @Body() dto: PutPlanSetupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.planSetup.putPlanSetup(id, dto, user);
  }

  @RequirePermissions('production-order.update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionOrderDto) {
    return this.production.update(id, dto);
  }

  @RequirePermissions('production-order.update')
  @Post(':id/ensure-plan-tasks')
  ensurePlanTasks(@Param('id') id: string) {
    return this.production.ensureExecutableTasks(id);
  }

  @RequirePermissions('production-order.update')
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.production.start(id, user.id);
  }

  @RequirePermissions('production-order.update')
  @Post(':id/return-to-preparing')
  returnToPreparing(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.production.returnToPreparing(id, user.id);
  }

  @RequirePermissions('production-order.read')
  @Get(':id/materials')
  listMaterials(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.customerId) {
      return { materials: [], transactions: [] };
    }
    return this.productionInventory.listMaterialActivity(id);
  }

  @RequirePermissions('production-order.read')
  @Get(':id/material-usage')
  async listMaterialUsage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.production.getById(id, user);
    if (user.customerId) {
      return { materials: [] };
    }
    return this.materialUsage.listOrderMaterialUsage(id);
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
