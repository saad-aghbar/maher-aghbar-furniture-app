/**
 * Piece 9 — Quality / rework / packaging presentation + recommendation helpers.
 * No new Custody/QC tables — reuse QualityInspection + ReworkRequest.
 */

import { buildCatalogDiff, type CatalogDiffRow, type CatalogDimRef } from '@maher/types';

export const QC_PASS_RESULTS = ['PASSED', 'PASSED_WITH_NOTES'] as const;
export const QC_FAIL_RESULTS = ['FAILED_REWORK_REQUIRED', 'BLOCKED'] as const;

export type DefectCategory =
  | 'CARPENTRY'
  | 'ASSEMBLY'
  | 'UPHOLSTERY'
  | 'PAINT_FINISH'
  | 'DIMENSIONS'
  | 'FABRIC'
  | 'HARDWARE'
  | 'DAMAGE'
  | 'WRONG_SPEC'
  | 'MISSING_COMPONENT'
  | 'OTHER';

/** Map human defect category → preferred prior PRODUCTION stage code. */
export const DEFECT_CATEGORY_STAGE_HINT: Record<DefectCategory, string[]> = {
  CARPENTRY: ['CARPENTRY', 'FRAME', 'CUT', 'WOOD'],
  ASSEMBLY: ['ASSEMBLY', 'CARPENTRY', 'FRAME'],
  UPHOLSTERY: ['UPHOLSTERY', 'FOAM', 'FABRIC'],
  PAINT_FINISH: ['PAINT', 'FINISH', 'STAIN'],
  DIMENSIONS: ['CARPENTRY', 'FRAME', 'CUT'],
  FABRIC: ['UPHOLSTERY', 'FABRIC'],
  HARDWARE: ['ASSEMBLY', 'HARDWARE'],
  DAMAGE: ['UPHOLSTERY', 'ASSEMBLY', 'CARPENTRY'],
  WRONG_SPEC: ['UPHOLSTERY', 'ASSEMBLY', 'CARPENTRY'],
  MISSING_COMPONENT: ['ASSEMBLY', 'PACKAGING', 'CARPENTRY'],
  OTHER: ['ASSEMBLY', 'UPHOLSTERY', 'CARPENTRY'],
};

export function isQcPassResult(result: string | null | undefined): boolean {
  return Boolean(result && (QC_PASS_RESULTS as readonly string[]).includes(result));
}

export function isQcFailResult(result: string | null | undefined): boolean {
  return Boolean(result && (QC_FAIL_RESULTS as readonly string[]).includes(result));
}

export function isQualityExecutionKind(executionKind: string | null | undefined): boolean {
  return String(executionKind ?? '').toUpperCase() === 'QUALITY';
}

export function isInspectionStageCode(code: string | null | undefined): boolean {
  return String(code ?? '').toUpperCase() === 'INSPECTION';
}

export function isPackagingStageCode(code: string | null | undefined): boolean {
  const c = String(code ?? '').toUpperCase();
  return c === 'PACKAGING' || c === 'PACK';
}

export type EligibleReworkStage = {
  stageInstanceId: string;
  stageCode: string;
  nameEn: string;
  nameAr?: string | null;
  executionKind?: string | null;
};

/**
 * Recommend an eligible prior PRODUCTION stage for rework (never Inspection/Packaging/Delivery).
 */
export function recommendReworkStage(params: {
  category?: string | null;
  stages: EligibleReworkStage[];
}): { recommended: EligibleReworkStage | null; eligible: EligibleReworkStage[] } {
  const eligible = params.stages.filter((s) => {
    const kind = String(s.executionKind ?? 'PRODUCTION').toUpperCase();
    if (kind === 'QUALITY' || kind === 'LOGISTICS') return false;
    const code = String(s.stageCode).toUpperCase();
    if (code === 'INSPECTION' || code === 'PACKAGING' || code === 'PACK' || code === 'DELIVERY') {
      return false;
    }
    return true;
  });

  const cat = String(params.category ?? 'OTHER').toUpperCase() as DefectCategory;
  const hints = DEFECT_CATEGORY_STAGE_HINT[cat] ?? DEFECT_CATEGORY_STAGE_HINT.OTHER;

  let recommended: EligibleReworkStage | null = null;
  for (const hint of hints) {
    const hit = eligible.find((s) => String(s.stageCode).toUpperCase().includes(hint));
    if (hit) {
      recommended = hit;
      break;
    }
  }
  if (!recommended && eligible.length) {
    recommended = eligible[eligible.length - 1] ?? null;
  }
  return { recommended, eligible };
}

