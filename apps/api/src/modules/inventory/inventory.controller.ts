import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { InventoryService } from './inventory.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';

class StockMovementDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  warehouseId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class TransferLineDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

class CreateTransferDto {
  @IsUUID()
  fromWarehouseId!: string;

  @IsUUID()
  toWarehouseId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferLineDto)
  lines!: TransferLineDto[];
}

class CountLineDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  countedQty?: number;
}

class CreateCountDto {
  @IsUUID()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines!: CountLineDto[];
}

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items')
  @RequirePermissions('inventory.read')
  list(@Query() query: PaginationDto) {
    return this.inventory.listItems(query);
  }

  @Get('items/by-code/:code')
  @RequirePermissions('inventory.read')
  byCode(@Param('code') code: string) {
    return this.inventory.findByCode(code);
  }

  @Get('warehouses')
  @RequirePermissions('inventory.read')
  warehouses() {
    return this.inventory.listWarehouses();
  }

  @Get('low-stock')
  @RequirePermissions('inventory.read')
  lowStock() {
    return this.inventory.lowStock();
  }

  @Post('receipts')
  @RequirePermissions('inventory.receive')
  receive(@Body() dto: StockMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventory.receive(dto, user.id);
  }

  @Post('issues')
  @RequirePermissions('inventory.issue')
  issue(@Body() dto: StockMovementDto, @CurrentUser() user: AuthUser) {
    return this.inventory.issue(dto, user.id);
  }

  @Get('transfers')
  @RequirePermissions('inventory.read')
  listTransfers(@Query() query: PaginationDto) {
    return this.inventory.listTransfers(query);
  }

  @Post('transfers')
  @RequirePermissions('inventory.transfer')
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {
    return this.inventory.createTransfer(dto, user.id);
  }

  @Post('transfers/:id/complete')
  @RequirePermissions('inventory.transfer')
  completeTransfer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventory.completeTransfer(id, user.id);
  }

  @Get('counts')
  @RequirePermissions('inventory.read')
  listCounts(@Query() query: PaginationDto) {
    return this.inventory.listCounts(query);
  }

  @Post('counts')
  @RequirePermissions('inventory.count')
  createCount(@Body() dto: CreateCountDto, @CurrentUser() user: AuthUser) {
    return this.inventory.createCount(dto, user.id);
  }

  @Post('counts/:id/post')
  @RequirePermissions('inventory.count')
  postCount(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventory.postCount(id, user.id);
  }
}
