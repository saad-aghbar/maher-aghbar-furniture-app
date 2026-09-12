/**
 * Product variants inherit from the parent product.
 * `null` variantId === the default variant. One resolver so inheritance can only be wrong in one place.
 */

export type VariantMeasurement = {
  key: string;
  labelAr?: string | null;
  labelEn?: string | null;
  labelHe?: string | null;
  value: number | string | null;
  unit: string;
};

export type VariantCompositionRow = {
  labelAr?: string | null;
  labelEn?: string | null;
  labelHe?: string | null;
  qty: number;
};

export type VariantIncludedItem = {
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  specOptionValueId?: string | null;
  width?: number | null;
  height?: number | null;
  qty: number;
  unit?: string | null;
  inventoryItemId?: string | null;
  note?: string | null;
};

export type VariantOptionRef = {
  specOptionValueId?: string | null;
  groupCode?: string | null;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  qty?: number | null;
  note?: string | null;
  inventoryItemId?: string | null;
};

export type ProductLike = {
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  basePrice?: number | string | null;
  manufacturingCost?: number | string | null;
  bomDefaults?: unknown;
  imageUrl?: string | null;
  galleryUrls?: string[] | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
  customMeasurements?: unknown;
  adminNotes?: string | null;
  workflowId?: string | null;
};

export type ProductVariantLike = {
  id: string;
  productId: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  isDefault: boolean;
  isActive?: boolean;
  sortOrder?: number;
  basePrice?: number | string | null;
  manufacturingCost?: number | string | null;
  bomDefaults?: unknown;
  imageUrl?: string | null;
  galleryUrls?: string[] | null;
  workflowId?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  seatHeight?: number | string | null;
  measurements?: VariantMeasurement[] | null;
  composition?: VariantCompositionRow[] | null;
  includedItems?: VariantIncludedItem[] | null;
  factoryNotesAr?: string | null;
  factoryNotesEn?: string | null;
  factoryNotesHe?: string | null;
  adminNotes?: string | null;
  options?: VariantOptionRef[] | null;
};

export type EffectiveVariant = {
  id: string | null;
  productId: string;
  sku: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe: string | null;
  isDefault: boolean;
  basePrice: number | string | null;
  manufacturingCost: number | string | null;
  bomDefaults: unknown;
  imageUrl: string | null;
  galleryUrls: string[];
  workflowId: string | null;
  width: number | string | null;
  height: number | string | null;
  depth: number | string | null;
  seatHeight: number | string | null;
  measurements: VariantMeasurement[];
  composition: VariantCompositionRow[];
  includedItems: VariantIncludedItem[];
  factoryNotesAr: string | null;
  factoryNotesEn: string | null;
  factoryNotesHe: string | null;
  adminNotes: string | null;
  options: VariantOptionRef[];
};

export type StageConfigRow = {
  id?: string;
  variantId?: string | null;
  [key: string]: unknown;
};

export type StageConfigBundle<T extends StageConfigRow = StageConfigRow> = {
  profile: T | null;
  estimates: T[];
  materialInputs: T[];
  inventoryOutputs: T[];
  inventoryInputs: T[];
  stageOverrides: T[];
};

function pick<T>(override: T | null | undefined, fallback: T | null | undefined): T | null {
  return override != null ? override : (fallback ?? null);
}