export type QualityTimelineEvent = {
  at: string;
  kind:
    | 'INSPECTION_STARTED'
    | 'INSPECTION_PASSED'
    | 'INSPECTION_FAILED'
    | 'REWORK_STARTED'
    | 'REWORK_COMPLETED'
    | 'REWORK_MATERIAL'
    | 'REINSPECTION'
    | 'PACKAGING_COMPLETED'
    | 'FIN_POSTED';
  titleEn: string;
  detailEn?: string | null;
  actorName?: string | null;
  meta?: Record<string, unknown>;
};

const DIM_FIELDS = ['width', 'height', 'depth', 'seatHeight'] as const;
type DimField = (typeof DIM_FIELDS)[number];

const DIM_ALIASES: Record<DimField, string[]> = {
  width: ['width', 'W', 'w'],
  height: ['height', 'H', 'h'],
  depth: ['depth', 'D', 'd'],
  seatHeight: ['seatHeight', 'seat', 'Seat', 'seat_height'],
};

export type InspectionMaterialInput = {
  sku?: string | null;
  displayName?: string | null;
  category?: string | null;
  unit?: string | null;
  expectedQty?: unknown;
  fabricRole?: string | null;
  requestedFabricLabel?: string | null;
  inventoryItem?: {
    sku?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    category?: string | null;
    unit?: string | null;
  } | null;
};

export type InspectionBomLine = {
  sku: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  qty: number;
  unit?: string | null;
  category?: string | null;
  fabricRole?: string | null;
};

export type InspectionNamedMeasurement = {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  catalogValue: string | null;
};

