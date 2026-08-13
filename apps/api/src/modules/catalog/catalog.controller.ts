import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryCategory, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions, RequireAnyPermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListActiveQueryDto, ListQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import {
  buildMaterialCostMap,
  productionUnitCost,
  resolveBomLineUnitCost,
  type BomDefaults,
  type MaterialCostMap,
} from '../../common/helpers/order-costing.util';
import { categoriesForGroup } from '../../common/helpers/inventory-category.util';
import type { AuthUser } from '@maher/types';

class MaterialListQueryDto extends ListActiveQueryDto {
  @IsOptional()
  @IsString()
  categoryGroup?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
class CategoryDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsUUID() parentId?: string;
}

class BomMaterialDto {
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() unitCost?: number;
  @IsOptional() @IsString() category?: string;
}

class BomDefaultsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomMaterialDto)
  materials?: BomMaterialDto[];
}

class CustomMeasurementDto {
  @IsOptional() @IsString() id?: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @Type(() => Number) @IsNumber() value?: number | null;
  /** Display unit — cm, m, mm, in (stored with the JSON measurement). */
  @IsOptional() @IsString() unit?: string | null;
}

class ProductDto {
  /** Optional — auto-generated when omitted. Not shown in product UIs. */
  @IsOptional() @IsString() @MinLength(1) sku?: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  categoryId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() basePrice?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  imageUrl?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) galleryUrls?: string[];
  @IsOptional() @Type(() => Number) @IsNumber() manufacturingCost?: number;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  width?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  height?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  depth?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  seatHeight?: number | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  @ValidateNested()
  @Type(() => BomDefaultsDto)
  bomDefaults?: BomDefaultsDto | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomMeasurementDto)
  customMeasurements?: CustomMeasurementDto[] | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  adminNotes?: string | null;
}

class ProductListQueryDto extends ListActiveQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
}

class BrowseProductsQueryDto extends ListActiveQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsIn(['name', 'price']) sortBy?: 'name' | 'price';
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
}

function stripProductCosts<T extends Record<string, unknown>>(product: T, user?: AuthUser): T {
  if (!user?.customerId) return product;
  const {
    manufacturingCost: _mc,
    bomDefaults: _bd,
    adminNotes: _an,
    basePrice: _bp,
    ...rest
  } = product;
  return rest as T;
}

class MaterialDto {
  @IsString() @MinLength(1) sku!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsEnum(InventoryCategory) category?: InventoryCategory;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @Type(() => Number) @IsNumber() minStock?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class FabricDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ColorDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() hex?: string;
}

class UnitDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsOptional() @IsString() nameHe?: string;
}

const UNITS_KEY = 'units_of_measure';

