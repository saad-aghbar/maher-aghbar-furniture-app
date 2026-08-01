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
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryCategory, Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { paginatedMeta } from '../../common/dto/pagination.dto';
import { ListActiveQueryDto, ListQueryDto, pageSkipTake } from '../../common/dto/list-query.dto';
import type { AuthUser } from '@maher/types';

class CategoryDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsUUID() parentId?: string;
}

class ProductDto {
  @IsString() @MinLength(1) sku!: string;
  @IsString() @MinLength(1) nameAr!: string;
  @IsString() @MinLength(1) nameEn!: string;
  @IsOptional() @IsString() nameHe?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() basePrice?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
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

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Get('products')
  @RequirePermissions('catalog.manage')
  async listProducts(@Query() query: ListActiveQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.ProductWhereInput = {
      archivedAt: null,
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
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
    const [totalItems, data] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data, meta: paginatedMeta(page, pageSize, totalItems) };
  }

  @Post('products')
  @RequirePermissions('catalog.manage')
  async createProduct(@Body() dto: ProductDto, @CurrentUser() user: AuthUser) {
    await this.assertUnique('product', 'sku', dto.sku);
    const row = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        nameHe: dto.nameHe,
        description: dto.description,
        categoryId: dto.categoryId,
        basePrice: dto.basePrice,
        unit: dto.unit ?? 'pcs',
        isActive: dto.isActive ?? true,
      },
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
      },
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
    if (dto.sku && dto.sku !== existing.sku) await this.assertUnique('product', 'sku', dto.sku);
    const row = await this.prisma.product.update({ where: { id }, data: dto });
    await this.audit(user.id, 'product.update', 'Product', id, row);
    return row;
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
  @RequirePermissions('catalog.manage')
  listMaterials(@Query() query: ListActiveQueryDto) {
    const { page, pageSize, skip, take } = pageSkipTake(query);
    const where: Prisma.MaterialWhereInput = {
      archivedAt: null,
      ...(query.isActive === 'true' ? { isActive: true } : {}),
      ...(query.isActive === 'false' ? { isActive: false } : {}),
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
}
