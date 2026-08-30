import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryService } from './inventory.service';
import { ListFinishedLotsDto } from './dto/finished-lots.dto';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '@maher/types';

class ListInventoryItemsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryGroup?: string;

  @IsOptional()
  @IsString()
  itemClass?: string;

  @IsOptional()
  @IsString()
  materialGroup?: string;

  @IsOptional()
  @IsString()
  warehouseType?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  lowStock?: string;

  @IsOptional()
  @IsString()
  active?: string;

  @IsOptional()
  @IsString()
  isPurchasable?: string;
}

class ListInventoryOpsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  warehouseType?: string;
}

class CustomMeasurementDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsString()
  @MinLength(1)
  nameAr!: string;

  @IsOptional()
  @IsString()
  nameHe?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @Type(() => Number)
  @IsNumber()
  value?: number | null;

  @IsOptional()
  @IsString()
  unit?: string | null;
}

class CreateInventoryItemDto {
  /** Optional — auto-generated as FAB-0001 / FOAM-0001 / WOOD-0001 / ACC-0001. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsString()
  @MinLength(1)
  nameAr!: string;

  @IsString()
  @MinLength(1)
  nameEn!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  qrCode?: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  materialType?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomMeasurementDto)
  customMeasurements?: CustomMeasurementDto[] | null;

  @IsOptional()
  @IsUUID()
  preferredSupplierId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  materialType?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomMeasurementDto)
  customMeasurements?: CustomMeasurementDto[] | null;

  @IsOptional()
  @IsUUID()
  preferredSupplierId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}

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

class ScanCountDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @Type(() => Number)
  @IsNumber()
  countedQty!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  postImmediately?: boolean;
}

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('overview')
  @RequirePermissions('inventory.read')
  overview() {
    return this.inventory.overview();
  }

  @Get('semi-finished')
  @RequirePermissions('inventory.read')
  listSemiFinished(@Query() query: PaginationDto) {
    return this.inventory.listSemiFinished(query);
  }

  @Get('finished-lots')
  @RequirePermissions('inventory.read')
  listFinishedLots(@Query() query: ListFinishedLotsDto) {
    return this.inventory.listFinishedLots(query);
  }

  @Get('lots/:id')
  @RequirePermissions('inventory.read')
  async getLot(@Param('id') id: string) {
    const lot = await this.inventory.getLot(id);
    if (!lot) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lot not found.' });
    return lot;
  }

  @Get('finished-goods')
  @RequirePermissions('inventory.read')
  listFinishedGoods(@Query() query: ListInventoryItemsDto, @CurrentUser() user: AuthUser) {
    return this.inventory.listItems({ ...query, itemClass: 'FINISHED_GOOD' }, user.permissions);
  }

  @Get('groups')
  @RequirePermissions('inventory.read')
  listGroups(@CurrentUser() user: AuthUser) {
    return this.inventory.listGroups(user.permissions);
  }

  @Get('items')
  @RequirePermissions('inventory.read')
  list(@Query() query: ListInventoryItemsDto, @CurrentUser() user: AuthUser) {
    return this.inventory.listItems(query, user.permissions);
  }

  @Post('items')
  @RequirePermissions('inventory.adjust')
  createItem(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: AuthUser) {
    return this.inventory.createItem(dto, user.id);
  }

  @Patch('items/:id')
  @RequirePermissions('inventory.adjust')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.updateItem(id, dto, user.id);
  }

  @Post('items/sync-from-materials')
  @RequirePermissions('inventory.adjust')
  syncFromMaterials(@CurrentUser() user: AuthUser) {
    return this.inventory.syncFromMaterials(user.id);
  }

  @Get('items/by-code/:code')
  @RequirePermissions('inventory.read')
  byCode(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.inventory.findByCode(code, user.permissions);
  }

  @Get('items/:id/open-receipts')
  @RequirePermissions('inventory.receive')
  openReceipts(@Param('id') id: string) {
    return this.inventory.listOpenReceipts(id);
  }

  @Get('items/:id/transactions')
  @RequirePermissions('inventory.read')
  listItemTransactions(
    @Param('id') id: string,
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.listItemTransactions(id, query, user.permissions);
  }

  @Get('items/:id')
  @RequirePermissions('inventory.read')
  getItem(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventory.getItem(id, user.permissions);
  }

  @Get('warehouses')
  @RequirePermissions('inventory.read')
  warehouses(@Query('type') type?: string) {
    return this.inventory.listWarehouses(type);
  }

  @Get('low-stock')
  @RequirePermissions('inventory.read')
  lowStock(@CurrentUser() user: AuthUser) {
    return this.inventory.lowStock(user.permissions);
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
  listTransfers(@Query() query: ListInventoryOpsDto) {
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
  listCounts(@Query() query: ListInventoryOpsDto) {
    return this.inventory.listCounts(query);
  }

  @Post('counts')
  @RequirePermissions('inventory.count')
  createCount(@Body() dto: CreateCountDto, @CurrentUser() user: AuthUser) {
    return this.inventory.createCount(dto, user.id);
  }

  /** Barcode / SKU cycle-count: create (and optionally post) a one-line count. */
  @Post('counts/scan')
  @RequirePermissions('inventory.count')
  scanCount(@Body() dto: ScanCountDto, @CurrentUser() user: AuthUser) {
    return this.inventory.scanCount(dto, user.id);
  }

  @Post('counts/:id/post')
  @RequirePermissions('inventory.count')
  postCount(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventory.postCount(id, user.id);
  }
}
