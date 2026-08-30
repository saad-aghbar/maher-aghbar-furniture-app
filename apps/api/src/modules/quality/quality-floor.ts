/**
 * Piece 9 — Quality / rework / packaging presentation + recommendation helpers.
 * No new Custody/QC tables — reuse QualityInspection + ReworkRequest.
 */

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
