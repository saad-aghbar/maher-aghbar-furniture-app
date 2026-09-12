import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@maher/database';
import {
  measurementsFromProduct,
  persistMeasurementsRoundTrip,
  pickVariantScopedRows,
  type AuthUser,
  type ProductLike,
  type VariantMeasurement,
} from '@maher/types';
import { PrismaService } from '../../common/prisma.service';
import { TranslationService } from './translation.service';
import { nextVariantCode } from './next-variant-code';
import { productionUnitCost, buildMaterialCostMap } from '../../common/helpers/order-costing.util';
import { calculateDurationMinutes } from '../scheduling/domain/duration-calculator';
import { laborMoneyFromMinutes, resolveHourlyRate } from '../tasks/labor-rate';

export type VariantOptionInput = {
  specOptionValueId: string;
  qty?: number | null;
  note?: string | null;
};

export type ProductVariantWrite = {
  sku?: string;
  code?: string;
  nameAr?: string;
  nameEn?: string;
  nameHe?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  basePrice?: number | null;
  bomDefaults?: unknown;
  imageUrl?: string | null;
  galleryUrls?: string[];
  workflowId?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
  measurements?: VariantMeasurement[] | null;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  adminNotes?: string | null;
  options?: VariantOptionInput[];
};

const VARIANT_INCLUDE = {
  options: {
    include: {
      specOptionValue: {
        include: {
          group: true,
          colorReference: true,
          inventoryItem: { select: { id: true, sku: true, nameEn: true, nameAr: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductVariantInclude;

type ProductRow = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isActive: boolean;
  basePrice?: unknown;
  manufacturingCost?: unknown;
  bomDefaults?: unknown;
  imageUrl?: string | null;
  galleryUrls?: string[];
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  seatHeight?: unknown;
  customMeasurements?: unknown;
  adminNotes?: string | null;
};

function asJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function stripVariantCosts<T extends Record<string, unknown>>(
  variant: T,
  user?: AuthUser,
): T {
  if (!user?.customerId) return variant;
  const {
    manufacturingCost: _mc,
    bomDefaults: _bd,
    adminNotes: _an,
    factoryNotesAr: _fa,
    factoryNotesEn: _fe,
    factoryNotesHe: _fh,
    ...rest
  } = variant;
  return rest as T;
}

@Injectable()
export class VariantsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly translation?: TranslationService,
  ) {}

  async requireProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, archivedAt: null },
    });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    return product;
  }

  async requireVariant(productId: string, id: string) {
    const row = await this.prisma.productVariant.findFirst({
      where: { id, productId },
      include: VARIANT_INCLUDE,
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Variant not found.' });
    return row;
  }

  serialize<T extends Record<string, unknown>>(row: T, user?: AuthUser) {
    return stripVariantCosts(row, user);
  }

  async list(productId: string, user?: AuthUser, includeInactive = false) {
    await this.requireProduct(productId);
    const rows = await this.prisma.productVariant.findMany({
      where: {
        productId,
        archivedAt: null,
        ...(user?.customerId || !includeInactive ? { isActive: true } : {}),
      },
      include: VARIANT_INCLUDE,
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const serialized = rows.map((row) =>
      this.serialize(row as unknown as Record<string, unknown>, user),
    );
    if (!user?.customerId) return serialized;
    const prices = await this.prisma.dealerPrice.findMany({
      where: { customerId: user.customerId, productId },
    });
    return serialized.map((row, index) => {
      const variantId = String(rows[index]?.id ?? '');
      const dp =
        prices.find((p) => p.variantId === variantId) ??
        prices.find((p) => p.variantId == null);
      return {
        ...row,
        dealerPrice: dp?.price ?? null,
        price: dp?.price ?? rows[index]?.basePrice ?? null,
      };
    });
  }

  async get(productId: string, id: string, user?: AuthUser) {
    const row = await this.requireVariant(productId, id);
    return this.serialize(row as unknown as Record<string, unknown>, user);
  }

  async ensureDefaultVariant(product: ProductRow) {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        productId: product.id,
        OR: [{ isDefault: true }, { sku: `${product.sku}-STD` }],
      },
    });
    if (existing) return existing;
    return this.prisma.productVariant.create({
      data: this.defaultVariantData(product),
      include: VARIANT_INCLUDE,
    });
  }

  async syncDefaultVariantFromProduct(product: ProductRow) {
    return this.ensureDefaultVariant(product);
  }

  async syncProductFromStandardVariant(productId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { productId, isDefault: true, archivedAt: null },
    });
    if (!variant) return null;
    return this.prisma.product.update({
      where: { id: productId },
      data: {
        basePrice: variant.basePrice,
        manufacturingCost: variant.manufacturingCost,
        bomDefaults: asJson(variant.bomDefaults) as never,
        width: variant.width,
        height: variant.height,
        depth: variant.depth,
        seatHeight: variant.seatHeight,
        customMeasurements: asJson(variant.measurements) as never,
        adminNotes: variant.adminNotes,
        imageUrl: variant.imageUrl,
        galleryUrls: variant.galleryUrls ?? [],
      },
    });
  }

  async create(productId: string, dto: ProductVariantWrite, userId: string) {
    const product = await this.requireProduct(productId);
    const existingCodes = await this.prisma.productVariant.findMany({
      where: { productId },
      select: { code: true },
    });
    const isFirst = existingCodes.length === 0;
    const isDefault = dto.isDefault ?? isFirst;
    const code = isFirst
      ? String(dto.code ?? '').trim() || 'STD'
      : String(dto.code ?? '').trim() || nextVariantCode(existingCodes.map((r) => r.code));
    await this.assertCodeUnique(productId, code);
    const sku = (dto.sku?.trim() || `${product.sku}-${code}`).toUpperCase();
    await this.assertSkuUnique(sku);
    await this.assertOptionsExist(dto.options);
    if (isDefault) await this.clearDefault(productId);

    const copy = await this.fillVariantCopy(dto, {
      nameAr: dto.nameAr || (isFirst ? product.nameAr : ''),
      nameEn: dto.nameEn || (isFirst ? product.nameEn : ''),
    });

    const row = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        code,
        nameAr: copy.nameAr,
        nameEn: copy.nameEn,
        nameHe: dto.nameHe ?? null,
        isDefault,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        basePrice: dto.basePrice ?? null,
        manufacturingCost: null,
        bomDefaults: asJson(dto.bomDefaults ?? null),
        imageUrl: dto.imageUrl ?? null,
        galleryUrls: dto.galleryUrls ?? [],
        workflowId: dto.workflowId ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        depth: dto.depth ?? null,
        seatHeight: dto.seatHeight ?? null,
        measurements: asJson(persistMeasurementsRoundTrip(copy.measurements)),
        factoryNotesAr: copy.factoryNotesAr,
        factoryNotesEn: copy.factoryNotesEn,
        factoryNotesHe: dto.factoryNotesHe ?? null,
        adminNotes: dto.adminNotes ?? null,
        options: dto.options?.length
          ? {
              create: dto.options.map((opt) => ({
                specOptionValueId: opt.specOptionValueId,
                qty: opt.qty ?? null,
                note: opt.note ?? null,
              })),
            }
          : undefined,
      },
      include: VARIANT_INCLUDE,
    });
    if (isDefault) await this.syncProductFromStandardVariant(productId);
    await this.audit(userId, 'product-variant.create', 'ProductVariant', row.id, row);
    return row;
  }

  async update(productId: string, id: string, dto: ProductVariantWrite, userId: string) {
    const existing = await this.requireVariant(productId, id);
    if (dto.code && dto.code.trim() !== existing.code) {
      await this.assertCodeUnique(productId, dto.code.trim(), id);
    }
    if (dto.sku && dto.sku.trim() !== existing.sku) {
      await this.assertSkuUnique(dto.sku.trim(), id);
    }
    await this.assertOptionsExist(dto.options);
    if (dto.isDefault === true && !existing.isDefault) await this.clearDefault(productId);
    if (dto.isDefault === false && existing.isDefault) {
      throw new BadRequestException({
        code: 'DEFAULT_VARIANT_REQUIRED',
        message: 'A product must keep one default variant.',
      });
    }

    const copy = await this.fillVariantCopy(dto, {
      nameAr: existing.nameAr,
      nameEn: existing.nameEn,
    });

    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.productVariantOption.deleteMany({ where: { variantId: id } });
        if (dto.options.length) {
          await tx.productVariantOption.createMany({
            data: dto.options.map((opt) => ({
              variantId: id,
              specOptionValueId: opt.specOptionValueId,
              qty: opt.qty ?? null,
              note: opt.note ?? null,
            })),
          });
        }
      }
      return tx.productVariant.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() } : {}),
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.nameAr !== undefined ? { nameAr: copy.nameAr } : {}),
          ...(dto.nameAr !== undefined || dto.nameEn !== undefined ? { nameEn: copy.nameEn } : {}),
          ...(dto.nameHe !== undefined ? { nameHe: dto.nameHe } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          ...(dto.bomDefaults !== undefined ? { bomDefaults: asJson(dto.bomDefaults) } : {}),
          ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
          ...(dto.galleryUrls !== undefined ? { galleryUrls: dto.galleryUrls } : {}),
          ...(dto.workflowId !== undefined ? { workflowId: dto.workflowId } : {}),
          ...(dto.width !== undefined ? { width: dto.width } : {}),
          ...(dto.height !== undefined ? { height: dto.height } : {}),
          ...(dto.depth !== undefined ? { depth: dto.depth } : {}),
          ...(dto.seatHeight !== undefined ? { seatHeight: dto.seatHeight } : {}),
          ...(dto.measurements !== undefined
            ? { measurements: asJson(persistMeasurementsRoundTrip(copy.measurements)) }
            : {}),
          ...(dto.factoryNotesAr !== undefined ? { factoryNotesAr: copy.factoryNotesAr } : {}),
          ...(dto.factoryNotesAr !== undefined || dto.factoryNotesEn !== undefined
            ? { factoryNotesEn: copy.factoryNotesEn }
            : {}),
          ...(dto.factoryNotesHe !== undefined ? { factoryNotesHe: dto.factoryNotesHe } : {}),
          ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        },
        include: VARIANT_INCLUDE,
      });
    });
    if (row.isDefault) await this.syncProductFromStandardVariant(productId);
    if (dto.bomDefaults !== undefined || dto.workflowId !== undefined) {
      await this.deriveAndPersistCost(productId, id);
    }
    await this.audit(userId, 'product-variant.update', 'ProductVariant', id, row);
    return row;
  }

  async duplicate(productId: string, id: string, userId: string) {
    const src = await this.requireVariant(productId, id);
    const code = `${src.code}-COPY`;
    const uniqueCode = await this.nextCopyCode(productId, code);
    const sku = `${src.sku}-COPY-${Date.now().toString(36).toUpperCase()}`;
    const row = await this.prisma.productVariant.create({
      data: {
        productId,
        sku,
        code: uniqueCode,
        nameAr: src.nameAr,
        nameEn: `${src.nameEn} (copy)`,
        nameHe: src.nameHe,
        isDefault: false,
        isActive: false,
        sortOrder: src.sortOrder + 1,
        basePrice: src.basePrice,
        manufacturingCost: src.manufacturingCost,
        bomDefaults: src.bomDefaults ?? undefined,
        imageUrl: src.imageUrl,
        galleryUrls: src.galleryUrls,
        workflowId: src.workflowId,
        width: src.width,
        height: src.height,
        depth: src.depth,
        seatHeight: src.seatHeight,
        measurements: src.measurements ?? undefined,
        factoryNotesAr: src.factoryNotesAr,
        factoryNotesEn: src.factoryNotesEn,
        factoryNotesHe: src.factoryNotesHe,
        adminNotes: src.adminNotes,
        options: src.options.length
          ? {
              create: src.options.map((opt) => ({
                specOptionValueId: opt.specOptionValueId,
                qty: opt.qty,
                note: opt.note,
              })),
            }
          : undefined,
      },
      include: VARIANT_INCLUDE,
    });
    await this.copyStageConfig(src.id, row.id, productId);
    await this.audit(userId, 'product-variant.duplicate', 'ProductVariant', row.id, { from: id });
    return row;
  }

  async deactivate(productId: string, id: string, userId: string) {
    const existing = await this.requireVariant(productId, id);
    if (existing.isDefault) {
      throw new BadRequestException({
        code: 'DEFAULT_VARIANT_REQUIRED',
        message: 'The default variant cannot be deactivated. Create another default first.',
      });
    }
    const row = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: false },
      include: VARIANT_INCLUDE,
    });
    await this.audit(userId, 'product-variant.deactivate', 'ProductVariant', id, null);
    return row;
  }

  async activate(productId: string, id: string, userId: string) {
    await this.requireVariant(productId, id);
    const row = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: true, archivedAt: null },
      include: VARIANT_INCLUDE,
    });
    await this.audit(userId, 'product-variant.activate', 'ProductVariant', id, null);
    return row;
  }

  async remove(productId: string, id: string, userId: string) {
    return this.deactivate(productId, id, userId);
  }

  async cost(productId: string, id: string) {
    await this.requireVariant(productId, id);
    return this.deriveAndPersistCost(productId, id);
  }

  async copyFromStandard(productId: string, id: string, userId: string) {
    const target = await this.requireVariant(productId, id);
    const standard = await this.prisma.productVariant.findFirst({
      where: { productId, isDefault: true, archivedAt: null },
      include: VARIANT_INCLUDE,
    });
    if (!standard) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Standard variant not found.' });
    }
    if (standard.id === id) {
      throw new BadRequestException({
        code: 'ALREADY_STANDARD',
        message: 'This variant is already the standard.',
      });
    }
    await this.clearVariantStageConfig(productId, id);
    const row = await this.prisma.productVariant.update({
      where: { id },
      data: {
        basePrice: standard.basePrice,
        manufacturingCost: standard.manufacturingCost,
        bomDefaults: standard.bomDefaults ?? undefined,
        workflowId: standard.workflowId,
        width: standard.width,
        height: standard.height,
        depth: standard.depth,
        seatHeight: standard.seatHeight,
        measurements: standard.measurements ?? undefined,
        factoryNotesAr: standard.factoryNotesAr,
        factoryNotesEn: standard.factoryNotesEn,
        factoryNotesHe: standard.factoryNotesHe,
        adminNotes: standard.adminNotes,
      },
      include: VARIANT_INCLUDE,
    });
    if (standard.options.length) {
      await this.prisma.productVariantOption.deleteMany({ where: { variantId: id } });
      await this.prisma.productVariantOption.createMany({
        data: standard.options.map((opt) => ({
          variantId: id,
          specOptionValueId: opt.specOptionValueId,
          qty: opt.qty,
          note: opt.note,
        })),
      });
    }
    await this.copyStageConfig(standard.id, id, productId);
    const prices = await this.prisma.dealerPrice.findMany({ where: { variantId: standard.id } });
    await this.prisma.dealerPrice.deleteMany({ where: { variantId: id } });
    if (prices.length) {
      await this.prisma.dealerPrice.createMany({
        data: prices.map((row) => ({
          customerId: row.customerId,
          productId,
          variantId: id,
          price: row.price,
          currency: row.currency,
        })),
      });
    }
    await this.audit(userId, 'product-variant.copy-from-standard', 'ProductVariant', id, {
      from: standard.id,
    });
    return this.requireVariant(productId, id);
  }

  private defaultVariantData(product: ProductRow): Prisma.ProductVariantCreateInput {
    return {
      product: { connect: { id: product.id } },
      sku: `${product.sku}-STD`,
      code: 'STD',
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      nameHe: product.nameHe,
      isDefault: true,
      isActive: product.isActive,
      sortOrder: 0,
      basePrice: num(product.basePrice),
      manufacturingCost: num(product.manufacturingCost),
      bomDefaults: asJson(product.bomDefaults),
      imageUrl: product.imageUrl,
      galleryUrls: product.galleryUrls ?? [],
      width: num(product.width),
      height: num(product.height),
      depth: num(product.depth),
      seatHeight: num(product.seatHeight),
      measurements: asJson(measurementsFromProduct(product as ProductLike)),
      adminNotes: product.adminNotes,
    };
  }

  private async assertSkuUnique(sku: string, excludeId?: string) {
    const found = await this.prisma.productVariant.findFirst({
      where: { sku, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (found) {
      throw new ConflictException({ code: 'VARIANT_SKU_TAKEN', message: 'Variant SKU already exists.' });
    }
  }

  private async assertCodeUnique(productId: string, code: string, excludeId?: string) {
    const found = await this.prisma.productVariant.findFirst({
      where: { productId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (found) {
      throw new ConflictException({
        code: 'VARIANT_CODE_TAKEN',
        message: 'Variant code already exists on this product.',
      });
    }
  }

  private async nextCopyCode(productId: string, base: string) {
    let code = base;
    let n = 2;
    while (await this.prisma.productVariant.findFirst({ where: { productId, code } })) {
      code = `${base}-${n}`;
      n += 1;
    }
    return code;
  }

  private async clearDefault(productId: string) {
    await this.prisma.productVariant.updateMany({
      where: { productId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private async assertOptionsExist(options?: VariantOptionInput[]) {
    if (!options?.length) return;
    const ids = [...new Set(options.map((o) => o.specOptionValueId))];
    const found = await this.prisma.specOptionValue.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException({
        code: 'SPEC_OPTION_UNKNOWN',
        message: 'Every variant option must be a real SpecOptionValue.',
      });
    }
  }

  private async copyStageConfig(fromVariantId: string, toVariantId: string, productId: string) {
    const [materials, outputs, inputs, estimates, profiles, overrides] = await Promise.all([
      this.prisma.productStageMaterialInput.findMany({ where: { productId, variantId: fromVariantId } }),
      this.prisma.productStageInventoryOutput.findMany({ where: { productId, variantId: fromVariantId } }),
      this.prisma.productStageInventoryInput.findMany({ where: { productId, variantId: fromVariantId } }),
      this.prisma.productStageEstimate.findMany({ where: { productId, variantId: fromVariantId } }),
      this.prisma.productProductionProfile.findMany({ where: { productId, variantId: fromVariantId } }),
      this.prisma.productWorkflowStageOverride.findMany({ where: { productId, variantId: fromVariantId } }),
    ]);
    for (const row of profiles) {
      await this.prisma.productProductionProfile.create({
        data: {
          productId,
          variantId: toVariantId,
          totalStandardMinutes: row.totalStandardMinutes,
          setupMinutes: row.setupMinutes,
          complexityFactor: row.complexityFactor,
          defaultBatchSize: row.defaultBatchSize,
          minimumLeadTimeDays: row.minimumLeadTimeDays,
          bufferPercent: row.bufferPercent,
          isSchedulingEnabled: row.isSchedulingEnabled,
        },
      });
    }
    for (const row of estimates) {
      await this.prisma.productStageEstimate.create({
        data: {
          productId,
          variantId: toVariantId,
          stageDefinitionId: row.stageDefinitionId,
          setupMinutes: row.setupMinutes,
          minutesPerUnit: row.minutesPerUnit,
          fixedMinutes: row.fixedMinutes,
          quantityScalingMode: row.quantityScalingMode,
          batchSize: row.batchSize,
          batchMinutes: row.batchMinutes,
          maxParallelUnits: row.maxParallelUnits,
          workerCountRequired: row.workerCountRequired,
          overrideDepartmentId: row.overrideDepartmentId,
          isRequired: row.isRequired,
        },
      });
    }
    const outputIdMap = new Map<string, string>();
    for (const row of outputs) {
      const created = await this.prisma.productStageInventoryOutput.create({
        data: {
          productId,
          variantId: toVariantId,
          workflowNodeId: row.workflowNodeId,
          stageDefinitionId: row.stageDefinitionId,
          itemClass: row.itemClass,
          inventoryTracking: row.inventoryTracking,
          consumesRawMaterials: row.consumesRawMaterials,
          consumesSemiFinished: row.consumesSemiFinished,
          outputNameAr: row.outputNameAr,
          outputNameEn: row.outputNameEn,
          outputNameHe: row.outputNameHe,
          outputQtyPerUnit: row.outputQtyPerUnit,
          expectedPieceCount: row.expectedPieceCount,
          pieceLabels: row.pieceLabels ?? undefined,
          unit: row.unit,
          defaultWarehouseId: row.defaultWarehouseId,
          inventoryItemId: row.inventoryItemId,
        },
      });
      outputIdMap.set(row.id, created.id);
    }
    for (const row of inputs) {
      const outputId = outputIdMap.get(row.outputId) ?? row.outputId;
      await this.prisma.productStageInventoryInput.create({
        data: {
          productId,
          variantId: toVariantId,
          workflowNodeId: row.workflowNodeId,
          stageDefinitionId: row.stageDefinitionId,
          outputId,
          qtyPerUnit: row.qtyPerUnit,
        },
      });
    }
    for (const row of materials) {
      await this.prisma.productStageMaterialInput.create({
        data: {
          productId,
          variantId: toVariantId,
          workflowNodeId: row.workflowNodeId,
          stageDefinitionId: row.stageDefinitionId,
          inventoryItemId: row.inventoryItemId,
          qtyPerUnit: row.qtyPerUnit,
          unit: row.unit,
          required: row.required,
        },
      });
    }
    for (const row of overrides) {
      await this.prisma.productWorkflowStageOverride.create({
        data: {
          configurationId: row.configurationId,
          productId,
          variantId: toVariantId,
          stageDefinitionId: row.stageDefinitionId,
          workflowNodeId: row.workflowNodeId,
          applicability: row.applicability,
          estimatedMinutes: row.estimatedMinutes,
        },
      });
    }
  }

  private async fillVariantCopy(
    dto: ProductVariantWrite,
    fallback: { nameAr: string; nameEn: string },
  ) {
    const nameAr = (dto.nameAr ?? fallback.nameAr).trim() || fallback.nameAr;
    const nameEn =
      (await this.translation?.fillEnglishName(nameAr, dto.nameEn)) ||
      dto.nameEn?.trim() ||
      fallback.nameEn ||
      nameAr;
    const measurements = await Promise.all(
      (dto.measurements ?? []).map(async (row) => ({
        ...row,
        labelEn:
          (await this.translation?.fillEnglishName(row.labelAr, row.labelEn)) ||
          row.labelEn ||
          '',
      })),
    );
    const factoryNotesAr = dto.factoryNotesAr ?? null;
    const factoryNotesEn =
      (await this.translation?.fillEnglishProse(factoryNotesAr, dto.factoryNotesEn)) ||
      dto.factoryNotesEn ||
      null;
    return {
      nameAr,
      nameEn,
      measurements,
      factoryNotesAr,
      factoryNotesEn,
    };
  }

  private async clearVariantStageConfig(productId: string, variantId: string) {
    await Promise.all([
      this.prisma.productStageMaterialInput.deleteMany({ where: { productId, variantId } }),
      this.prisma.productStageInventoryInput.deleteMany({ where: { productId, variantId } }),
      this.prisma.productStageInventoryOutput.deleteMany({ where: { productId, variantId } }),
      this.prisma.productStageEstimate.deleteMany({ where: { productId, variantId } }),
      this.prisma.productProductionProfile.deleteMany({ where: { productId, variantId } }),
      this.prisma.productWorkflowStageOverride.deleteMany({ where: { productId, variantId } }),
    ]);
  }

  private async deriveAndPersistCost(productId: string, variantId: string) {
    const variant = await this.requireVariant(productId, variantId);
    const [items, txs, estimates, rates] = await Promise.all([
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
      this.prisma.productStageEstimate.findMany({
        where: { productId, OR: [{ variantId }, { variantId: null }] },
      }),
      this.prisma.laborRate.findMany({
        where: { userId: null },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);
    const materialCosts = buildMaterialCostMap({
      standardCosts: items,
      transactions: txs.map((tx) => ({
        sku: tx.inventoryItem.sku,
        unitCost: tx.unitCost,
        type: tx.type,
      })),
    });
    const materials = productionUnitCost(
      { bomDefaults: variant.bomDefaults, manufacturingCost: null },
      materialCosts,
    );
    const scoped = pickVariantScopedRows(
      estimates.map((row) => ({ ...row, variantId: row.variantId ?? null })),
      variantId,
    );
    let laborMinutes = 0;
    let laborCost = 0;
    const now = new Date();
    for (const estimate of scoped) {
      const minutes = calculateDurationMinutes({
        quantityScalingMode: estimate.quantityScalingMode,
        quantity: 1,
        setupMinutes: estimate.setupMinutes,
        minutesPerUnit: estimate.minutesPerUnit,
        fixedMinutes: estimate.fixedMinutes,
        batchSize: estimate.batchSize,
        batchMinutes: estimate.batchMinutes,
        maxParallelUnits: estimate.maxParallelUnits,
      });
      if (!(minutes > 0)) continue;
      laborMinutes += minutes;
      const rate = resolveHourlyRate(rates, now, { stageDefinitionId: estimate.stageDefinitionId });
      const money = laborMoneyFromMinutes(minutes, rate);
      if (money != null) laborCost += money;
    }
    const manufacturingCost = Number(materials.unitCost || 0) + laborCost;
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { manufacturingCost },
    });
    if (variant.isDefault) await this.syncProductFromStandardVariant(productId);
    return {
      materials: {
        total: materials.unitCost,
        breakdown: materials.breakdown,
      },
      labor: {
        minutes: laborMinutes,
        hours: laborMinutes / 60,
        cost: laborCost,
      },
      manufacturingCost,
    };
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
