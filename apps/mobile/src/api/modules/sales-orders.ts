import type { PaginatedResponse } from '@maher/types';
import { apiGet, apiPatch, apiPost, apiPut } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type SalesOrderProductionReadinessSummary = {
  productionOrderCount?: number;
  canStart?: boolean;
  needsSetup?: boolean;
  materialsReady?: boolean;
  assignment?: {
    required?: number;
    assigned?: number;
    missingCount?: number;
    missing?: unknown[];
  };
  actionHint?: string | null;
  primaryProductionOrderId?: string | null;
};

export type SalesOrderJourneyLogistics = {
  packageCount?: number | null;
  packagesLoaded?: number | null;
  packagesTotal?: number | null;
  /** 1-based index of first unchecked DeliveryLoadPiece when load incomplete. */
  firstMissingPackageIndex?: number | null;
  finReady?: boolean | null;
  finishedWarehouseName?: string | null;
  finishedWarehouseCode?: string | null;
  loadStatus?:
    | 'not_started'
    | 'loading'
    | 'fully_loaded'
    | 'departed'
    | 'delivered'
    /** @deprecated legacy aliases — prefer loading / fully_loaded */
    | 'partial'
    | 'complete'
    | null;
  deliveryId?: string | null;
  deliveryNumber?: string | null;
  truckDepartedAt?: string | null;
  dealerConfirmedAt?: string | null;
  actualDeliveredAt?: string | null;
  committedDeliveryDate?: string | null;
};

export type SalesOrderListItem = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string | null;
  imageUrl: string | null;
  progressPercent: number | null;
  progressLabel?: string;
  /** Admin — current floor stage for the PO driving progressPercent */
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  requiredDeliveryDate: string | null;
  createdAt?: string | null;
  externalOrderNumber?: string | null;
  projectName?: string | null;
  sellerPrice?: number | string | null;
  manufacturingCost?: number | string | null;
  profit?: number | string | null;
  /** Latest linked delivery status (admin list enrichment). */
  deliveryStatus?: string | null;
  lineCount?: number | null;
  productionReadinessSummary?: SalesOrderProductionReadinessSummary | null;
  /** Piece 1/2 — accepted SO awaiting production setup release */
  productionSetupRequired?: boolean;
  productionSetupStatus?: string | null;
  /** Worst line complexity: STANDARD | MODIFIED | CUSTOM */
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM' | string | null;
  customer?: {
    id: string;
    name: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
  } | null;
  productionOrders?: Array<{
    id?: string;
    number: string;
    status?: string;
    progressPercent?: number | null;
    releasedToFactoryAt?: string | null;
    actualStartDate?: string | null;
  }> | null;
  /** True after Release to factory — leaves Orders Preparing. */
  releasedToFactory?: boolean;
  /** True after first executable factory task has started. */
  executionStarted?: boolean;
  /** Server Order Journey lane (COUNT=DATASET). */
  journeyBucket?:
    | 'preparing'
    | 'ready_to_start'
    | 'in_production'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | string
    | null;
  /** Presentation-safe logistics facts for RFD / Shipped / Delivered cards. */
  journeyLogistics?: SalesOrderJourneyLogistics | null;
  workerAssignmentRequired?: boolean;
};

export type AdminOrderJourneyCounts = {
  all: number;
  preparing: number;
  ready_to_start: number;
  in_production: number;
  ready_to_ship: number;
  shipped: number;
  delivered: number;
};

export type SalesOrderListFilters = PageParams & {
  q?: string;
  status?: string;
  statusGroup?: 'pending' | 'production' | 'delivered';
  /** Admin Order Journey lane — server classifier; COUNT=DATASET. */
  journeyBucket?:
    | 'preparing'
    | 'ready_to_start'
    | 'in_production'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered';
  sortBy?: 'createdAt' | 'requiredDeliveryDate' | 'number' | 'total';
  sortDir?: 'asc' | 'desc';
  deliveryFrom?: string;
  deliveryTo?: string;
  /** Admin only — never send from dealer client. */
  customerId?: string;
};

export async function listSalesOrders(
  filters: SalesOrderListFilters = {},
): Promise<
  PaginatedResponse<SalesOrderListItem> & {
    meta: PaginatedResponse<SalesOrderListItem>['meta'] & {
      journeyCounts?: AdminOrderJourneyCounts;
    };
  }
