import { apiGet, apiPost } from '../client';

export type QualityResult =
  | 'PASSED'
  | 'PASSED_WITH_NOTES'
  | 'FAILED_REWORK_REQUIRED'
  | 'BLOCKED';

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

export type QualityChecklistItem = {
  id: string;
  checklistCode: string;
  label: string;
  result?: string | null;
  note?: string | null;
};

export type QualityDefect = {
  id: string;
  description: string;
  severity?: string | null;
  stageCode?: string | null;
  correctiveAction?: string | null;
};

export type ReworkRequestSummary = {
  id: string;
  number: string;
  status: string;
  description?: string | null;
  notes?: string | null;
  reentryStageInstanceId?: string | null;
  completedAt?: string | null;
  tasks?: Array<{
    id: string;
    assignedEmployee?: { fullName?: string | null; username?: string | null } | null;
  }>;
  reentryStageInstance?: {
    id: string;
    stageDefinition?: { code?: string; nameEn?: string; nameAr?: string | null } | null;
  } | null;
  inspection?: {
    id: string;
    defects?: QualityDefect[];
  } | null;
};

export type QualityInspection = {
  id: string;
  number: string;
  productionOrderId: string;
  stageCode?: string | null;
  result?: QualityResult | string | null;
  notes?: string | null;
  inspectedAt?: string | null;
  createdAt?: string;
  items?: QualityChecklistItem[];
  defects?: QualityDefect[];
  rework?: ReworkRequestSummary[];
  inspector?: { fullName?: string | null; username?: string | null } | null;
};

export type ExpectedPackage = {
  code: string;
  labelEn: string;
  labelAr?: string | null;
};

export type ItemUnderInspection = {
  stageCode: string;
  stageNameEn: string;
  completedAt?: string | null;
  workerName?: string | null;
};

export type ManufacturingSpec = {
  complexity?: string;
  orderDimensions?: Record<string, unknown> | null;
  measurements?: unknown;
  factoryNotes?: string | null;
  requestedFabricLabel?: string | null;
  manufacturingName?: string | null;
};

export type QualityFloorContext = {
  productionOrderId: string;
  productionOrderNumber: string;
  salesOrderNumber?: string | null;
  dealerName?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  quantity: number;
  orderStatus: string;
  currentStageCode?: string | null;
  itemUnderInspection: ItemUnderInspection | null;
  manufacturingSpec: ManufacturingSpec | null;
  latestInspection: QualityInspection | null;
  inspections: QualityInspection[];
  openRework: ReworkRequestSummary | null;
  expectedPackages: ExpectedPackage[];
  packagingUnlocked: boolean;
  lightAnalytics: {
    inspectionAttempts: number;
    reworkCount: number;
    failureCategories: string[];
    latestResult?: string | null;
    openReworkStatus?: string | null;
  };
  timeline?: Array<{
    at: string;
    kind: string;
    titleEn: string;
    detailEn?: string | null;
    actorName?: string | null;
  }>;
  partialFailurePolicy?: string;
};

export type EligibleReworkStage = {
  stageInstanceId: string;
  stageCode: string;
  nameEn: string;
  nameAr?: string | null;
  executionKind?: string | null;
};

export type ReworkStagesResponse = {
  recommended: EligibleReworkStage | null;
  eligible: EligibleReworkStage[];
};

export type CreateInspectionBody = {
  productionOrderId: string;
  stageCode?: string;
  notes?: string;
  idempotencyKey?: string;
};

export type SubmitInspectionBody = {
  result: QualityResult;
  notes?: string;
  defectDescription?: string;
  defectCategory?: string;
  affectedQty?: number;
  severity?: string;
  reentryStageInstanceId?: string;
  idempotencyKey?: string;
  checklistResults?: Array<{ checklistCode: string; result: string; note?: string }>;
  photoDocumentIds?: string[];
};

export async function createInspection(body: CreateInspectionBody) {
  return apiPost<QualityInspection>('/quality-inspections', body);
}

export async function getInspection(id: string) {
  return apiGet<QualityInspection>(`/quality-inspections/${encodeURIComponent(id)}`);
}

export async function submitInspection(id: string, body: SubmitInspectionBody) {
  return apiPost<QualityInspection>(
    `/quality-inspections/${encodeURIComponent(id)}/submit`,
    body,
  );
}

export async function getFloorContext(productionOrderId: string) {
  return apiGet<QualityFloorContext>(
    `/quality-inspections/orders/${encodeURIComponent(productionOrderId)}/context`,
  );
}

export async function getReworkStages(productionOrderId: string, category?: string) {
  const qs = category
    ? `?category=${encodeURIComponent(category)}`
    : '';
  return apiGet<ReworkStagesResponse>(
    `/quality-inspections/orders/${encodeURIComponent(productionOrderId)}/rework-stages${qs}`,
  );
}

export async function startRework(
  reworkId: string,
  body: { stageInstanceId: string; notes?: string },
) {
  return apiPost<ReworkRequestSummary>(
    `/quality-inspections/rework/${encodeURIComponent(reworkId)}/start`,
    body,
  );
}

export async function completeRework(reworkId: string) {
  return apiPost<ReworkRequestSummary>(
    `/quality-inspections/rework/${encodeURIComponent(reworkId)}/complete`,
  );
}
