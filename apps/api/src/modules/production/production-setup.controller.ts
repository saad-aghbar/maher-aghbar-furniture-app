import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { ProductionSetupService } from './production-setup.service';
import { STAGE_INVENTORY_BEHAVIORS } from '../../common/helpers/inventory-stage-behavior.util';

class ProductionSetupStageDto {
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
  @IsString()
  unit?: string | null;

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
}

class ProductionSetupPutDto {
  @IsOptional()
  @IsString()
  workflowId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionSetupStageDto)
  stages?: ProductionSetupStageDto[];
}

@ApiTags('production-setup')
@Controller('products')
export class ProductionSetupController {
  constructor(private readonly setup: ProductionSetupService) {}

  @Get(':productId/production-setup')
  @RequirePermissions('catalog.manage')
  getSetup(@Param('productId') productId: string) {
    return this.setup.getSetup(productId);
  }

  @Get(':productId/production-setup/preview')
  @RequirePermissions('catalog.manage')
  preview(@Param('productId') productId: string) {
    return this.setup.preview(productId);
  }

  @Put(':productId/production-setup')
  @RequirePermissions('catalog.manage')
  putSetup(@Param('productId') productId: string, @Body() dto: ProductionSetupPutDto) {
    return this.setup.putSetup(productId, dto);
  }
}