> {
  const qs = toSearchParams({
    page: filters.page,
    pageSize: filters.pageSize,
    q: filters.q,
    status: filters.status,
    statusGroup: filters.statusGroup,
    journeyBucket: filters.journeyBucket,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    deliveryFrom: filters.deliveryFrom,
    deliveryTo: filters.deliveryTo,
    customerId: filters.customerId,
  });
  return apiGet(`/sales-orders${qs}`);
}

export type SalesOrderDocument = {
  id: string;
  fileName: string;
  mimeType: string | null;
  storageKey?: string;
  category?: string | null;
  createdAt?: string;
};

export type SalesOrderStage = {
  code: string;
  nameEn: string;
  nameAr?: string | null;
  nameHe?: string | null;
  sortOrder: number;
  dependsOnCodes?: string[];
  status: string;
  progressPercent?: number | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  plannedEnd?: string | null;
  notes?: string | null;
  isOverdue?: boolean;
  assignees?: { id: string; name: string }[];
  blockers?: { id: string; category: string; reason: string }[];
  attachmentCount?: number;
  photos?: Array<{ id: string; fileName: string; mimeType?: string | null }>;
};

export type SalesOrderLineItem = {
  id: string;
  productId?: string | null;
  productName: string;
  description?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  material?: string | null;
  fabricType?: string | null;
  fabricColor?: string | null;
  fabricCode?: string | null;
  woodType?: string | null;
  foamDensity?: string | null;
  finish?: string | null;
  accessories?: string | null;
  notes?: string | null;
};

export type SalesOrderDetail = {
  id: string;
  number: string;
  status: string;
  priority: string;
  title: string | null;
  imageUrl: string | null;
  notes: string | null;
  externalOrderNumber: string | null;
  deliveryAddress: string | null;
  requiredDeliveryDate: string | null;
  requestedDeliveryDate?: string | null;
  /** Scheduler-committed date, when a schedule has been approved. */
  committedDeliveryDate?: string | null;
  /** Dealer-safe commercial promise state (see @maher scheduling domain). */
  promiseState?: string | null;
  projectName?: string | null;
  total?: number | string | null;
  progressPercent: number | null;
  progressLabel?: string;
  /** Admin — current floor stage for the PO driving progressPercent */
  currentStage?: {
    code: string;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
  } | null;
  sellerPrice?: number | string | null;
  productionPrice?: number | string | null;
  manufacturingCost?: number | string | null;
  costBreakdown?: Record<string, number | string | null> | null;
  /** Staff — plan/catalog BOM line items for manufacturing cost “chosen materials”. */
  costMaterialLines?: Array<{
    sku: string;
    name: string;
    category: 'fabric' | 'wood' | 'foam' | 'accessories';
    qty: number;
    unitCost: number;
    lineCost: number;
    inventoryItemId?: string | null;
  }> | null;
  profit?: number | string | null;
  /** Piece 5 — slim usage actual manufacturing cost (staff with inventory.cost.read). */
  manufacturingCosting?: {
    status?: string | null;
    incomplete?: boolean;
    estimatedTotal?: number | null;
    actualTotal?: number | null;
    varianceCost?: number | null;
    variancePct?: number | null;
    scrapCost?: number | null;
    finalizedAt?: string | null;
  } | null;
  assignedEmployeeId?: string | null;
  assignedEmployee?: { id: string; name: string } | null;
  customer?: {
    id: string;
    name: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    nameHe?: string | null;
    code?: string | null;
    phone?: string | null;
    fax?: string | null;
  } | null;
  customerRequest?: {
    notes?: string | null;
    source?: string | null;
    projectName?: string | null;
    externalOrderNumber?: string | null;
    endCustomerName?: string | null;
    endCustomerPhone?: string | null;
    endCustomerFax?: string | null;
    deliveryAddress?: string | null;
    requiredDeliveryDate?: string | null;
    originalText?: string | null;
    translatedText?: string | null;
    detectedLanguage?: string | null;
    targetLanguage?: string | null;
    items?: SalesOrderLineItem[];
    documents?: SalesOrderDocument[];
  } | null;
  orderedItems?: SalesOrderLineItem[];
  productionOrders?: {
    id: string;
    number: string;
    status: string;
    progressPercent?: number | null;
    progressLabel?: string;
    stages?: SalesOrderStage[];
    photos?: SalesOrderDocument[];
  }[];
  invoices?: {
    id: string;
    number: string;
    status: string;
    total?: number | string | null;
    outstandingAmount?: number | string | null;
  }[];
  deliveries?: {
    id: string;
    number: string;
    status: string;
    deliveryDate?: string | null;
    deliveryWindow?: string | null;
    recipientName?: string | null;
    deliveryAddress?: string | null;
  }[];
  returns?: {
    id: string;
    number: string;
    approvalStatus: string;
    physicalStatus?: string | null;
    needInfoNote?: string | null;
    inventoryFate?: string | null;
    reason?: string | null;
    productDesc?: string | null;
    quantity?: number | string | null;
    createdAt?: string;
  }[];
  /** Latest linked delivery status. */
  deliveryStatus?: string | null;
  productionReadinessSummary?: SalesOrderProductionReadinessSummary | null;
  /** Piece 1: accepted SO awaiting Prepare production (confirm). */
  productionSetupRequired?: boolean;
  /** Piece 2: setup released; floor still needs worker assignment (pre–Release to factory). */
  workerAssignmentRequired?: boolean;
  productionSetupStatus?: string | null;
  /** Worst line complexity: STANDARD | MODIFIED | CUSTOM */
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM' | string | null;
  /** Hard Preparing → Production boundary crossed. */
  releasedToFactory?: boolean;
  releasedToFactoryAt?: string | null;
  /** First executable factory task has started. */
  executionStarted?: boolean;
  /** Piece 7 — commercial price gate + line statuses (admin). */
  commercialSummary?: CommercialSummary | null;
  commercialGrossDifference?: CommercialGrossDifference | null;
};

