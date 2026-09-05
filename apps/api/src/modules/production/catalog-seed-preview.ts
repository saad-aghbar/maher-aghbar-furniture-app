/**
 * Pure helpers for the catalog production-plan accelerator (STANDARD / MODIFIED).
 * Inspects what canonical seedFromCatalog would apply — no second template engine.
 */

export const CATALOG_TEMPLATE_AUDIT_ACTION = 'production-plan.catalog-template-applied';

export const STARTED_PRODUCTION_STATUSES = [
  'IN_PROGRESS',
  'ON_HOLD',
  'QUALITY_CHECK',
  'READY_FOR_PACKAGING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
] as const;

export const SEED_WILL_NOT_CHANGE = [
  'workers',
  'datesTimes',
  'dealerDelivery',
  'sellingPrice',
  'orderType',
  'quotation',
  'salesDocuments',
  'inventoryQuantities',
  'productionStatus',
] as const;

export type SeedWillNotChangeKey = (typeof SEED_WILL_NOT_CHANGE)[number];

export type CatalogSeedUnavailableReason =
  | 'not_standard'
  | 'custom'
  | 'no_product'
  | 'no_definition'
  | 'locked'
  | null;

export type PlanTypeComplexity = 'STANDARD' | 'MODIFIED' | 'CUSTOM';

/** Null complexity with a productId is STANDARD; without a productId is CUSTOM. */
export function resolveLinePlanType(input: {
  manufacturingComplexity?: string | null;
  productId?: string | null;
}): PlanTypeComplexity {
  const raw = String(input.manufacturingComplexity ?? '').toUpperCase();
  if (raw === 'STANDARD' || raw === 'MODIFIED' || raw === 'CUSTOM') return raw;
  return input.productId ? 'STANDARD' : 'CUSTOM';
}

/** MODIFIED Confirm gate: explicit review, or any remaining needsReview row. */
export function modifiedMaterialsReviewRequired(input: {
  manufacturingComplexity?: string | null;
  productId?: string | null;
  materialsReviewedAt?: Date | string | null;
  materialsNeedReview?: boolean;
}): boolean {
  if (resolveLinePlanType(input) !== 'MODIFIED') return false;
  if (input.materialsNeedReview) return true;
  return !input.materialsReviewedAt;
}

export type CatalogWorkflowIdentity = {
  id: string;
  code: string | null;
  nameEn: string | null;
  nameAr: string | null;
  nameHe: string | null;
  versionNumber: number | null;
};

export type CatalogSeedPlanSummary = {
  materials: number;
  workflow: CatalogWorkflowIdentity | null;
  stages: number;
  tasks: number;
  semiWip: number;
  hasDurationEstimates: boolean;
};

export type CatalogSeedPreviewDto = {
  salesOrderId: string;
  lineId: string;
  setupLineId: string;
  manufacturingComplexity: string | null;
  productId: string | null;
  product: {
    id: string;
    sku: string | null;
    nameEn: string | null;
    nameAr: string | null;
    nameHe: string | null;
  } | null;
  quantity: number;
  requestedFabricLabel: string | null;
  actionAvailable: boolean;
  unavailableReason: CatalogSeedUnavailableReason;
  hasUsableDefinition: boolean;
  workflowWouldChange: boolean;
  requiresWorkflowChangeConfirmation: boolean;
  factoryLocked: boolean;
  current: CatalogSeedPlanSummary & { hasExistingPlan: boolean };
  productPlan: CatalogSeedPlanSummary;
  materials: Array<{ sku: string | null; expectedQty: number; quantityMode: string }>;
  willNotChange: readonly SeedWillNotChangeKey[];
  assignmentImpact: {
    workersPreserved: boolean;
    datesPreserved: boolean;
    timesPreserved: boolean;
    sequencePreserved: boolean;
    assignmentsWouldBeRemoved: boolean;
  };
  unreleasedProductionOrderIds: string[];
};

export function isStartedProductionStatus(status: string | null | undefined): boolean {
  return (STARTED_PRODUCTION_STATUSES as readonly string[]).includes(
    String(status ?? '').toUpperCase(),
  );
}

export function isProductionOrderLocked(po: {
  releasedToFactoryAt?: Date | string | null;
  actualStartDate?: Date | string | null;
  status?: string | null;
}): boolean {
  if (po.releasedToFactoryAt || po.actualStartDate) return true;
  return isStartedProductionStatus(po.status);
}

export function bomMaterialCount(bomDefaults: unknown): number {
  if (!bomDefaults || typeof bomDefaults !== 'object' || Array.isArray(bomDefaults)) return 0;
  const materials = (bomDefaults as { materials?: unknown }).materials;
  return Array.isArray(materials) ? materials.length : 0;
}

export function fabricLabelFromSpec(spec: unknown): string | null {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
  const fabric = (spec as { fabric?: { type?: unknown; code?: unknown; color?: unknown } }).fabric;
  if (!fabric || typeof fabric !== 'object') return null;
  const parts = [fabric.type, fabric.code, fabric.color]
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function hasUsableCatalogProductionDefinition(input: {
  workflowId?: string | null;
  published?: boolean;
  nodeCount?: number;
  stageMaterialInputCount?: number;
  bomMaterialCount?: number;
  stageInventoryOutputCount?: number;
}): boolean {
  if (!input.workflowId) return false;
  if (!input.published) return false;
  const nodes = input.nodeCount ?? 0;
  const materials = (input.stageMaterialInputCount ?? 0) + (input.bomMaterialCount ?? 0);
  const outputs = input.stageInventoryOutputCount ?? 0;
  return nodes > 0 || materials > 0 || outputs > 0;
}

/**
 * STANDARD and MODIFIED catalog accelerator: product + usable factory definition
 * + editable + not released. CUSTOM never gets this action.
 */
export function catalogSeedActionAvailable(input: {
  manufacturingComplexity?: string | null;
  productId?: string | null;
  usableDefinition: boolean;
  planEditable: boolean;
  factoryLocked: boolean;
}): boolean {
  const type = resolveLinePlanType(input);
  if (type !== 'STANDARD' && type !== 'MODIFIED') return false;
  if (!input.productId) return false;
  if (!input.usableDefinition) return false;
  if (!input.planEditable) return false;
  if (input.factoryLocked) return false;
  return true;
}

/** @deprecated Use catalogSeedActionAvailable — same gate, now includes MODIFIED. */
export function standardCatalogSeedActionAvailable(
  input: Parameters<typeof catalogSeedActionAvailable>[0],
): boolean {
  return catalogSeedActionAvailable(input);
}

/**
 * Second confirmation is required only when an existing production order would
 * change workflowId (rebuilds stages/tasks). Same workflow refreshes the baseline.
 */
export function catalogSeedRequiresWorkflowConfirm(input: {
  hasProductionOrder: boolean;
  currentWorkflowId?: string | null;
  catalogWorkflowId?: string | null;
}): boolean {
  if (!input.hasProductionOrder) return false;
  const current = input.currentWorkflowId?.trim() || null;
  const next = input.catalogWorkflowId?.trim() || null;
  if (!current || !next) return false;
  return current !== next;
}

export function countExecutableWorkflowTasks(
  nodes: Array<{ executionKind?: string | null }>,
): number {
  return nodes.filter((n) => String(n.executionKind ?? '').toUpperCase() !== 'LOGISTICS').length;
}

export function countSemiWipOutputs(
  outputs: Array<{ inventoryTracking?: string | null }>,
): number {
  return outputs.filter(
    (o) => String(o.inventoryTracking ?? '').toUpperCase() === 'PRODUCES_SEMI_FINISHED',
  ).length;
}