import { SequenceService } from '../../common/sequence.service';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
  ) {}

  // ── Categories ─────────────────────────────────────────────────────────────

  @Get('product-categories')
  @RequirePermissions('catalog.manage')
  listCategories(@Query() query: ListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    return this.paged(
      this.prisma.productCategory,
      { page, pageSize, skip, take },
      query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: 'insensitive' as const } },
              { nameEn: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {},
      { code: 'asc' },
    );
  }

  @Post('product-categories')
  @RequirePermissions('catalog.manage')
  async createCategory(@Body() dto: CategoryDto, @CurrentUser() user: AuthUser) {
    await this.assertUnique('productCategory', 'code', dto.code);
    const row = await this.prisma.productCategory.create({ data: dto });
    await this.audit(user.id, 'category.create', 'ProductCategory', row.id, row);
    return row;
  }

  @Patch('product-categories/:id')
  @RequirePermissions('catalog.manage')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: Partial<CategoryDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Category not found.' });
    if (dto.code && dto.code !== existing.code) await this.assertUnique('productCategory', 'code', dto.code);
    const row = await this.prisma.productCategory.update({ where: { id }, data: dto });
    await this.audit(user.id, 'category.update', 'ProductCategory', id, row);
    return row;
  }

  @Delete('product-categories/:id')
  @RequirePermissions('catalog.manage')
  async deleteCategory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const products = await this.prisma.product.count({ where: { categoryId: id } });
    if (products > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message: 'This category cannot be deleted because it has products.',
      });
    }
    await this.prisma.productCategory.delete({ where: { id } });
    await this.audit(user.id, 'category.delete', 'ProductCategory', id, null);
    return { ok: true };
  }

  // ── Products ───────────────────────────────────────────────────────────────

  @Get('catalog/browse/categories')
  @RequirePermissions('catalog.read')
  async browseCategories() {
    return this.prisma.productCategory.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        nameHe: true,
      },
    });
  }

  @Get('catalog/browse/products')
  @RequirePermissions('catalog.read')
  async browseProducts(@Query() query: BrowseProductsQueryDto, @CurrentUser() user: AuthUser) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const sortBy = query.sortBy ?? 'name';
    const sortDir = query.sortDir ?? 'asc';
    const where: Prisma.ProductWhereInput = {
      archivedAt: null,
      isActive: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
              { nameHe: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Price sort needs enrichment first; fetch a wider window then paginate in memory.
    const fetchAllForPriceSort = sortBy === 'price';
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { nameEn: sortDir },
        ...(fetchAllForPriceSort ? {} : { skip, take }),
      }),
    ]);

    const dealerPriceMap = new Map<string, { price: unknown; currency: string }>();
    if (user.customerId) {
      const productIds = rows.map((p) => p.id);
      const dealerPrices = await this.prisma.dealerPrice.findMany({
        where: { customerId: user.customerId, productId: { in: productIds } },
      });
      for (const dp of dealerPrices) {
        dealerPriceMap.set(dp.productId, { price: dp.price, currency: dp.currency });
      }
    }

    let data = rows.map((product) => {
      const stripped = stripProductCosts(
        product as unknown as Record<string, unknown>,
        user,
      );
      const dealerPrice = dealerPriceMap.get(product.id);
      return {
        ...stripped,
        dealerPrice: dealerPrice?.price ?? null,
        price: dealerPrice?.price ?? product.basePrice ?? null,
        priceCurrency: dealerPrice?.currency ?? 'ILS',
      };
    });

    if (fetchAllForPriceSort) {
      const dir = sortDir === 'desc' ? -1 : 1;
      data = [...data].sort((a, b) => {
        const pa = Number(a.price ?? 0);
        const pb = Number(b.price ?? 0);
        return (pa - pb) * dir;
      });
      data = data.slice(skip, skip + take);
    }

    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  /**
   * Distinct active products this dealer (customer) has ordered before,
   * newest order first. Empty when the user has no customerId.
   */
  @Get('catalog/browse/previously-ordered')
  @RequirePermissions('catalog.read')
  async browsePreviouslyOrdered(@CurrentUser() user: AuthUser) {
    if (!user.customerId) {
      return { data: [] as unknown[] };
    }

    const lines = await this.prisma.salesOrderLine.findMany({
      where: {
        productId: { not: null },
        salesOrder: {
          customerId: user.customerId,
          archivedAt: null,
        },
        product: {
          archivedAt: null,
          isActive: true,
        },
      },
      orderBy: { salesOrder: { orderDate: 'desc' } },
      select: {
        productId: true,
      },
      take: 200,
    });

    const orderedIds: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const id = line.productId;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
      if (orderedIds.length >= 48) break;
    }

    if (!orderedIds.length) {
      return { data: [] as unknown[] };
    }

    const rows = await this.prisma.product.findMany({
      where: { id: { in: orderedIds }, archivedAt: null, isActive: true },
      include: { category: true },
    });
    const byId = new Map(rows.map((p) => [p.id, p]));

    const dealerPrices = await this.prisma.dealerPrice.findMany({
      where: { customerId: user.customerId, productId: { in: orderedIds } },
    });
    const dealerPriceMap = new Map(
      dealerPrices.map((dp) => [dp.productId, { price: dp.price, currency: dp.currency }]),
    );

    const data = orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((product) => {
        const stripped = stripProductCosts(
          product as unknown as Record<string, unknown>,
          user,
        );
        const dealerPrice = dealerPriceMap.get(product.id);
        return {
          ...stripped,
          dealerPrice: dealerPrice?.price ?? null,
          price: dealerPrice?.price ?? product.basePrice ?? null,
          priceCurrency: dealerPrice?.currency ?? 'ILS',
        };
      });

    return { data };
  }

  @Get('catalog/browse/products/:id')
  @RequirePermissions('catalog.read')
  async browseProductById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const product = await this.prisma.product.findFirst({
      where: { id, archivedAt: null, isActive: true },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    }

    let dealerPrice: { price: unknown; currency: string } | null = null;
    if (user.customerId) {
      const row = await this.prisma.dealerPrice.findUnique({
        where: {
          customerId_productId: {
            customerId: user.customerId,
            productId: product.id,
          },
        },
      });
      if (row) {
        dealerPrice = { price: row.price, currency: row.currency };
      }
    }

    const stripped = stripProductCosts(
      product as unknown as Record<string, unknown>,
      user,
    );
    return {
      ...stripped,
      dealerPrice: dealerPrice?.price ?? null,
      price: dealerPrice?.price ?? product.basePrice ?? null,
      priceCurrency: dealerPrice?.currency ?? 'ILS',
    };
  }

  @Get('products')
  @RequirePermissions('catalog.manage')
  async listProducts(@Query() query: ProductListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.ProductWhereInput = {
      archivedAt: null,
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { nameEn: 'asc' },
        skip,
        take,
      }),
    ]);
    const materialCosts = await this.loadMaterialCosts();
    const data = rows.map((product) => {
      const { unitCost } = productionUnitCost(product, materialCosts);
      return {
        ...product,
        productionCost: unitCost > 0 ? unitCost : Number(product.manufacturingCost ?? 0) || null,
      };
    });
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Get('products/:id')
  @RequirePermissions('catalog.manage')
  async getProduct(@Param('id') id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, archivedAt: null },
      include: { category: true },
    });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });

    const materialCosts = await this.loadMaterialCosts();
    const materials = await this.prisma.material.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        nameAr: true,
        category: true,
      },
    });
    const bySku = new Map(materials.map((m) => [m.sku, m]));
    const bom = (product.bomDefaults ?? null) as BomDefaults | null;
    const bomLines = (bom?.materials ?? []).map((line) => {
      const mat = line.sku ? bySku.get(line.sku) : undefined;
      const qty = Number(line.qty) || 0;
      const unitCost = resolveBomLineUnitCost(
        line.sku,
        line.unitCost != null && Number.isFinite(Number(line.unitCost))
          ? Number(line.unitCost)
          : undefined,
        materialCosts,
      );
      return {
        sku: line.sku ?? '',
        qty,
        category: line.category ?? mat?.category ?? null,
        unitCost,
        lineCost: qty * unitCost,
        nameEn: mat?.nameEn ?? line.sku ?? '',
        nameAr: mat?.nameAr ?? line.sku ?? '',
        materialId: mat?.id ?? null,
      };
    });
    const { unitCost, breakdown } = productionUnitCost(product, materialCosts);
    return {
      ...product,
      bomLines,
      productionCost: unitCost > 0 ? unitCost : Number(product.manufacturingCost ?? 0) || null,
      costBreakdown: breakdown,
    };
  }

  /** Per-seller (dealer) sell prices for this product. Production cost is never dealer-scoped. */
  @Get('products/:id/dealer-prices')
  @RequirePermissions('catalog.manage')
  async listProductDealerPrices(@Param('id') id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    return this.prisma.dealerPrice.findMany({
      where: { productId: id },
      include: {
        customer: {
          select: {
            id: true,
            code: true,
            name: true,
            nameAr: true,
            nameEn: true,
            nameHe: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('products')
  @RequirePermissions('catalog.manage')
  async createProduct(@Body() dto: ProductDto, @CurrentUser() user: AuthUser) {
    const sku = await this.sequences.next('PRD', 'PRD');
    await this.assertUnique('product', 'sku', sku);
    const bomDefaults = this.normalizeBom(dto.bomDefaults);
    const manufacturingCost = await this.resolveManufacturingCost(dto, bomDefaults);
    const customMeasurements = this.normalizeCustomMeasurements(dto.customMeasurements);
    const row = await this.prisma.product.create({
      data: {
        sku,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        description: dto.description,
        categoryId: dto.categoryId ?? null,
        basePrice: dto.basePrice,
        unit: dto.unit ?? 'pcs',
        isActive: dto.isActive ?? true,
        imageUrl: dto.imageUrl,
        galleryUrls: dto.galleryUrls ?? [],
        manufacturingCost,
        width: dto.width ?? null,
        height: dto.height ?? null,
        depth: dto.depth ?? null,
        seatHeight: dto.seatHeight ?? null,
        bomDefaults: bomDefaults as Prisma.InputJsonValue | undefined,
        customMeasurements: customMeasurements as Prisma.InputJsonValue | undefined,
        adminNotes: dto.adminNotes ?? null,
      },
      include: { category: true },
    });
    await this.audit(user.id, 'product.create', 'Product', row.id, row);
    return row;
  }

  @Post('products/:id/duplicate')
  @RequirePermissions('catalog.manage')
  async duplicateProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const src = await this.prisma.product.findFirst({ where: { id, archivedAt: null } });
    if (!src) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    const sku = `${src.sku}-COPY-${Date.now().toString(36).toUpperCase()}`;
    const row = await this.prisma.product.create({
      data: {
        sku,
        nameAr: src.nameAr,
        nameEn: `${src.nameEn} (copy)`,
        nameHe: src.nameHe,
        description: src.description,
        categoryId: src.categoryId,
        basePrice: src.basePrice,
        unit: src.unit,
        isActive: false,
        imageUrl: src.imageUrl,
        galleryUrls: src.galleryUrls,
        manufacturingCost: src.manufacturingCost,
        width: src.width,
        height: src.height,
        depth: src.depth,
        seatHeight: src.seatHeight,
        bomDefaults: src.bomDefaults ?? undefined,
        customMeasurements: src.customMeasurements ?? undefined,
        adminNotes: src.adminNotes,
      },
      include: { category: true },
    });
    await this.audit(user.id, 'product.duplicate', 'Product', row.id, { from: id });
    return row;
  }

  @Patch('products/:id')
  @RequirePermissions('catalog.manage')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: Partial<ProductDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.product.findFirst({ where: { id, archivedAt: null } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    // Product SKU is system-managed — ignore client updates.
    const { sku: _ignoredSku, ...safeDto } = dto;
    void _ignoredSku;
    dto = safeDto;

    const bomDefaults =
      dto.bomDefaults !== undefined ? this.normalizeBom(dto.bomDefaults) : undefined;
    const manufacturingCost =
      bomDefaults !== undefined || dto.manufacturingCost !== undefined
        ? await this.resolveManufacturingCost(
            {
              manufacturingCost: dto.manufacturingCost,
              bomDefaults: bomDefaults ?? (existing.bomDefaults as BomDefaults | null),
            },
            bomDefaults ?? (existing.bomDefaults as BomDefaults | null),
          )
        : undefined;
    const customMeasurements =
      dto.customMeasurements !== undefined
        ? this.normalizeCustomMeasurements(dto.customMeasurements)
        : undefined;

    const row = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.nameHe !== undefined ? { nameHe: dto.nameHe } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.galleryUrls !== undefined ? { galleryUrls: dto.galleryUrls } : {}),
        ...(dto.width !== undefined ? { width: dto.width } : {}),
        ...(dto.height !== undefined ? { height: dto.height } : {}),
        ...(dto.depth !== undefined ? { depth: dto.depth } : {}),
        ...(dto.seatHeight !== undefined ? { seatHeight: dto.seatHeight } : {}),
        ...(bomDefaults !== undefined
          ? { bomDefaults: bomDefaults as Prisma.InputJsonValue }
          : {}),
        ...(customMeasurements !== undefined
          ? { customMeasurements: customMeasurements as Prisma.InputJsonValue }
          : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        ...(manufacturingCost !== undefined ? { manufacturingCost } : {}),
      },
      include: { category: true },
    });
    await this.audit(user.id, 'product.update', 'Product', id, row);
    return this.getProduct(id);
  }

  @Post('products/:id/deactivate')
  @RequirePermissions('catalog.manage')
  async deactivateProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    await this.audit(user.id, 'product.deactivate', 'Product', id, null);
    return row;
  }

  @Post('products/:id/activate')
  @RequirePermissions('catalog.manage')
  async activateProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.product.update({ where: { id }, data: { isActive: true } });
    await this.audit(user.id, 'product.activate', 'Product', id, null);
    return row;
  }

  @Delete('products/:id')
  @RequirePermissions('catalog.manage')
  async deleteProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const [q, so, po] = await Promise.all([
      this.prisma.quotationLine.count({ where: { productId: id } }),
      this.prisma.salesOrderLine.count({ where: { productId: id } }),
      this.prisma.productionOrder.count({ where: { productId: id } }),
    ]);
    if (q + so + po > 0) {
      throw new ConflictException({
        code: 'PRODUCT_IN_USE',
        message:
          'This product cannot be deleted because it is referenced by quotations, orders, or production. Deactivate it instead.',
      });
    }
    await this.prisma.product.update({ where: { id }, data: { archivedAt: new Date(), isActive: false } });
    await this.audit(user.id, 'product.archive', 'Product', id, null);
    return { ok: true };
  }

  // ── Materials ──────────────────────────────────────────────────────────────

  @Get('materials')
  @RequireAnyPermissions('catalog.manage', 'catalog.read', 'inventory.read')
  listMaterials(@Query() query: MaterialListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const groupCategories = categoriesForGroup(query.categoryGroup);
    const where: Prisma.MaterialWhereInput = {
      archivedAt: null,
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
      ...(groupCategories ? { category: { in: groupCategories } } : {}),
      ...(query.category && !groupCategories
        ? { category: query.category as InventoryCategory }
        : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.paged(this.prisma.material, { page, pageSize, skip, take }, where, {
      createdAt: 'desc',
    });
  }

  @Post('materials')
  @RequirePermissions('catalog.manage')
  async createMaterial(@Body() dto: MaterialDto, @CurrentUser() user: AuthUser) {
    await this.assertUnique('material', 'sku', dto.sku);
    const row = await this.prisma.material.create({
      data: {
        sku: dto.sku,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        category: dto.category ?? 'OTHER',
        unit: dto.unit ?? 'pcs',
        color: dto.color,
        size: dto.size,
        minStock: dto.minStock ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(user.id, 'material.create', 'Material', row.id, row);
    return row;
  }

  @Patch('materials/:id')
  @RequirePermissions('catalog.manage')
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: Partial<MaterialDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.material.findFirst({ where: { id, archivedAt: null } });
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Material not found.' });
    if (dto.sku && dto.sku !== existing.sku) await this.assertUnique('material', 'sku', dto.sku);
    const row = await this.prisma.material.update({ where: { id }, data: dto });
    await this.audit(user.id, 'material.update', 'Material', id, row);
    return row;
  }

  @Post('materials/:id/deactivate')
  @RequirePermissions('catalog.manage')
  deactivateMaterial(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.material.update({ where: { id }, data: { isActive: false } }).then(async (row) => {
      await this.audit(user.id, 'material.deactivate', 'Material', id, null);
      return row;
    });
  }

  @Post('materials/:id/activate')
  @RequirePermissions('catalog.manage')
  activateMaterial(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.material.update({ where: { id }, data: { isActive: true } }).then(async (row) => {
      await this.audit(user.id, 'material.activate', 'Material', id, null);
      return row;
    });
  }

  // ── Fabrics ────────────────────────────────────────────────────────────────

  @Get('fabrics')
  @RequirePermissions('catalog.manage')
  listFabrics(@Query() query: ListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: 'insensitive' as const } },
            { nameEn: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return this.paged(this.prisma.fabric, { page, pageSize, skip, take }, where, { code: 'asc' });
  }

  @Post('fabrics')
  @RequirePermissions('catalog.manage')
  async createFabric(@Body() dto: FabricDto, @CurrentUser() user: AuthUser) {
    await this.assertUnique('fabric', 'code', dto.code);
    const row = await this.prisma.fabric.create({ data: { ...dto, isActive: dto.isActive ?? true } });
    await this.audit(user.id, 'fabric.create', 'Fabric', row.id, row);
    return row;
  }

  @Patch('fabrics/:id')
  @RequirePermissions('catalog.manage')
  async updateFabric(
    @Param('id') id: string,
    @Body() dto: Partial<FabricDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.fabric.update({ where: { id }, data: dto });
    await this.audit(user.id, 'fabric.update', 'Fabric', id, row);
    return row;
  }

  @Post('fabrics/:id/deactivate')
  @RequirePermissions('catalog.manage')
  deactivateFabric(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.fabric.update({ where: { id }, data: { isActive: false } }).then(async (row) => {
      await this.audit(user.id, 'fabric.deactivate', 'Fabric', id, null);
      return row;
    });
  }

  @Post('fabrics/:id/activate')
  @RequirePermissions('catalog.manage')
  activateFabric(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.prisma.fabric.update({ where: { id }, data: { isActive: true } }).then(async (row) => {
      await this.audit(user.id, 'fabric.activate', 'Fabric', id, null);
      return row;
    });
  }

  // ── Colors ─────────────────────────────────────────────────────────────────

  @Get('colors')
  @RequirePermissions('catalog.manage')
  listColors(@Query() query: ListQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where = query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: 'insensitive' as const } },
            { nameEn: { contains: query.q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    return this.paged(this.prisma.colorReference, { page, pageSize, skip, take }, where, {
      code: 'asc',
    });
  }

  @Post('colors')
  @RequirePermissions('catalog.manage')
  async createColor(@Body() dto: ColorDto, @CurrentUser() user: AuthUser) {
    await this.assertUnique('colorReference', 'code', dto.code);
    const row = await this.prisma.colorReference.create({ data: dto });
    await this.audit(user.id, 'color.create', 'ColorReference', row.id, row);
    return row;
  }

  @Patch('colors/:id')
  @RequirePermissions('catalog.manage')
  async updateColor(
    @Param('id') id: string,
    @Body() dto: Partial<ColorDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.colorReference.update({ where: { id }, data: dto });
    await this.audit(user.id, 'color.update', 'ColorReference', id, row);
    return row;
  }

  @Delete('colors/:id')
  @RequirePermissions('catalog.manage')
  async deleteColor(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.colorReference.delete({ where: { id } });
    await this.audit(user.id, 'color.delete', 'ColorReference', id, null);
    return { ok: true };
  }

  // ── Units (SystemSetting JSON) ─────────────────────────────────────────────

  @Get('units')
  @RequirePermissions('catalog.manage')
  async listUnits() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: UNITS_KEY } });
    const value = (setting?.value as UnitDto[] | null) ?? [
      { code: 'pcs', nameEn: 'Piece', nameAr: 'قطعة', nameHe: 'יחידה' },
      { code: 'm', nameEn: 'Meter', nameAr: 'متر', nameHe: 'מטר' },
      { code: 'm2', nameEn: 'Square meter', nameAr: 'متر مربع', nameHe: 'מ״ר' },
      { code: 'kg', nameEn: 'Kilogram', nameAr: 'كيلوغرام', nameHe: 'ק״ג' },
      { code: 'l', nameEn: 'Liter', nameAr: 'لتر', nameHe: 'ליטר' },
    ];
    return {
      data: value.map((u) => ({ ...u, id: u.code })),
    };
  }

  @Post('units')
  @RequirePermissions('catalog.manage')
  async createUnit(@Body() dto: UnitDto, @CurrentUser() user: AuthUser) {
    const current = (await this.listUnits()).data.map(({ code, nameEn, nameAr, nameHe }) => ({
      code,
      nameEn,
      nameAr,
      nameHe,
    }));
    if (current.some((u) => u.code === dto.code)) {
      throw new ConflictException({ code: 'UNIT_EXISTS', message: 'Unit code already exists.' });
    }
    const next = [...current, dto];
    await this.prisma.systemSetting.upsert({
      where: { key: UNITS_KEY },
      create: { key: UNITS_KEY, value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
      update: { value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
    });
    await this.audit(user.id, 'unit.create', 'SystemSetting', UNITS_KEY, dto);
    return { ...dto, id: dto.code };
  }

  @Patch('units/:code')
  @RequirePermissions('catalog.manage')
  async updateUnit(
    @Param('code') code: string,
    @Body() dto: Partial<UnitDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const current = (await this.listUnits()).data.map(({ code: c, nameEn, nameAr, nameHe }) => ({
      code: c,
      nameEn,
      nameAr,
      nameHe,
    }));
    const idx = current.findIndex((u) => u.code === code);
    const existing = idx >= 0 ? current[idx] : undefined;
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Unit not found.' });
    }
    const nextCode = dto.code?.trim() || code;
    if (nextCode !== code && current.some((u) => u.code === nextCode)) {
      throw new ConflictException({ code: 'UNIT_EXISTS', message: 'Unit code already exists.' });
    }
    const updated = {
      code: nextCode,
      nameEn: dto.nameEn?.trim() || existing.nameEn,
      nameAr: dto.nameAr?.trim() || existing.nameAr,
      nameHe: dto.nameHe?.trim() || existing.nameHe,
    };
    const next = current.map((u, i) => (i === idx ? updated : u));
    await this.prisma.systemSetting.upsert({
      where: { key: UNITS_KEY },
      create: { key: UNITS_KEY, value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
      update: { value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
    });
    await this.audit(user.id, 'unit.update', 'SystemSetting', UNITS_KEY, updated);
    return { ...updated, id: updated.code };
  }

  @Delete('units/:code')
  @RequirePermissions('catalog.manage')
  async deleteUnit(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    const current = (await this.listUnits()).data.map(({ code: c, nameEn, nameAr }) => ({
      code: c,
      nameEn,
      nameAr,
    }));
    const next = current.filter((u) => u.code !== code);
    if (next.length === current.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Unit not found.' });
    }
    await this.prisma.systemSetting.upsert({
      where: { key: UNITS_KEY },
      create: { key: UNITS_KEY, value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
      update: { value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
    });
    await this.audit(user.id, 'unit.delete', 'SystemSetting', UNITS_KEY, { code });
    return { ok: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async paged(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: { count: (a: any) => Promise<number>; findMany: (a: any) => Promise<unknown[]> },
    pageInfo: { page: number; pageSize: number; skip: number; take: number },
    where: object,
    orderBy: object,
  ) {
    const [totalItems, data] = await Promise.all([
      model.count({ where }),
      model.findMany({
        where,
        orderBy,
        skip: pageInfo.skip,
        take: pageInfo.take,
      }),
    ]);
    return { data, meta: paginatedMeta(pageInfo.page, pageInfo.pageSize, totalItems) };
  }

  private async assertUnique(
    model: 'productCategory' | 'product' | 'material' | 'fabric' | 'colorReference',
    field: string,
    value: string,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (this.prisma as any)[model].findUnique({ where: { [field]: value } });
    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        message: `${field} "${value}" already exists.`,
      });
    }
  }

  private audit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    newValues: unknown,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        newValues: (newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private normalizeBom(bom: BomDefaultsDto | BomDefaults | null | undefined): BomDefaults | null {
    if (bom == null) return null;
    const materials = (bom.materials ?? [])
      .filter((m) => m && String(m.sku ?? '').trim())
      .map((m) => ({
        sku: String(m.sku).trim(),
        qty: Number(m.qty) || 0,
        ...(m.unitCost != null && Number.isFinite(Number(m.unitCost))
          ? { unitCost: Number(m.unitCost) }
          : {}),
        ...(m.category ? { category: String(m.category) } : {}),
      }));
    return { materials };
  }

  private normalizeCustomMeasurements(
    rows: CustomMeasurementDto[] | null | undefined,
  ): Array<{
    id: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string;
    value: number | null;
    unit?: string;
  }> | null {
    if (rows == null) return null;
    return rows
      .filter((r) => r && String(r.nameEn ?? '').trim() && String(r.nameAr ?? '').trim())
      .map((r, index) => {
        const unitRaw = String(r.unit ?? 'cm').trim().slice(0, 24);
        const unit = unitRaw || 'cm';
        return {
          id: String(r.id || '').trim() || `m-${Date.now().toString(36)}-${index}`,
          nameEn: String(r.nameEn).trim(),
          nameAr: String(r.nameAr).trim(),
          ...(r.nameHe?.trim() ? { nameHe: r.nameHe.trim() } : {}),
          value:
            r.value != null && Number.isFinite(Number(r.value)) ? Number(r.value) : null,
          unit,
        };
      });
  }

  private async loadMaterialCosts(): Promise<MaterialCostMap> {
    const [items, txs] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { archivedAt: null, standardCost: { gt: 0 } },
        select: { sku: true, standardCost: true },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: { unitCost: { not: null } },
        orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
        select: {
          type: true,
          unitCost: true,
          inventoryItem: { select: { sku: true } },
        },
        take: 800,
      }),
    ]);
    return buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((tx) => ({
        sku: tx.inventoryItem.sku,
        unitCost: tx.unitCost,
        type: tx.type,
      })),
    });
  }

  /** Prefer BOM-derived cost when materials exist; else explicit manufacturingCost. */
  private async resolveManufacturingCost(
    dto: { manufacturingCost?: number; bomDefaults?: BomDefaults | null },
    bom: BomDefaults | null,
  ): Promise<number | undefined> {
    const materialCosts = await this.loadMaterialCosts();
    const { unitCost } = productionUnitCost(
      { manufacturingCost: dto.manufacturingCost, bomDefaults: bom },
      materialCosts,
    );
    if (bom?.materials?.length && unitCost > 0) return unitCost;
    if (dto.manufacturingCost != null) return dto.manufacturingCost;
    if (unitCost > 0) return unitCost;
    return dto.manufacturingCost;
  }
}