export type CommercialSummaryLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  manufacturingComplexity?: string | null;
  commercialPriceStatus: string;
  commercialPriceSource?: string | null;
  commercialPriceNote?: string | null;
};

export type CommercialSummary = {
  salesOrderId: string;
  number: string;
  orderTotal: number;
  commercialComplete: boolean;
  commercialBlock?: { ok: false; code: string; message: string } | null;
  lines: CommercialSummaryLine[];
};

export type CommercialGrossDifference = {
  available: boolean;
  reason?: string | null;
  saleTotal: number;
  manufacturingCost: number | null;
  grossDifference: number | null;
};

export type UpdateSalesOrderInput = {
  number?: string;
  notes?: string;
  projectName?: string;
  externalOrderNumber?: string;
  requiredDeliveryDate?: string | null;
  deliveryAddress?: string;
  endCustomerName?: string;
  endCustomerPhone?: string;
  endCustomerFax?: string;
  manufacturingCost?: number;
  costBreakdown?: Record<string, number>;
};

export async function getSalesOrder(id: string): Promise<SalesOrderDetail> {
  return apiGet<SalesOrderDetail>(`/sales-orders/${encodeURIComponent(id)}`);
}

export type ManufacturingCostingPayload = {
  status: string;
  incomplete: boolean;
  finalizedAt: string | null;
  estimated: {
    total: number | null;
    byCategory: Record<string, { qty: number; cost: number }>;
  };
  actual: {
    total: number | null;
    toDate: number | null;
    scrapCost: number;
    returnCredit: number;
    reworkCost: number;
    byCategory: Record<string, { qty: number; cost: number; scrapCost: number }>;
  };
  variance: { cost: number | null; pct: number | null };
  bySku: Array<{
    sku: string;
    displayName: string | null;
    category: string | null;
    plannedQty: number;
    issuedQty: number;
    returnedQty: number;
    scrapQty: number;
    costedQty: number;
    unitCost: number | null;
    estimatedCost: number | null;
    actualCost: number | null;
    varianceQty: number;
    varianceCost: number | null;
    costAvailable: boolean;
    origin: 'ORIGINAL' | 'REWORK' | 'MIXED';
  }>;
  incompleteSkus?: Array<{ sku: string; displayName: string | null; costedQty: number }>;
  lines?: Array<{
    salesOrderLineId: string;
    manufacturingName: string | null;
    quantity: number;
    estimatedTotal: number | null;
    actualTotal: number | null;
    varianceCost: number | null;
    status: string;
  }>;
  taskTrace?: Array<{
    taskId: string;
    stageCode: string | null;
    workerName: string | null;
    sku: string;
    costedQty: number;
    actualCost: number | null;
    isRework: boolean;
    finalizedAt: string | null;
  }>;
};

