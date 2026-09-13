import { Prisma } from '@maher/database';
import type { RequestItemDto, RequestItemOptionDto } from './dto/request.dto';
import type { FabricSelectionDto } from '../../common/dto/fabric-selection.dto';
import { classifyRequestItemDto, type CatalogProductDims } from './request-line-classify';

export type VerifySpecFields = {
  productName?: string;
  width?: string | number;
  height?: string | number;
  depth?: string | number;
  foamDensity?: string;
  woodType?: string;
  woodColor?: string;
  finish?: string;
  accessories?: string;
  orientation?: string;
  notes?: string;
  fabric?: string;
  color?: string;
  customMeasurements?: Array<{ label?: string; value?: string }>;
  options?: RequestItemOptionDto[];
  fabrics?: FabricSelectionDto[];
  photoDocumentIds?: string[];
  primaryImageDocumentId?: string | null;
};

type StoredItem = {
  productName?: string | null;
  productId?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantLabel?: string | null;
  quantity?: unknown;
  unit?: string | null;
  description?: string | null;
  width?: unknown;
  height?: unknown;
  depth?: unknown;
  material?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabrics?: unknown;
  woodType?: string | null;
  woodColor?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  orientation?: string | null;
  notes?: string | null;
  customMeasurements?: unknown;
  options?: unknown;
  photoDocumentIds?: unknown;
  primaryImageDocumentId?: string | null;
  sortOrder?: number | null;
};

function asStr(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

function asNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asMeasurements(value: unknown): RequestItemDto['customMeasurements'] {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as { label?: unknown; value?: unknown };
      const label = asStr(rec.label);
      const v = asStr(rec.value);
      if (!label || !v) return null;
      return { label, value: v };
    })
    .filter((row): row is { label: string; value: string } => Boolean(row));
  return rows;
}

function asOptions(value: unknown): RequestItemOptionDto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((row) => row && typeof row === 'object') as RequestItemOptionDto[];
}

function asFabrics(value: unknown): FabricSelectionDto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((row) => row && typeof row === 'object') as FabricSelectionDto[];
}

function asPhotoIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((id) => String(id ?? '').trim()).filter(Boolean);
}

function hasOwn(fields: VerifySpecFields, key: keyof VerifySpecFields): boolean {
  return Object.prototype.hasOwnProperty.call(fields, key);
}

export function mergeVerifySpecItem(
  current: StoredItem,
  fields: VerifySpecFields,
): RequestItemDto {
  const customMeasurements = hasOwn(fields, 'customMeasurements')
    ? asMeasurements(fields.customMeasurements) ?? []
    : asMeasurements(current.customMeasurements);
  const options = hasOwn(fields, 'options')
    ? asOptions(fields.options)
    : asOptions(current.options);
  const fabrics = hasOwn(fields, 'fabrics')
    ? asFabrics(fields.fabrics)
    : asFabrics(current.fabrics);
  const photoDocumentIds = hasOwn(fields, 'photoDocumentIds')
    ? asPhotoIds(fields.photoDocumentIds) ?? []
    : asPhotoIds(current.photoDocumentIds);
  const productName =
    (hasOwn(fields, 'productName') ? asStr(fields.productName) : asStr(current.productName)) ??
    'Item';
  return {
    productName,
    productId: current.productId ?? undefined,
    variantId: current.variantId ?? undefined,
    variantSku: current.variantSku ?? undefined,
    variantLabel: current.variantLabel ?? undefined,
    quantity: asNum(current.quantity) ?? 1,
    unit: current.unit ?? undefined,
    description: current.description ?? undefined,
    width: hasOwn(fields, 'width') ? asNum(fields.width) : asNum(current.width),
    height: hasOwn(fields, 'height') ? asNum(fields.height) : asNum(current.height),
    depth: hasOwn(fields, 'depth') ? asNum(fields.depth) : asNum(current.depth),
    material: current.material ?? undefined,
    fabric: hasOwn(fields, 'fabric') ? asStr(fields.fabric) : (current.fabricType ?? undefined),
    color: hasOwn(fields, 'color') ? asStr(fields.color) : (current.fabricColor ?? undefined),
    fabrics,
    woodType: hasOwn(fields, 'woodType') ? asStr(fields.woodType) : (current.woodType ?? undefined),
    woodColor: hasOwn(fields, 'woodColor')
      ? asStr(fields.woodColor)
      : (current.woodColor ?? undefined),
    foamDensity: hasOwn(fields, 'foamDensity')
      ? asStr(fields.foamDensity)
      : (current.foamDensity ?? undefined),
    finish: hasOwn(fields, 'finish') ? asStr(fields.finish) : (current.finish ?? undefined),
    accessories: hasOwn(fields, 'accessories')
      ? asStr(fields.accessories)
      : (current.accessories ?? undefined),
    orientation: hasOwn(fields, 'orientation')
      ? asStr(fields.orientation)
      : (current.orientation ?? undefined),
    notes: hasOwn(fields, 'notes') ? asStr(fields.notes) : (current.notes ?? undefined),
    customMeasurements,
    options,
    photoDocumentIds,
    primaryImageDocumentId: hasOwn(fields, 'primaryImageDocumentId')
      ? asStr(fields.primaryImageDocumentId) ?? undefined
      : (current.primaryImageDocumentId ?? undefined),
  };
}

export function verifySpecUpdateData(
  merged: RequestItemDto,
  catalog: CatalogProductDims | null,
  sortOrder: number,
): Prisma.RequestItemUncheckedUpdateInput {
  const manufacturingComplexity = classifyRequestItemDto(merged, catalog);
  const fabrics = merged.fabrics?.length
    ? (merged.fabrics as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const options = merged.options?.length
    ? (merged.options as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const customMeasurements = merged.customMeasurements?.length
    ? (merged.customMeasurements as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  const photoDocumentIds = merged.photoDocumentIds?.length
    ? (merged.photoDocumentIds as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;
  return {
    productName: merged.productName,
    quantity: merged.quantity,
    unit: merged.unit ?? 'pcs',
    description: merged.description ?? null,
    width: merged.width ?? null,
    height: merged.height ?? null,
    depth: merged.depth ?? null,
    material: merged.material ?? null,
    fabricType: merged.fabric ?? null,
    fabricColor: merged.color ?? null,
    fabrics,
    woodType: merged.woodType ?? null,
    woodColor: merged.woodColor ?? null,
    foamDensity: merged.foamDensity ?? null,
    finish: merged.finish ?? null,
    accessories: merged.accessories ?? null,
    orientation: merged.orientation ?? null,
    notes: merged.notes ?? null,
    customMeasurements,
    options,
    photoDocumentIds,
    primaryImageDocumentId: merged.primaryImageDocumentId ?? null,
    manufacturingComplexity,
    sortOrder,
  };
}