function pickList<T>(override: T[] | null | undefined, fallback: T[] | null | undefined): T[] {
  return override && override.length > 0 ? override : (fallback ?? []);
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function measurementsFromProduct(product: ProductLike): VariantMeasurement[] {
  const rows: VariantMeasurement[] = [];
  const dim = (
    key: string,
    labelAr: string,
    labelEn: string,
    labelHe: string,
    value: unknown,
  ) => {
    if (value == null || value === '') return;
    rows.push({ key, labelAr, labelEn, labelHe, value: asNumber(value) ?? String(value), unit: 'cm' });
  };
  dim('width', 'العرض', 'Width', 'רוחב', product.width);
  dim('height', 'الارتفاع', 'Height', 'גובה', product.height);
  dim('depth', 'العمق', 'Depth', 'עומק', product.depth);
  dim('seatHeight', 'ارتفاع المقعد', 'Seat height', 'גובה ישיבה', product.seatHeight);

  const custom = Array.isArray(product.customMeasurements) ? product.customMeasurements : [];
  for (const row of custom as Array<Record<string, unknown>>) {
    const key = String(row.key ?? row.id ?? row.nameEn ?? 'custom');
    rows.push({
      key,
      labelAr: (row.nameAr as string) ?? null,
      labelEn: (row.nameEn as string) ?? null,
      labelHe: (row.nameHe as string) ?? null,
      value: (row.value as number | string | null) ?? null,
      unit: String(row.unit ?? 'cm'),
    });
  }
  return rows;
}

export function productAsDefaultVariant(product: ProductLike): ProductVariantLike {
  return {
    id: `default:${product.id}`,
    productId: product.id,
    sku: `${product.sku}-STD`,
    code: 'STD',
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    nameHe: product.nameHe ?? null,
    isDefault: true,
    basePrice: product.basePrice ?? null,
    manufacturingCost: product.manufacturingCost ?? null,
    bomDefaults: product.bomDefaults ?? null,
    imageUrl: product.imageUrl ?? null,
    galleryUrls: product.galleryUrls ?? [],
    workflowId: product.workflowId ?? null,
    width: product.width ?? null,
    height: product.height ?? null,
    depth: product.depth ?? null,
    seatHeight: product.seatHeight ?? null,
    measurements: measurementsFromProduct(product),
    composition: [],
    includedItems: [],
    factoryNotesAr: null,
    factoryNotesEn: null,
    factoryNotesHe: null,
    adminNotes: product.adminNotes ?? null,
    options: [],
  };
}

/**
 * Merge variant over product. Missing variant fields fall through.
 * `variant == null` is byte-identical to the auto default variant.
 */
export function resolveEffectiveVariant(input: {
  product: ProductLike;
  variant?: ProductVariantLike | null;
}): EffectiveVariant {
  const fallback = productAsDefaultVariant(input.product);
  const variant = input.variant ?? fallback;
  const measurements =
    variant.measurements && variant.measurements.length > 0
      ? variant.measurements
      : (fallback.measurements ?? []);

  return {
    id: input.variant?.id ?? null,
    productId: input.product.id,
    sku: variant.sku || fallback.sku,
    code: variant.code || fallback.code,
    nameAr: variant.nameAr || fallback.nameAr,
    nameEn: variant.nameEn || fallback.nameEn,
    nameHe: pick(variant.nameHe ?? null, fallback.nameHe),
    isDefault: input.variant ? variant.isDefault : true,
    basePrice: pick(variant.basePrice ?? null, fallback.basePrice),
    manufacturingCost: pick(variant.manufacturingCost ?? null, fallback.manufacturingCost),
    bomDefaults: pick(variant.bomDefaults ?? null, fallback.bomDefaults),
    imageUrl: pick(variant.imageUrl ?? null, fallback.imageUrl),
    galleryUrls: pickList(variant.galleryUrls, fallback.galleryUrls ?? []),
    workflowId: pick(variant.workflowId ?? null, fallback.workflowId),
    width: pick(variant.width ?? null, fallback.width),
    height: pick(variant.height ?? null, fallback.height),
    depth: pick(variant.depth ?? null, fallback.depth),
    seatHeight: pick(variant.seatHeight ?? null, fallback.seatHeight),
    measurements,
    composition: pickList(variant.composition, fallback.composition),
    includedItems: pickList(variant.includedItems, fallback.includedItems),
    factoryNotesAr: variant.factoryNotesAr ?? null,
    factoryNotesEn: variant.factoryNotesEn ?? null,
    factoryNotesHe: variant.factoryNotesHe ?? null,
    adminNotes: pick(variant.adminNotes ?? null, fallback.adminNotes),
    options: variant.options ?? [],
  };
}

export function standardOptionsFromEffective(effective: {
  options?: VariantOptionRef[] | null;
}): {
  woodType: string | null;
  woodColor: string | null;
  foamDensity: string | null;
  finish: string | null;
  accessories: string | null;
} {
  const pickCode = (group: string) => {
    const opt = (effective.options ?? []).find(
      (row) => String(row.groupCode ?? '').toUpperCase() === group,
    );
    return opt?.code ?? opt?.nameEn ?? null;
  };
  const piping = pickCode('PIPING_STYLE');
  const legs = pickCode('LEG_TYPE');
  return {
    woodType: pickCode('WOOD_TYPE'),
    woodColor: pickCode('WOOD_COLOR') ?? pickCode('PAINT_COLOR'),
    foamDensity: pickCode('FOAM_DENSITY'),
    finish: pickCode('FABRIC_FINISH') ?? pickCode('PAINT_COLOR'),
    accessories: [piping, legs].filter(Boolean).join(' ') || null,
  };
}

export function catalogDimRefFromEffective(effective: EffectiveVariant): {
  width: number | string | null;
  height: number | string | null;
  depth: number | string | null;
  seatHeight: number | string | null;
  customMeasurements: VariantMeasurement[];
  standardOptions: ReturnType<typeof standardOptionsFromEffective>;
  options: VariantOptionRef[];
  composition: VariantCompositionRow[];
  includedItems: VariantIncludedItem[];
} {
  return {
    width: effective.width,
    height: effective.height,
    depth: effective.depth,
    seatHeight: effective.seatHeight,
    customMeasurements: effective.measurements,
    standardOptions: standardOptionsFromEffective(effective),
    options: effective.options,
    composition: effective.composition,
    includedItems: effective.includedItems,
  };
}

export function pickVariantScopedRows<T extends StageConfigRow>(
  rows: T[],
  variantId: string | null,
): T[] {
  const scoped = rows.filter((row) => (row.variantId ?? null) === (variantId ?? null));
  if (scoped.length > 0 || variantId == null) return scoped;
  return rows.filter((row) => row.variantId == null);
}

export function resolveVariantStageConfig<T extends StageConfigRow>(input: {
  variantId: string | null;
  productRows: StageConfigBundle<T>;
  variantRows?: Partial<StageConfigBundle<T>> | null;
}): StageConfigBundle<T> {
  const variantRows = input.variantRows ?? {};
  const merge = (variantList: T[] | undefined, productList: T[]) => {
    const fromVariant = (variantList ?? []).filter((row) => (row.variantId ?? null) === input.variantId);
    if (fromVariant.length > 0) return fromVariant;
    return productList.filter((row) => row.variantId == null);
  };
  const profile =
    variantRows.profile && (variantRows.profile.variantId ?? null) === input.variantId
      ? variantRows.profile
      : input.productRows.profile && input.productRows.profile.variantId == null
        ? input.productRows.profile
        : (variantRows.profile ?? input.productRows.profile);

  return {
    profile,
    estimates: merge(variantRows.estimates, input.productRows.estimates),
    materialInputs: merge(variantRows.materialInputs, input.productRows.materialInputs),
    inventoryOutputs: merge(variantRows.inventoryOutputs, input.productRows.inventoryOutputs),
    inventoryInputs: merge(variantRows.inventoryInputs, input.productRows.inventoryInputs),
    stageOverrides: merge(variantRows.stageOverrides, input.productRows.stageOverrides),
  };
}

export function compositionToPiecePlan(composition: VariantCompositionRow[] | null | undefined): {
  expectedPieceCount: number;
  pieceLabels: Array<{ nameAr: string; nameEn: string; nameHe?: string | null }>;
} {
  const rows = composition ?? [];
  const pieceLabels: Array<{ nameAr: string; nameEn: string; nameHe?: string | null }> = [];
  for (const row of rows) {
    const qty = Math.max(0, Math.round(Number(row.qty) || 0));
    const nameAr = row.labelAr || row.labelEn || '';
    const nameEn = row.labelEn || row.labelAr || '';
    for (let i = 0; i < qty; i += 1) {
      pieceLabels.push({
        nameAr: qty > 1 ? `${nameAr} ${i + 1}` : nameAr,
        nameEn: nameEn,
        nameHe: row.labelHe ?? null,
      });
    }
  }
  return { expectedPieceCount: pieceLabels.length, pieceLabels };
}

function measurementFragment(row: VariantMeasurement, locale: string): string {
  const label =
    locale === 'ar'
      ? row.labelAr || row.labelEn || row.key
      : locale === 'he'
        ? row.labelHe || row.labelEn || row.labelAr || row.key
        : row.labelEn || row.labelAr || row.key;
  if (row.value == null || row.value === '') return '';
  return `${label} ${row.value} ${row.unit}`.trim();
}

/**
 * Dense one-line spec the floor reads (كرينا / أوكرانيه · ص 1.15 م · …).
 */
export function renderVariantSpecLine(
  variant: Pick<
    EffectiveVariant,
    | 'nameAr'
    | 'nameEn'
    | 'nameHe'
    | 'measurements'
    | 'options'
    | 'includedItems'
    | 'composition'
    | 'factoryNotesAr'
    | 'factoryNotesEn'
    | 'factoryNotesHe'
  >,
  locale: string,
): string {
  const name =
    locale === 'ar'
      ? variant.nameAr || variant.nameEn
      : locale === 'he'
        ? variant.nameHe || variant.nameEn || variant.nameAr
        : variant.nameEn || variant.nameAr;
  const parts: string[] = [name];
  const composition = (variant.composition ?? [])
    .map((row) => {
      const label =
        locale === 'ar'
          ? row.labelAr || row.labelEn
          : locale === 'he'
            ? row.labelHe || row.labelEn || row.labelAr
            : row.labelEn || row.labelAr;
      return row.qty > 1 ? `${row.qty}×${label}` : label;
    })
    .filter(Boolean);
  if (composition.length) parts.push(composition.join('+'));
  for (const row of variant.measurements ?? []) {
    const frag = measurementFragment(row, locale);
    if (frag) parts.push(frag);
  }
  for (const option of variant.options ?? []) {
    const label =
      locale === 'ar'
        ? option.nameAr || option.nameEn || option.code
        : locale === 'he'
          ? option.nameHe || option.nameEn || option.nameAr || option.code
          : option.nameEn || option.nameAr || option.code;
    if (label) parts.push(option.qty && Number(option.qty) > 1 ? `${option.qty}×${label}` : label);
  }
  for (const item of variant.includedItems ?? []) {
    const label =
      locale === 'ar'
        ? item.nameAr || item.nameEn
        : locale === 'he'
          ? item.nameHe || item.nameEn || item.nameAr
          : item.nameEn || item.nameAr;
    const size =
      item.width != null && item.height != null ? `${item.width}×${item.height}${item.unit ? ` ${item.unit}` : ''}` : '';
    parts.push(`${item.qty}×${label}${size ? ` ${size}` : ''}`.trim());
  }
  const notes =
    locale === 'ar'
      ? variant.factoryNotesAr
      : locale === 'he'
        ? variant.factoryNotesHe || variant.factoryNotesEn || variant.factoryNotesAr
        : variant.factoryNotesEn || variant.factoryNotesAr;
  if (notes) parts.push(notes);
  return parts.filter(Boolean).join(' · ');
}

export function persistMeasurementsRoundTrip(rows: VariantMeasurement[]): VariantMeasurement[] {
  return rows.map((row) => ({
    key: row.key,
    labelAr: row.labelAr ?? null,
    labelEn: row.labelEn ?? null,
    labelHe: row.labelHe ?? null,
    value: row.value,
    unit: row.unit,
  }));
}
