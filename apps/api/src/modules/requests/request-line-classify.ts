import { Prisma, type ManufacturingComplexity } from '@maher/database';
import {
  classifyManufacturingComplexity,
  normalizeOrderFabrics,
  primaryFabric,
  type OrderLineClassifyInput,
} from '@maher/types';
import type { RequestItemDto } from './dto/request.dto';

export type CatalogProductDims = {
  id: string;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  seatHeight?: unknown;
  material?: string | null;
  customMeasurements?: unknown;
  imageUrl?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function classifyRequestItemDto(
  item: RequestItemDto,
  catalog?: CatalogProductDims | null,
): ManufacturingComplexity {
  const input: OrderLineClassifyInput = {
    productId: item.productId,
    width: item.width,
    height: item.height,
    depth: item.depth,
    material: item.material,
    fabricType: item.fabric,
    fabricColor: item.color,
    notes: item.notes,
    description: item.description,
    customMeasurements: item.customMeasurements,
    catalog: catalog
      ? {
          width: num(catalog.width),
          height: num(catalog.height),
          depth: num(catalog.depth),
          seatHeight: num(catalog.seatHeight),
          material: catalog.material,
          customMeasurements: catalog.customMeasurements,
        }
      : null,
  };
  return classifyManufacturingComplexity(input);
}

export function mapRequestItemCreate(
  item: RequestItemDto,
  index: number,
  catalog?: CatalogProductDims | null,
): Prisma.RequestItemUncheckedCreateWithoutRequestInput {
  const manufacturingComplexity = classifyRequestItemDto(item, catalog);
  const fabrics = normalizeOrderFabrics(item.fabrics, {
    type: item.fabric,
    color: item.color,
  });
  const primary = primaryFabric(fabrics);
  return {
    category: item.category,
    productId: item.productId,
    productName: item.productName,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit ?? 'pcs',
    width: item.width,
    height: item.height,
    depth: item.depth,
    material: item.material,
    fabricType: primary?.type ?? item.fabric,
    fabricColor: primary?.color ?? item.color,
    fabricCode: primary?.code ?? undefined,
    fabrics: fabrics.length
      ? (fabrics as unknown as Prisma.InputJsonValue)
      : undefined,
    notes: item.notes,
    customMeasurements: item.customMeasurements?.length
      ? (item.customMeasurements as unknown as Prisma.InputJsonValue)
      : undefined,
    manufacturingComplexity,
    sortOrder: index,
  };
}

export async function loadCatalogMap(
  prisma: { product: { findMany: Function } },
  items: Array<{ productId?: string | null }>,
): Promise<Map<string, CatalogProductDims>> {
  const ids = [
    ...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return new Map();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      width: true,
      height: true,
      depth: true,
      seatHeight: true,
      customMeasurements: true,
      imageUrl: true,
      nameEn: true,
      nameAr: true,
    },
  });
  return new Map(rows.map((r: CatalogProductDims) => [r.id, r]));
}
