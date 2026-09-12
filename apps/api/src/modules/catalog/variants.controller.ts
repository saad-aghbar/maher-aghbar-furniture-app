import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AuthUser } from '@maher/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermissions, RequirePermissions } from '../../common/decorators/auth.decorators';
import { VariantsService, type ProductVariantWrite } from './variants.service';
import { CatalogPromotionService } from './catalog-promotion.service';

class VariantMeasurementDto {
  @IsString() @MinLength(1) key!: string;
  @IsOptional() @IsString() labelAr?: string | null;
  @IsOptional() @IsString() labelEn?: string | null;
  @IsOptional() @IsString() labelHe?: string | null;
  @IsOptional() value?: number | string | null;
  @IsString() @MinLength(1) unit!: string;
}

class VariantOptionDto {
  @IsUUID() specOptionValueId!: string;
  @IsOptional() @Type(() => Number) @IsNumber() qty?: number | null;
  @IsOptional() @IsString() note?: string | null;
}

class ProductVariantDto {
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() @MinLength(1) code?: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsOptional() @IsString() @MinLength(1) nameEn?: string;
  @IsOptional() @IsString() nameHe?: string | null;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
  @IsOptional() @Type(() => Number) @IsNumber() basePrice?: number | null;
  @IsOptional() bomDefaults?: unknown;
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) galleryUrls?: string[];
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  workflowId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() width?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() height?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() depth?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() seatHeight?: number | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantMeasurementDto)
  measurements?: VariantMeasurementDto[];
  @IsOptional() @IsString() factoryNotesAr?: string | null;
  @IsOptional() @IsString() factoryNotesEn?: string | null;
  @IsOptional() @IsString() factoryNotesHe?: string | null;
  @IsOptional() @IsString() adminNotes?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  options?: VariantOptionDto[];
}

class VariantListQueryDto {
  @IsOptional() @IsString() includeInactive?: string;
}

@ApiTags('product-variants')
@Controller('products/:productId/variants')
export class VariantsController {
  constructor(
    private readonly variants: VariantsService,
    private readonly promotion: CatalogPromotionService,
  ) {}

  @Get()
  @RequireAnyPermissions('catalog.manage', 'catalog.read', 'request.create')
  list(
    @Param('productId') productId: string,
    @Query() query: VariantListQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.list(productId, user, query.includeInactive === 'true');
  }

  @Post('from-order-line/:lineId')
  @RequirePermissions('catalog.manage')
  createFromOrderLine(
    @Param('productId') productId: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.promotion.createVariantFromOrderLine(productId, lineId, user.id);
  }

  @Post()
  @RequirePermissions('catalog.manage')
  create(
    @Param('productId') productId: string,
    @Body() dto: ProductVariantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.create(productId, dto as ProductVariantWrite, user.id);
  }

  @Get(':id/cost')
  @RequirePermissions('catalog.manage')
  cost(@Param('productId') productId: string, @Param('id') id: string) {
    return this.variants.cost(productId, id);
  }

  @Post(':id/copy-from-standard')
  @RequirePermissions('catalog.manage')
  copyFromStandard(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.copyFromStandard(productId, id, user.id);
  }

  @Get(':id')
  @RequireAnyPermissions('catalog.manage', 'catalog.read', 'request.create')
  get(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.get(productId, id, user);
  }

  @Patch(':id')
  @RequirePermissions('catalog.manage')
  update(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() dto: Partial<ProductVariantDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.update(productId, id, dto as ProductVariantWrite, user.id);
  }

  @Post(':id/duplicate')
  @RequirePermissions('catalog.manage')
  duplicate(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.duplicate(productId, id, user.id);
  }

  @Post(':id/deactivate')
  @RequirePermissions('catalog.manage')
  deactivate(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.deactivate(productId, id, user.id);
  }

  @Post(':id/activate')
  @RequirePermissions('catalog.manage')
  activate(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.activate(productId, id, user.id);
  }

  @Delete(':id')
  @RequirePermissions('catalog.manage')
  remove(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.variants.remove(productId, id, user.id);
  }
}