export async function getSalesOrderManufacturingCost(
  id: string,
): Promise<ManufacturingCostingPayload> {
  return apiGet<ManufacturingCostingPayload>(
    `/sales-orders/${encodeURIComponent(id)}/manufacturing-cost`,
  );
}

export async function updateSalesOrder(
  id: string,
  body: UpdateSalesOrderInput,
): Promise<SalesOrderDetail> {
  return apiPatch<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}`,
    body,
  );
}

export async function confirmSalesOrder(id: string): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/confirm`,
  );
}

/** Staff confirms final commercial unit prices on REQUIRED / open lines. */
export async function confirmCommercialPrices(
  id: string,
  lines: Array<{ lineId: string; unitPrice: number; note?: string }>,
): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/confirm-commercial-prices`,
    { lines },
  );
}

export async function holdSalesOrder(
  id: string,
  reason?: string,
): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/hold`,
    { reason },
  );
}

export async function cancelSalesOrder(
  id: string,
  reason?: string,
): Promise<SalesOrderDetail> {
  return apiPost<SalesOrderDetail>(
    `/sales-orders/${encodeURIComponent(id)}/cancel`,
    { reason },
  );
}

/** Matches admin-web Orders detail status gates. */
export const HOLDABLE_STATUSES = [
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'IN_PRODUCTION',
  'WAITING_FOR_MATERIALS',
  'WAITING_FOR_PAYMENT',
] as const;

export const CANCELLABLE_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'READY_FOR_PRODUCTION',
  'ON_HOLD',
  'WAITING_FOR_PAYMENT',
  'WAITING_FOR_MATERIALS',
] as const;

export function canHoldSalesOrder(status: string): boolean {
  return (HOLDABLE_STATUSES as readonly string[]).includes(status);
}

export function canCancelSalesOrder(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

/* ─── Piece 2: order production setup ───────────────────────────────────── */

export type ManufacturingComplexity = 'STANDARD' | 'MODIFIED' | 'CUSTOM';

export type SalesOrderProductionSetupStatus =
  | 'SETUP_REQUIRED'
  | 'SETUP_IN_PROGRESS'
  | 'READY_FOR_RELEASE'
  | 'RELEASED';

export type SalesOrderLineSetupStatus =
  | 'NOT_STARTED'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'BLOCKED';

export type SetupMaterialStatus =
  | 'READY'
  | 'SHORTAGE'
  | 'NEEDS_SELECTION'
  | 'NEEDS_REVIEW';

export type SetupDims = {
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  seatHeight?: number | null;
};

export type SetupValidationIssue = {
  code: string;
  message: string;
  lineId?: string;
  section?: 'spec' | 'materials' | 'workflow' | 'packaging' | 'review' | string;
};

export type SetupMaterialRequirement = {
  id: string;
  inventoryItemId: string | null;
  sku: string | null;
  displayName: string | null;
  category: string | null;
  unit: string;
  expectedQty: number;
  totalExpectedQty?: number;
  source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM' | string;
  needsReview: boolean;
  notes?: string | null;
  requestedFabricLabel?: string | null;
  unitCost?: number | null;
  estimatedCost?: number | null;
  costAvailable?: boolean;
  inventoryItem?: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    category?: string | null;
    unit?: string | null;
    imageUrl?: string | null;
  } | null;
  availability?: {
    available: number;
    reserved: number;
    free: number;
    short: number;
    status: string;
  } | null;
};

export type SetupEstimatedCostSummary = {
  fabricQty: number;
  fabricCost: number;
  woodQty: number;
  woodCost: number;
  foamQty: number;
  foamCost: number;
  accessoriesQty: number;
  accessoriesCost: number;
  otherQty: number;
  otherCost: number;
  totalEstimated: number | null;
  costAvailable: boolean;
  someCostsUnavailable: boolean;
  incomplete?: boolean;
  estimateIncomplete?: boolean;
  label?: string;
};

