import { Prisma, type ManufacturingComplexity } from '@maher/database';
import {
  catalogDimRefFromEffective,
  classifyManufacturingComplexity,
  normalizeOrderFabrics,
  primaryFabric,
  resolveEffectiveVariant,
  type CatalogDimRef,
  type OrderLineClassifyInput,
  type OrderSpecOption,
  type ProductLike,
  type ProductVariantLike,
  type VariantOptionRef,
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
  sku?: string | null;
  nameHe?: string | null;
  catalog?: CatalogDimRef | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  options?: OrderSpecOption[] | null;
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function catalogLookupKey(productId: string, variantId?: string | null): string {
  return `${productId}::${variantId ?? ''}`;
}

function asOptionRefs(
  rows:
    | Array<{
        specOptionValueId?: string;
        qty?: unknown;
        note?: string | null;
        specOptionValue?: {
          code?: string | null;
          nameAr?: string | null;
          nameEn?: string | null;
          nameHe?: string | null;
          inventoryItemId?: string | null;
          group?: { code?: string | null } | null;
        } | null;
      }>
    | null
    | undefined,
): VariantOptionRef[] {
  return (rows ?? []).map((row) => ({
    specOptionValueId: row.specOptionValueId ?? null,
    groupCode: row.specOptionValue?.group?.code ?? null,
    code: row.specOptionValue?.code ?? null,
    nameAr: row.specOptionValue?.nameAr ?? null,
    nameEn: row.specOptionValue?.nameEn ?? null,
    nameHe: row.specOptionValue?.nameHe ?? null,
    qty: row.qty != null ? Number(row.qty) : null,
    note: row.note ?? null,
    inventoryItemId: row.specOptionValue?.inventoryItemId ?? null,
  }));
}

export function catalogDimsFromProduct(
  product: ProductLike & { variants?: unknown },
  variantId?: string | null,
): CatalogProductDims {
  const variants = (product.variants ?? []) as Array<
    ProductVariantLike & {
      options?: Array<{
        specOptionValueId?: string;
        qty?: unknown;
        note?: string | null;
        specOptionValue?: {
          code?: string | null;
          nameAr?: string | null;
          nameEn?: string | null;
          nameHe?: string | null;
          inventoryItemId?: string | null;
          group?: { code?: string | null } | null;
        } | null;
      }>;
    }
  >;
  const variantRow =
    (variantId ? variants.find((row) => row.id === variantId) : null) ??
    variants.find((row) => row.isDefault) ??
    null;
  const variant: ProductVariantLike | null = variantRow
    ? {
        ...variantRow,
        options: asOptionRefs(variantRow.options),
      }
    : null;
  const effective = resolveEffectiveVariant({ product, variant });
  const catalog = catalogDimRefFromEffective(effective);
  return {
    id: product.id,
    sku: product.sku,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    nameHe: product.nameHe ?? null,
    width: catalog.width,
    height: catalog.height,
    depth: catalog.depth,
    seatHeight: catalog.seatHeight,
    customMeasurements: catalog.customMeasurements,
    imageUrl: effective.imageUrl,
    catalog: {
      width: num(catalog.width),
      height: num(catalog.height),
      depth: num(catalog.depth),
      seatHeight: num(catalog.seatHeight),
      customMeasurements: catalog.customMeasurements,
      standardOptions: catalog.standardOptions,
      options: catalog.options,
      composition: catalog.composition,
      includedItems: catalog.includedItems,
    },
    variantId: effective.id,
    variantSku: effective.sku,
    variantLabel: effective.nameAr || effective.nameEn,
    options: catalog.options,
  };
}

export function classifyRequestItemDto(
  item: RequestItemDto,
  catalog?: CatalogProductDims | null,
): ManufacturingComplexity {
  const catalogRef: CatalogDimRef | null = catalog?.catalog
    ? catalog.catalog
    : catalog
      ? {
          width: num(catalog.width),
          height: num(catalog.height),
          depth: num(catalog.depth),
          seatHeight: num(catalog.seatHeight),
          material: catalog.material,
          customMeasurements: catalog.customMeasurements,
          options: catalog.options,
        }
      : null;
  const input: OrderLineClassifyInput = {
    productId: item.productId,
    variantId: item.variantId,
    width: item.width,
    height: item.height,
    depth: item.depth,
    material: item.material,
    fabricType: item.fabric,
    fabricColor: item.color,
    woodType: item.woodType,
    woodColor: item.woodColor,
    foamDensity: item.foamDensity,
    finish: item.finish,
    accessories: item.accessories,
    notes: item.notes,
    description: item.description,
    customMeasurements: item.customMeasurements,
    options: item.options,
    catalog: catalogRef,
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
    variantId: item.variantId ?? catalog?.variantId ?? undefined,
    variantSku: item.variantSku ?? catalog?.variantSku ?? undefined,
    variantLabel: item.variantLabel ?? catalog?.variantLabel ?? undefined,
    productName: item.productName,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit ?? 'pcs',
    width: item.width,
    height: item.height,
    depth: item.depth,
    material: item.material,
    woodType: item.woodType,
    woodColor: item.woodColor,
    foamDensity: item.foamDensity,
    finish: item.finish,
    accessories: item.accessories,
    orientation: item.orientation,
    options: item.options?.length
      ? (item.options as unknown as Prisma.InputJsonValue)
      : undefined,
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
    photoDocumentIds: item.photoDocumentIds?.length
      ? (item.photoDocumentIds as unknown as Prisma.InputJsonValue)
      : undefined,
    primaryImageDocumentId: item.primaryImageDocumentId,
    manufacturingComplexity,
    sortOrder: index,
  };
}

export async function loadCatalogMap(
  // Prisma `findMany` overloads are not expressible as a single call signature.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  prisma: { product: { findMany: Function } },
  items: Array<{ productId?: string | null; variantId?: string | null }>,
): Promise<Map<string, CatalogProductDims>> {
  const ids = [
    ...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return new Map();
  const rows = (await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      sku: true,
      width: true,
      height: true,
      depth: true,
      seatHeight: true,
      customMeasurements: true,
      imageUrl: true,
      nameEn: true,
      nameAr: true,
      nameHe: true,
      variants: {
        where: { archivedAt: null },
        select: {
          id: true,
          productId: true,
          sku: true,
          code: true,
          nameAr: true,
          nameEn: true,
          nameHe: true,
          isDefault: true,
          isActive: true,
          width: true,
          height: true,
          depth: true,
          seatHeight: true,
          measurements: true,
          composition: true,
          includedItems: true,
          imageUrl: true,
          options: {
            include: {
              specOptionValue: {
                include: { group: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  })) as Array<ProductLike & { variants?: ProductVariantLike[] }>;

  const map = new Map<string, CatalogProductDims>();
  for (const product of rows) {
    const defaultDims = catalogDimsFromProduct(product, null);
    map.set(product.id, defaultDims);
    map.set(catalogLookupKey(product.id, null), defaultDims);
    for (const item of items.filter((i) => i.productId === product.id)) {
      const dims = catalogDimsFromProduct(product, item.variantId ?? null);
      map.set(catalogLookupKey(product.id, item.variantId ?? null), dims);
      if (item.variantId) map.set(item.variantId, dims);
    }
  }
  return map;
}

export function catalogForItem(
  catalogMap: Map<string, CatalogProductDims>,
  item: { productId?: string | null; variantId?: string | null },
): CatalogProductDims | null {
  if (!item.productId) return null;
  return (
    catalogMap.get(catalogLookupKey(item.productId, item.variantId ?? null)) ??
    catalogMap.get(item.productId) ??
    null
  );
}
