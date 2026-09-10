import {
  isPieceChecklistCode,
  wipPieceIdFromChecklistCode,
} from './inspection-pieces';

export function inspectionSubmitGate(result?: string | null) {
  const normalized = String(result ?? '').toUpperCase();
  const wantsPass = normalized === 'PASSED' || normalized === 'PASSED_WITH_NOTES';
  const wantsFail = normalized === 'FAILED_REWORK_REQUIRED' || normalized === 'BLOCKED';
  return {
    wantsPass,
    wantsFail,
    allPass: wantsPass,
    skipPiecePlans: wantsPass || wantsFail,
  };
}

export type InspectionItemResult = 'PASS' | 'FAIL' | string | null | undefined;

export type InspectionChecklistPatch = {
  checklistCode: string;
  result: string;
  note?: string;
  reentryStageInstanceIds?: string[];
  voiceDocumentId?: string;
  photoDocumentIds?: string[];
  defectDescription?: string;
};

export type ClassifiedInspection = {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  allPass: boolean;
  hasFail: boolean;
  complete: boolean;
  isPartial: boolean;
};

export function classifyInspectionItems(
  items: Array<{ result?: InspectionItemResult }>,
): ClassifiedInspection {
  const total = items.length;
  const passed = items.filter((i) => String(i.result ?? '').toUpperCase() === 'PASS').length;
  const failed = items.filter((i) => String(i.result ?? '').toUpperCase() === 'FAIL').length;
  const pending = Math.max(0, total - passed - failed);
  const allPass = total > 0 && passed === total;
  const hasFail = failed > 0;
  const complete = pending === 0 && total > 0;
  return {
    total,
    passed,
    failed,
    pending,
    allPass,
    hasFail,
    complete,
    isPartial: hasFail && !allPass,
  };
}

export function mergeChecklistPatches(
  items: Array<{
    id: string;
    checklistCode: string;
    result?: InspectionItemResult;
    note?: string | null;
    wipPieceId?: string | null;
    reentryStageInstanceIds?: string[];
    voiceDocumentId?: string | null;
    photoDocumentIds?: string[];
  }>,
  patches: InspectionChecklistPatch[] | undefined,
) {
  const byCode = new Map((patches ?? []).map((p) => [p.checklistCode, p]));
  return items.map((item) => {
    const patch = byCode.get(item.checklistCode);
    if (!patch) return item;
    const ids = (patch.reentryStageInstanceIds ?? []).filter(Boolean);
    return {
      ...item,
      result: patch.result ?? item.result,
      note: patch.note ?? patch.defectDescription ?? item.note,
      wipPieceId: item.wipPieceId ?? wipPieceIdFromChecklistCode(item.checklistCode),
      reentryStageInstanceIds: ids.length ? ids : item.reentryStageInstanceIds ?? [],
      voiceDocumentId: patch.voiceDocumentId ?? item.voiceDocumentId,
      photoDocumentIds: patch.photoDocumentIds?.length
        ? patch.photoDocumentIds
        : item.photoDocumentIds ?? [],
    };
  });
}

export type PieceReworkPlan = {
  inspectionItemId: string;
  wipPieceId: string | null;
  checklistCode: string;
  description: string;
  stageInstanceIds: string[];
};

export function pieceReworkPlans(
  items: Array<{
    id: string;
    checklistCode: string;
    result?: InspectionItemResult;
    note?: string | null;
    wipPieceId?: string | null;
    reentryStageInstanceIds?: string[];
  }>,
  fallbackStageInstanceId?: string | null,
): PieceReworkPlan[] {
  const out: PieceReworkPlan[] = [];
  for (const item of items) {
    if (String(item.result ?? '').toUpperCase() !== 'FAIL') continue;
    if (!isPieceChecklistCode(item.checklistCode) && !item.wipPieceId) continue;
    const stages = [...new Set((item.reentryStageInstanceIds ?? []).filter(Boolean))];
    if (!stages.length && fallbackStageInstanceId) stages.push(fallbackStageInstanceId);
    if (!stages.length) continue;
    out.push({
      inspectionItemId: item.id,
      wipPieceId: item.wipPieceId ?? wipPieceIdFromChecklistCode(item.checklistCode),
      checklistCode: item.checklistCode,
      description: String(item.note ?? '').trim() || 'Piece failed inspection',
      stageInstanceIds: stages,
    });
  }
  return out;
}