export type SetupActualCostSummary = {
  totalActual: number | null;
  costAvailable: boolean;
  someCostsUnavailable: boolean;
  incomplete: boolean;
  label: string;
  bySku?: Array<{
    sku: string;
    actualQty: number;
    unitCost: number | null;
    cost: number | null;
  }>;
};

export type SetupLineFabric = {
  requestedLabel: string | null;
  selected: SetupMaterialRequirement | null;
  expectedQty: number;
  availableQty?: number | null;
  shortageQty?: number | null;
  unitCostAvailable?: boolean;
  unitCost?: number | null;
  notes?: string | null;
  imageUrl?: string | null;
};

export type SetupAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
};

export type SetupOrderMeasurement = {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string | null;
  catalogValue?: number | string | null;
};

export type SetupCatalogChange = {
  field: string;
  label?: string;
  from: unknown;
  to: unknown;
  delta?: number | null;
};

export type SetupPackagingExpectation = {
  pieceLabels?: Array<{
    label?: string;
    nameEn?: string;
    nameAr?: string;
    nameHe?: string;
  }>;
  expectedPieceCount?: number | null;
} | null;

export type SetupLineSectionProgress = {
  spec: boolean;
  materials: boolean;
  workflow: boolean;
  packaging: boolean;
  review: boolean;
};

export type OrderProductionSetupLine = {
  id: string;
  salesOrderLineId: string;
  status: SalesOrderLineSetupStatus | string;
  manufacturingName: string | null;
  manufacturingComplexity: ManufacturingComplexity | string | null;
  quantity: number;
  catalogDimensions: SetupDims | null;
  orderDimensions: SetupDims | null;
  measurements?: SetupOrderMeasurement[];
  changes: SetupCatalogChange[];
  changesFromCatalog?: SetupCatalogChange[];
  requestedFabricLabel: string | null;
  fabric?: SetupLineFabric;
  factoryNotes: string | null;
  packagingExpectation: SetupPackagingExpectation;
  referenceDocumentIds: string[] | unknown;
  attachments?: SetupAttachment[];
  materialsReviewedAt: string | null;
  workflowId: string | null;
  workflowConfirmedAt: string | null;
  workflow: {
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    stagePath: Array<{
      stageCode: string;
      nameEn: string;
      nameAr?: string | null;
    }>;
  } | null;
  product: {
    id: string;
    sku: string;
    nameEn: string;
    nameAr: string;
    nameHe?: string | null;
    imageUrl?: string | null;
  } | null;
  description: string | null;
  materials: SetupMaterialRequirement[];
  estimatedCostSummary?: SetupEstimatedCostSummary | null;
  actualCostSummary?: SetupActualCostSummary | null;
  basedOnProduct?: { id: string; nameEn: string; sku: string } | null;
  materialStatus: SetupMaterialStatus | string;
  sectionProgress: SetupLineSectionProgress;
  issues: SetupValidationIssue[];
};

export type OrderProductionSetup = {
  id: string;
  salesOrderId: string;
  status: SalesOrderProductionSetupStatus | string;
  releasedAt: string | null;
  releasedById: string | null;
  /** Preparing: materials/path/packaging stay editable until Confirm. */
  planEditable?: boolean;
  factoryReleased?: boolean;
  salesOrder: {
    id: string;
    number: string;
    status: string;
    projectName?: string | null;
    customerId?: string | null;
    customer?: {
      id: string;
      nameEn?: string | null;
      nameAr?: string | null;
      code?: string | null;
    } | null;
  };
  progress: {
    totalLines: number;
    readyLines: number;
    needsReviewLines: number;
    percent: number;
    headerStatus: string;
    steps: Array<{ key: string; done: boolean }>;
  };
  validation: { ok: boolean; issues: SetupValidationIssue[] };
  materialReadiness: {
    status: SetupMaterialStatus | string;
    anyShortage: boolean;
    anyNeedsSelection: boolean;
    anyNeedsReview: boolean;
  };
  lines: OrderProductionSetupLine[];
};