export type InspectionManufacturingSpec = {
  complexity: string | null;
  orderDimensions: Record<string, unknown> | null;
  catalogDimensions: Record<string, unknown> | null;
  measurements: InspectionNamedMeasurement[] | null;
  factoryNotes: string | null;
  requestedFabricLabel: string | null;
  manufacturingName: string | null;
  color: string | null;
  fabric: {
    sku: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe: string | null;
    color?: string | null;
  } | null;
  wood: {
    sku: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe: string | null;
  } | null;
  foam: {
    sku: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe: string | null;
  } | null;
  bom: InspectionBomLine[];
  lineSpec: string | null;
  changesFromCatalog: CatalogDiffRow[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

export function pickDimField(
  rec: Record<string, unknown> | null | undefined,
  field: DimField,
): unknown {
  if (!rec) return undefined;
  for (const key of DIM_ALIASES[field]) {
    if (rec[key] != null && String(rec[key]).trim() !== '') return rec[key];
  }
  return undefined;
}

export function coalesceDimRecord(
  sources: Array<unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const field of DIM_FIELDS) {
    for (const source of sources) {
      const rec = asRecord(source);
      const v = pickDimField(rec, field);
      if (v != null && String(v).trim() !== '') {
        out[field] = v;
        break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

function isFabricMaterial(row: InspectionMaterialInput): boolean {
  if (row.fabricRole) return true;
  if (row.requestedFabricLabel) return true;
  const cat = String(row.category ?? row.inventoryItem?.category ?? '').toUpperCase();
  return cat.includes('FABRIC');
}

function isWoodMaterial(row: InspectionMaterialInput): boolean {
  const cat = String(row.category ?? row.inventoryItem?.category ?? '').toUpperCase();
  return cat.includes('WOOD') || cat.includes('TIMBER') || cat.includes('LUMBER');
}

function isFoamMaterial(row: InspectionMaterialInput): boolean {
  const cat = String(row.category ?? row.inventoryItem?.category ?? '').toUpperCase();
  return cat.includes('FOAM');
}

function colorFromSpec(orderSpec: unknown): string | null {
  const rec = asRecord(orderSpec);
  if (!rec) return null;
  const fabric = asRecord(rec.fabric);
  return asText(rec.color) ?? asText(fabric?.color) ?? asText(rec.requestedColor);
}

function fabricFromOrderSpec(orderSpec: unknown): {
  sku: string | null;
  nameEn: string | null;
  nameAr: string | null;
  nameHe: string | null;
  color: string | null;
} | null {
  const rec = asRecord(orderSpec);
  const fabric = asRecord(rec?.fabric);
  if (!fabric) return null;
  const nameEn =
    asText(fabric.type) ?? asText(fabric.nameEn) ?? asText(fabric.name);
  const sku = asText(fabric.code) ?? asText(fabric.sku);
  const color = asText(fabric.color);
  if (!nameEn && !sku && !color) return null;
  return {
    sku,
    nameEn,
    nameAr: asText(fabric.nameAr),
    nameHe: asText(fabric.nameHe),
    color,
  };
}

function stringifyScalarSpec(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return asText(value);
  if (typeof value !== 'object' || Array.isArray(value)) return asText(value);
  const skip = new Set([
    'width',
    'height',
    'depth',
    'seatHeight',
    'W',
    'H',
    'D',
    'w',
    'h',
    'd',
    'fabric',
    'catalogDimensions',
    'requestedDimensions',
    'productId',
    'productName',
    'quantity',
    'manufacturingComplexity',
    'color',
  ]);
  const parts = Object.entries(value as Record<string, unknown>)
    .filter(([k, v]) => !skip.has(k) && v != null && typeof v !== 'object' && String(v).trim())
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? parts.join(' · ') : null;
}

export function normalizeInspectionMeasurements(
  value: unknown,
): InspectionNamedMeasurement[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const rows = value
      .map((row, index) => {
        const rec = asRecord(row);
        if (!rec) return null;
        const label =
          asText(rec.label) ??
          asText(rec.nameEn) ??
          asText(rec.nameAr) ??
          asText(rec.key) ??
          asText(rec.name);
        const raw = rec.value ?? rec.catalogValue;
        if (!label && (raw == null || String(raw).trim() === '')) return null;
        return {
          key: asText(rec.key) ?? asText(rec.id) ?? `m${index}`,
          label: label ?? `m${index}`,
          value: raw == null ? '' : String(raw),
          unit: asText(rec.unit) ?? null,
          catalogValue: rec.catalogValue == null ? null : String(rec.catalogValue),
        };
      })
      .filter((row): row is InspectionNamedMeasurement => row != null);
    return rows.length ? rows : null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  const rows = Object.entries(rec)
    .filter(([, v]) => v != null && typeof v !== 'object' && String(v).trim())
    .map(([key, v]) => ({
      key,
      label: key,
      value: String(v),
      unit: null,
      catalogValue: null,
    }));
  return rows.length ? rows : null;
}

function mapBom(materials: InspectionMaterialInput[]): InspectionBomLine[] {
  return materials.map((m) => ({
    sku: m.sku ?? m.inventoryItem?.sku ?? '',
    nameEn: m.displayName ?? m.inventoryItem?.nameEn ?? m.sku ?? null,
    nameAr: m.inventoryItem?.nameAr ?? null,
    nameHe: m.inventoryItem?.nameHe ?? null,
    qty: Number(m.expectedQty) || 0,
    unit: m.unit || m.inventoryItem?.unit || 'pcs',
    category: m.category ?? m.inventoryItem?.category ?? null,
    fabricRole: m.fabricRole ?? null,
  }));
}

export function buildManufacturingSpecForFloor(input: {
  setup?: {
    manufacturingComplexity?: string | null;
    orderDimensions?: unknown;
    catalogDimensions?: unknown;
    measurements?: unknown;
    factoryNotes?: string | null;
    requestedFabricLabel?: string | null;
    manufacturingName?: string | null;
    materialRequirements?: InspectionMaterialInput[];
  } | null;
  salesOrderLine?: {
    manufacturingComplexity?: string | null;
    specifications?: string | null;
    orderSpec?: unknown;
  } | null;
  product?: {
    width?: unknown;
    height?: unknown;
    depth?: unknown;
    seatHeight?: unknown;
    customMeasurements?: unknown;
  } | null;
}): InspectionManufacturingSpec {
  const setup = input.setup ?? null;
  const line = input.salesOrderLine ?? null;
  const product = input.product ?? null;
  const orderSpec = line?.orderSpec;
  const materials = setup?.materialRequirements ?? [];
  const bom = mapBom(materials);
  const complexity = String(
    setup?.manufacturingComplexity ?? line?.manufacturingComplexity ?? '',
  ).toUpperCase();

  const productDims = product
    ? coalesceDimRecord([
        {
          width: product.width,
          height: product.height,
          depth: product.depth,
          seatHeight: product.seatHeight,
        },
      ])
    : null;
  const specRec = asRecord(orderSpec);
  const orderDimensions = coalesceDimRecord([
    setup?.orderDimensions,
    specRec?.requestedDimensions,
    orderSpec,
  ]);
  const catalogDimensions = coalesceDimRecord([
    setup?.catalogDimensions,
    specRec?.catalogDimensions,
    productDims,
  ]);

  const fabricMaterial = materials.find(isFabricMaterial);
  const woodMaterial = materials.find(isWoodMaterial);
  const foamMaterial = materials.find(isFoamMaterial);
  const specFabric = fabricFromOrderSpec(orderSpec);
  const requestedFabricLabel =
    asText(setup?.requestedFabricLabel) ??
    asText(fabricMaterial?.requestedFabricLabel) ??
    specFabric?.nameEn ??
    null;
  const color = colorFromSpec(orderSpec) ?? specFabric?.color ?? null;

  const fabricFromBom = fabricMaterial
    ? {
        sku: fabricMaterial.sku ?? fabricMaterial.inventoryItem?.sku ?? null,
        nameEn:
          fabricMaterial.displayName ??
          fabricMaterial.inventoryItem?.nameEn ??
          fabricMaterial.requestedFabricLabel ??
          null,
        nameAr: fabricMaterial.inventoryItem?.nameAr ?? null,
        nameHe: fabricMaterial.inventoryItem?.nameHe ?? null,
        color,
      }
    : null;
  const fabric =
    fabricFromBom ??
    specFabric ??
    (requestedFabricLabel
      ? { sku: null, nameEn: requestedFabricLabel, nameAr: null, nameHe: null, color }
      : null);
  if (fabric && color && !fabric.color) fabric.color = color;

  const wood = woodMaterial
    ? {
        sku: woodMaterial.sku ?? woodMaterial.inventoryItem?.sku ?? null,
        nameEn:
          woodMaterial.displayName ?? woodMaterial.inventoryItem?.nameEn ?? woodMaterial.sku ?? null,
        nameAr: woodMaterial.inventoryItem?.nameAr ?? null,
        nameHe: woodMaterial.inventoryItem?.nameHe ?? null,
      }
    : null;
  const foam = foamMaterial
    ? {
        sku: foamMaterial.sku ?? foamMaterial.inventoryItem?.sku ?? null,
        nameEn:
          foamMaterial.displayName ?? foamMaterial.inventoryItem?.nameEn ?? foamMaterial.sku ?? null,
        nameAr: foamMaterial.inventoryItem?.nameAr ?? null,
        nameHe: foamMaterial.inventoryItem?.nameHe ?? null,
      }
    : null;

  const measurements =
    normalizeInspectionMeasurements(setup?.measurements) ??
    normalizeInspectionMeasurements(product?.customMeasurements);
  const changesFromCatalog = buildCatalogDiff({
    complexity: complexity || null,
    catalogDimensions: catalogDimensions as CatalogDimRef | null,
    orderDimensions: orderDimensions as CatalogDimRef | null,
    orderFabricLabel: requestedFabricLabel,
    measurements: measurements?.map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      unit: row.unit,
      catalogValue: row.catalogValue,
    })),
  });

  return {
    complexity: complexity || null,
    orderDimensions,
    catalogDimensions,
    measurements,
    factoryNotes: asText(setup?.factoryNotes),
    requestedFabricLabel,
    manufacturingName: asText(setup?.manufacturingName),
    color,
    fabric,
    wood,
    foam,
    bom,
    lineSpec: asText(line?.specifications) ?? stringifyScalarSpec(orderSpec),
    changesFromCatalog,
  };
}

export type InspectionDealerFabric = {
  type: string | null;
  color: string | null;
  code: string | null;
  role: string | null;
};

export type InspectionDealerDetails = {
  projectName: string | null;
  dealerNotes: string | null;
  imageUrls: string[];
  photoDocumentIds: string[];
  productName: string | null;
  quantity: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  seatHeight: string | null;
  fabricType: string | null;
  fabricColor: string | null;
  fabricCode: string | null;
  fabrics: InspectionDealerFabric[];
  foamDensity: string | null;
  woodType: string | null;
  woodColor: string | null;
  material: string | null;
  finish: string | null;
  accessories: string | null;
  lineNotes: string | null;
  description: string | null;
};

function isImageDocument(doc: { mimeType?: string | null; fileName?: string | null }): boolean {
  if (String(doc.mimeType ?? '').startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(String(doc.fileName ?? ''));
}

function fabricsFromUnknown(value: unknown): InspectionDealerFabric[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const rec = asRecord(row);
      if (!rec) return null;
      const type = asText(rec.type) ?? asText(rec.name) ?? asText(rec.fabricType);
      const color = asText(rec.color) ?? asText(rec.fabricColor);
      const code = asText(rec.code) ?? asText(rec.sku) ?? asText(rec.fabricCode);
      const role = asText(rec.role) ?? asText(rec.key);
      if (!type && !color && !code) return null;
      return { type, color, code, role };
    })
    .filter((row): row is InspectionDealerFabric => row != null);
}

function dimText(value: unknown): string | null {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  return text || null;
}

export function buildInspectionDealerDetails(input: {
  productName?: string | null;
  productImageUrl?: string | null;
  productGalleryUrls?: string[] | null;
  projectName?: string | null;
  dealerNotes?: string | null;
  orderSpec?: unknown;
  specifications?: string | null;
  quantity?: unknown;
  requestItem?: {
    productName?: string | null;
    description?: string | null;
    quantity?: unknown;
    width?: unknown;
    height?: unknown;
    depth?: unknown;
    seatHeight?: unknown;
    fabricType?: string | null;
    fabricColor?: string | null;
    fabricCode?: string | null;
    fabrics?: unknown;
    foamDensity?: string | null;
    woodType?: string | null;
    woodColor?: string | null;
    material?: string | null;
    finish?: string | null;
    accessories?: string | null;
    notes?: string | null;
  } | null;
  quotationLine?: {
    description?: string | null;
    quantity?: unknown;
    width?: unknown;
    height?: unknown;
    depth?: unknown;
    fabric?: string | null;
    color?: string | null;
    fabrics?: unknown;
    material?: string | null;
  } | null;
  documents?: Array<{ id: string; mimeType?: string | null; fileName?: string | null }>;
}): InspectionDealerDetails {
  const spec = asRecord(input.orderSpec);
  const specDims = asRecord(spec?.requestedDimensions) ?? spec;
  const specFabric = asRecord(spec?.fabric);
  const request = input.requestItem ?? null;
  const quote = input.quotationLine ?? null;
  const fabrics = [
    ...fabricsFromUnknown(request?.fabrics),
    ...fabricsFromUnknown(spec?.fabrics),
    ...fabricsFromUnknown(quote?.fabrics),
  ];
  const primaryFabric = fabrics[0];
  const imageUrls = [
    asText(spec?.productImageRef),
    asText(input.productImageUrl),
    ...(input.productGalleryUrls ?? []).map((url) => asText(url)),
  ].filter((url): url is string => Boolean(url));
  const seenUrl = new Set<string>();
  const uniqueUrls = imageUrls.filter((url) => {
    if (seenUrl.has(url)) return false;
    seenUrl.add(url);
    return true;
  });
  const photoDocumentIds = [
    ...((spec?.attachmentIds as unknown[]) ?? []),
    ...(input.documents ?? [])
      .filter(isImageDocument)
      .map((doc) => doc.id),
  ]
    .map((id) => asText(id))
    .filter((id): id is string => Boolean(id));
  const seenDoc = new Set<string>();
  const uniqueDocs = photoDocumentIds.filter((id) => {
    if (seenDoc.has(id)) return false;
    seenDoc.add(id);
    return true;
  });

  return {
    projectName: asText(input.projectName),
    dealerNotes: asText(input.dealerNotes) ?? asText(request?.notes) ?? asText(spec?.notes),
    imageUrls: uniqueUrls,
    photoDocumentIds: uniqueDocs,
    productName:
      asText(request?.productName) ?? asText(input.productName) ?? asText(spec?.productName),
    quantity: dimText(request?.quantity ?? quote?.quantity ?? spec?.quantity ?? input.quantity),
    width: dimText(request?.width ?? specDims?.width ?? quote?.width),
    height: dimText(request?.height ?? specDims?.height ?? quote?.height),
    depth: dimText(request?.depth ?? specDims?.depth ?? quote?.depth),
    seatHeight: dimText(request?.seatHeight ?? specDims?.seatHeight),
    fabricType:
      asText(request?.fabricType) ??
      asText(specFabric?.type) ??
      asText(primaryFabric?.type) ??
      asText(quote?.fabric),
    fabricColor:
      asText(request?.fabricColor) ??
      asText(specFabric?.color) ??
      asText(primaryFabric?.color) ??
      asText(quote?.color),
    fabricCode:
      asText(request?.fabricCode) ?? asText(specFabric?.code) ?? asText(primaryFabric?.code),
    fabrics,
    foamDensity: asText(request?.foamDensity) ?? asText(spec?.foamDensity),
    woodType: asText(request?.woodType) ?? asText(spec?.woodType),
    woodColor: asText(request?.woodColor) ?? asText(spec?.woodColor),
    material: asText(request?.material) ?? asText(spec?.material) ?? asText(quote?.material),
    finish: asText(request?.finish) ?? asText(spec?.finish),
    accessories: asText(request?.accessories) ?? asText(spec?.accessories),
    lineNotes: asText(request?.notes) ?? asText(spec?.notes),
    description:
      asText(request?.description) ??
      asText(spec?.modifications) ??
      asText(input.specifications) ??
      asText(quote?.description),
  };
}

/** Expand FINAL_QC furniture checklist defaults (codes must stay stable). */
export const FINAL_QC_FURNITURE_ITEMS: Array<{
  code: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
}> = [
  { code: 'DIM', labelEn: 'Dimensions match', labelAr: 'المقاسات مطابقة', sortOrder: 1 },
  { code: 'FRAME', labelEn: 'Structure / stability', labelAr: 'ثبات الهيكل', sortOrder: 2 },
  { code: 'WOOD', labelEn: 'Wood / carpentry finish', labelAr: 'تشطيب الخشب', sortOrder: 3 },
  { code: 'PAINT', labelEn: 'Paint / finish', labelAr: 'الطلاء والتشطيب', sortOrder: 4 },
  { code: 'FABRIC', labelEn: 'Fabric / upholstery', labelAr: 'القماش والتنجيد', sortOrder: 5 },
  { code: 'STITCH', labelEn: 'Stitching', labelAr: 'الخياطة', sortOrder: 6 },
  { code: 'FOAM', labelEn: 'Foam / comfort', labelAr: 'الإسفنج والراحة', sortOrder: 7 },
  { code: 'ASSEMBLY', labelEn: 'Assembly', labelAr: 'التجميع', sortOrder: 8 },
  { code: 'HARDWARE', labelEn: 'Hardware', labelAr: 'الملحقات', sortOrder: 9 },
  { code: 'COLOR', labelEn: 'Color / model match', labelAr: 'مطابقة اللون والموديل', sortOrder: 10 },
  { code: 'QTY', labelEn: 'Quantity / components', labelAr: 'الكمية والمكونات', sortOrder: 11 },
  { code: 'DAMAGE', labelEn: 'Visible damage', labelAr: 'أضرار ظاهرة', sortOrder: 12 },
  { code: 'CLEAN', labelEn: 'Cleanliness', labelAr: 'نظافة القطعة', sortOrder: 13 },
  { code: 'SPEC', labelEn: 'Order / custom specification match', labelAr: 'مطابقة المواصفات', sortOrder: 14 },
];
