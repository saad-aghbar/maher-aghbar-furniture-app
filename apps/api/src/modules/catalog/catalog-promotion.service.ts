import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@maher/database';
import { PrismaService } from '../../common/prisma.service';
import { SequenceService } from '../../common/sequence.service';
import { VariantsService, type ProductVariantWrite, type VariantOptionInput } from './variants.service';

function asSpec(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null) return null;
  const next = String(value).trim();
  return next || null;
}

function jsonArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

@Injectable()
export class CatalogPromotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequenceService,
    private readonly variants: VariantsService,
  ) {}

  private async loadLine(lineId: string) {
    const line = await this.prisma.salesOrderLine.findFirst({
      where: { id: lineId },
      include: {
        productionSetup: { include: { materialRequirements: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!line) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sales order line not found.' });
    return line;
  }

  private bomFromSetup(line: Awaited<ReturnType<CatalogPromotionService['loadLine']>>): Prisma.InputJsonValue | undefined {
    const materials = (line.productionSetup?.materialRequirements ?? [])
      .filter((row) => row.sku)
      .map((row) => ({
        sku: row.sku,
        qty: Number(row.expectedQty ?? 0) || 0,
      }));
    return materials.length ? ({ materials } as Prisma.InputJsonValue) : undefined;
  }

  private measurementsFromSpec(spec: Record<string, unknown>) {
    const existing = jsonArray<{ key: string; value?: number; unit?: string }>(spec.measurements);
    if (existing?.length) return existing;
    const rows = [
      num(spec.width) != null
        ? { key: 'width', labelAr: 'ص', labelEn: 'W', value: num(spec.width), unit: str(spec.widthUnit) || 'cm' }
        : null,
      num(spec.height) != null
        ? { key: 'height', labelAr: 'ع', labelEn: 'H', value: num(spec.height), unit: str(spec.heightUnit) || 'cm' }
        : null,
      num(spec.depth) != null
        ? { key: 'depth', labelAr: 'عمق', labelEn: 'D', value: num(spec.depth), unit: str(spec.depthUnit) || 'cm' }
        : null,
    ].filter(Boolean);
    return rows.length ? rows : undefined;
  }

  private async optionLinks(spec: Record<string, unknown>): Promise<VariantOptionInput[]> {
    const codes = [str(spec.foamDensity), str(spec.woodType), str(spec.finish), str(spec.woodColor)].filter(
      (code): code is string => Boolean(code),
    );
    if (!codes.length) return [];
    const values = await this.prisma.specOptionValue.findMany({
      where: { isActive: true, code: { in: codes } },
      select: { id: true },
    });
    return values.map((row) => ({ specOptionValueId: row.id }));
  }

  private variantWrite(
    spec: Record<string, unknown>,
    line: Awaited<ReturnType<CatalogPromotionService['loadLine']>>,
    options: VariantOptionInput[],
  ): ProductVariantWrite {
    const label = str(spec.variantLabel) || str(line.variantLabel) || line.description;
    const code =
      (str(spec.variantSku) || str(line.variantSku) || str(spec.variantLabel) || 'CUSTOM')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .slice(0, 24) || 'CUSTOM';
    return {
      code,
      nameAr: label,
      nameEn: label,
      width: num(spec.width),
      height: num(spec.height),
      depth: num(spec.depth),
      measurements: this.measurementsFromSpec(spec) as ProductVariantWrite['measurements'],
      bomDefaults: this.bomFromSetup(line),
      factoryNotesAr: str(spec.factoryNotes) || undefined,
      adminNotes: `Promoted from SO line ${line.id}; order history unchanged.`,
      options,
    };
  }

  async createProductFromOrderLine(lineId: string, userId: string) {
    const line = await this.loadLine(lineId);
    const spec = asSpec(line.orderSpec);
    const sku = await this.sequences.next('PRD', 'PRD');
    const name = str(spec.productName) || line.description || 'Custom furniture';
    const row = await this.prisma.product.create({
      data: {
        sku,
        nameAr: str(spec.nameAr) || name,
        nameEn: str(spec.nameEn) || name,
        nameHe: str(spec.nameHe),
        description: `Promoted from order line ${lineId}. History unchanged.`,
        basePrice: Number(line.unitPrice) || 0,
        unit: 'pcs',
        isActive: false,
        width: num(spec.width),
        height: num(spec.height),
        depth: num(spec.depth),
        seatHeight: num(spec.seatHeight),
        bomDefaults: this.bomFromSetup(line),
        adminNotes: `Promoted from SO line ${lineId}; orderSpec snapshot was not mutated.`,
      },
    });
    const options = await this.optionLinks(spec);
    await this.variants.create(row.id, this.variantWrite(spec, line, options), userId);
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'product.promote-from-order-line',
        entityType: 'Product',
        entityId: row.id,
        newValues: { lineId, salesOrderLineUnchanged: true } as Prisma.InputJsonValue,
      },
    });
    return this.prisma.product.findFirst({ where: { id: row.id }, include: { variants: true, category: true } });
  }

  async createVariantFromOrderLine(productId: string, lineId: string, userId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Product not found.' });
    const line = await this.loadLine(lineId);
    if (line.productId && line.productId !== productId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Line belongs to a different catalog product.',
      });
    }
    const spec = asSpec(line.orderSpec);
    const options = await this.optionLinks(spec);
    const row = await this.variants.create(productId, this.variantWrite(spec, line, options), userId);
    await this.prisma.auditEvent.create({
      data: {
        userId,
        action: 'product-variant.promote-from-order-line',
        entityType: 'ProductVariant',
        entityId: row.id,
        newValues: { lineId, productId, salesOrderLineUnchanged: true } as Prisma.InputJsonValue,
      },
    });
    return row;
  }
}
