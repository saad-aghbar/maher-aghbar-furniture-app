import { fillPieceLabelsToCount, pieceLabelsFromMetadata } from '../production/piece-labels';
import { kitFeedsConsumerNode } from '../production/workflow/domain/wip-handoff';

export const PIECE_CHECKLIST_PREFIX = 'PIECE:';

export type IncomingPieceForInspection = {
  wipPieceId: string | null;
  checklistCode: string;
  label: string;
  photoDocumentId: string | null;
  kitId: string | null;
  kitLabel: string | null;
  kitLabelAr?: string | null;
  kitLabelHe?: string | null;
};

export function pieceChecklistCode(wipPieceId: string | null, index: number): string {
  if (wipPieceId) return `${PIECE_CHECKLIST_PREFIX}${wipPieceId}`;
  return `${PIECE_CHECKLIST_PREFIX}idx-${index + 1}`;
}

export function isPieceChecklistCode(code?: string | null): boolean {
  return String(code ?? '').startsWith(PIECE_CHECKLIST_PREFIX);
}

export function wipPieceIdFromChecklistCode(code?: string | null): string | null {
  const raw = String(code ?? '');
  if (!raw.startsWith(PIECE_CHECKLIST_PREFIX)) return null;
  const rest = raw.slice(PIECE_CHECKLIST_PREFIX.length);
  if (!rest || rest.startsWith('idx-')) return null;
  return rest;
}

export function piecesFromWipKits(
  kits: Array<{
    id: string;
    pieces?: Array<{
      id: string;
      label?: string | null;
      sortOrder?: number | null;
      photoDocumentId?: string | null;
    }>;
    expectedPieceCount?: number | null;
    snapshotMetadata?: unknown;
    outputNameEn?: string | null;
    outputNameAr?: string | null;
    outputNameHe?: string | null;
  }>,
): IncomingPieceForInspection[] {
  const out: IncomingPieceForInspection[] = [];
  let index = 0;
  for (const kit of kits) {
    const kitLabel = kit.outputNameEn || kit.outputNameAr || kit.outputNameHe || null;
    const pieces = [...(kit.pieces ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    if (pieces.length) {
      for (const piece of pieces) {
        out.push({
          wipPieceId: piece.id,
          checklistCode: pieceChecklistCode(piece.id, index),
          label: piece.label?.trim() || kitLabel || `Piece ${index + 1}`,
          photoDocumentId: piece.photoDocumentId ?? null,
          kitId: kit.id,
          kitLabel,
          kitLabelAr: kit.outputNameAr ?? null,
          kitLabelHe: kit.outputNameHe ?? null,
        });
        index += 1;
      }
      continue;
    }
    const labels = fillPieceLabelsToCount(
      pieceLabelsFromMetadata(kit.snapshotMetadata),
      Math.max(1, Math.floor(Number(kit.expectedPieceCount) || 1)),
    );
    for (const label of labels) {
      out.push({
        wipPieceId: null,
        checklistCode: pieceChecklistCode(null, index),
        label: label.nameEn || kitLabel || `Piece ${index + 1}`,
        photoDocumentId: null,
        kitId: kit.id,
        kitLabel,
        kitLabelAr: kit.outputNameAr ?? null,
        kitLabelHe: kit.outputNameHe ?? null,
      });
      index += 1;
    }
  }
  return out;
}

/** Kits produced by the stage that feeds inspection — never the whole order. */
export function selectKitsForInspection<
  T extends { snapshotNodeId?: string | null; nextSnapshotNodeIds?: unknown },
>(
  kits: T[],
  consumerSnapshotNodeId: string,
  edges: Array<{ fromSnapshotNodeId: string; toSnapshotNodeId: string }>,
  predecessorSnapshotNodeIds: string[],
): T[] {
  const feeding = kits.filter((kit) =>
    kitFeedsConsumerNode({
      nextSnapshotNodeIds: kit.nextSnapshotNodeIds,
      snapshotNodeId: kit.snapshotNodeId,
      consumerSnapshotNodeId,
      edges,
    }),
  );
  if (feeding.length) return feeding;
  const pred = new Set(predecessorSnapshotNodeIds.filter(Boolean));
  if (!pred.size) return [];
  return kits.filter((kit) => Boolean(kit.snapshotNodeId && pred.has(kit.snapshotNodeId)));
}

export function inspectionItemsNeedResync(
  existing: Array<{ checklistCode: string }>,
  wanted: Array<{ checklistCode: string }>,
): boolean {
  if (existing.some((item) => !isPieceChecklistCode(item.checklistCode))) return true;
  if (existing.length !== wanted.length) return true;
  const have = new Set(existing.map((item) => item.checklistCode));
  return wanted.some((piece) => !have.has(piece.checklistCode));
}

export function checklistProgressPercent(items: Array<{ result?: string | null }>): number {
  if (!items.length) return 0;
  const passed = items.filter((i) => String(i.result ?? '').toUpperCase() === 'PASS').length;
  return Math.min(100, Math.floor((passed / items.length) * 100));
}