export type OrderProductionSetupReleasePreview = {
  salesOrderId: string;
  headerStatus: string;
  canRelease: boolean;
  validation: { ok: boolean; issues: SetupValidationIssue[] };
  materialReadiness: OrderProductionSetup['materialReadiness'];
  lines: Array<{
    salesOrderLineId: string;
    manufacturingName: string | null;
    quantity: number;
    manufacturingComplexity: ManufacturingComplexity | string | null;
    workflow: OrderProductionSetupLine['workflow'];
    packagingExpectation: SetupPackagingExpectation;
    materialStatus: SetupMaterialStatus | string;
    materials: Array<{
      sku: string | null;
      displayName: string | null;
      expectedQty: number;
      totalExpectedQty?: number;
      availability: SetupMaterialRequirement['availability'];
    }>;
  }>;
  note?: string;
};

export type PatchOrderSetupLineInput = {
  manufacturingName?: string;
  factoryNotes?: string | null;
  orderDimensions?: SetupDims;
  measurements?: SetupOrderMeasurement[];
  manufacturingComplexity?: 'STANDARD' | 'MODIFIED' | 'CUSTOM';
  requestedFabricLabel?: string | null;
  packagingExpectation?: {
    pieceLabels?: Array<{
      label?: string;
      nameEn?: string;
      nameAr?: string;
      nameHe?: string;
    }>;
    expectedPieceCount?: number | null;
  };
  workflowId?: string | null;
  confirmWorkflow?: boolean;
  materialsReviewed?: boolean;
  referenceDocumentIds?: string[];
};

export type PutOrderSetupMaterialsInput = {
  materials: Array<{
    inventoryItemId?: string | null;
    sku?: string | null;
    displayName?: string | null;
    category?: string | null;
    unit?: string;
    expectedQty: number;
    source?: 'CATALOG' | 'FACTORY_MODIFIED' | 'CUSTOM';
    needsReview?: boolean;
    notes?: string | null;
    requestedFabricLabel?: string | null;
  }>;
};

function setupBase(salesOrderId: string) {
  return `/sales-orders/${encodeURIComponent(salesOrderId)}/production-setup`;
}

export async function getOrderProductionSetup(
  salesOrderId: string,
): Promise<OrderProductionSetup> {
  return apiGet<OrderProductionSetup>(setupBase(salesOrderId));
}

export async function patchOrderSetupLine(
  salesOrderId: string,
  lineId: string,
  body: PatchOrderSetupLineInput,
): Promise<OrderProductionSetup> {
  return apiPatch<OrderProductionSetup>(
    `${setupBase(salesOrderId)}/lines/${encodeURIComponent(lineId)}`,
    body,
  );
}

export async function putOrderSetupLineMaterials(
  salesOrderId: string,
  lineId: string,
  body: PutOrderSetupMaterialsInput,
): Promise<OrderProductionSetup> {
  return apiPut<OrderProductionSetup>(
    `${setupBase(salesOrderId)}/lines/${encodeURIComponent(lineId)}/materials`,
    body,
  );
}

export async function seedOrderSetupLineFromCatalog(
  salesOrderId: string,
  lineId: string,
): Promise<OrderProductionSetup> {
  return apiPost<OrderProductionSetup>(
    `${setupBase(salesOrderId)}/lines/${encodeURIComponent(lineId)}/seed-from-catalog`,
  );
}

export async function markOrderProductionSetupReady(
  salesOrderId: string,
): Promise<OrderProductionSetup> {
  return apiPost<OrderProductionSetup>(`${setupBase(salesOrderId)}/mark-ready`);
}

export type EnsureOrderProductionPlanResult = {
  salesOrderId: string;
  productionOrderIds: string[];
  primaryProductionOrderId: string | null;
  created: boolean;
};

/** Soft-prepare + create draft POs so the Production Plan editor can open. */
export async function ensureOrderProductionPlan(
  salesOrderId: string,
): Promise<EnsureOrderProductionPlanResult> {
  return apiPost<EnsureOrderProductionPlanResult>(
    `${setupBase(salesOrderId)}/ensure-plan`,
  );
}

export async function releaseOrderProductionSetup(
  salesOrderId: string,
): Promise<OrderProductionSetup & { productionOrderIds?: string[] }> {
  return apiPost<OrderProductionSetup & { productionOrderIds?: string[] }>(
    `${setupBase(salesOrderId)}/release`,
  );
}

export async function getOrderProductionSetupReleasePreview(
  salesOrderId: string,
): Promise<OrderProductionSetupReleasePreview> {
  return apiGet<OrderProductionSetupReleasePreview>(
    `${setupBase(salesOrderId)}/release-preview`,
  );
}
