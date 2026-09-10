import type { TaskWipOutput, TaskWipOutputPiece } from '@/api/modules/tasks';

export type OutputPiecePlan = {
  index: number;
  label: string;
  nameEn?: string;
  nameAr?: string | null;
  nameHe?: string | null;
};

export type OutputKitPieceSlot = {
  expectedIndex: number;
  planIndex: number;
  plan: OutputPiecePlan;
  existing: TaskWipOutputPiece | null;
};

export type OutputKitCard = {
  kitIndex: number;
  assigned: boolean;
  pieces: OutputKitPieceSlot[];
  extras: OutputKitPieceSlot[];
};

/** Extra pieces sit above planned sortOrders so they never collide with kit 2+. */
export const EXTRA_PIECE_SORT_BASE = 10_000;
export const EXTRA_PIECE_KIT_STRIDE = 100;

export function extraPieceSortOrder(kitIndex: number, extraIndex: number): number {
  return EXTRA_PIECE_SORT_BASE + kitIndex * EXTRA_PIECE_KIT_STRIDE + extraIndex;
}

export function kitIndexForExtraSortOrder(sortOrder: number): number | null {
  if (sortOrder < EXTRA_PIECE_SORT_BASE) return null;
  return Math.floor((sortOrder - EXTRA_PIECE_SORT_BASE) / EXTRA_PIECE_KIT_STRIDE);
}

export function nextExtraSortOrder(kitIndex: number, pieces: TaskWipOutputPiece[]): number {
  let maxExtra = -1;
  for (const piece of pieces) {
    if (kitIndexForExtraSortOrder(piece.sortOrder) !== kitIndex) continue;
    const extraIndex =
      piece.sortOrder - EXTRA_PIECE_SORT_BASE - kitIndex * EXTRA_PIECE_KIT_STRIDE;
    if (extraIndex > maxExtra) maxExtra = extraIndex;
  }
  return extraPieceSortOrder(kitIndex, maxExtra + 1);
}

export function fallbackPiecePlan(count: number): OutputPiecePlan[] {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: n }, (_, index) => ({
    index,
    label: `Piece ${index + 1}`,
    nameEn: `Piece ${index + 1}`,
  }));
}

export function piecePlanFromOutput(meta: TaskWipOutput | null, fallbackCount: number): OutputPiecePlan[] {
  const named = meta?.expectedPieces ?? [];
  if (named.length > 0) {
    return named.map((row, index) => ({
      index: row.index ?? index,
      label: row.label,
      nameEn: row.nameEn ?? row.label,
      nameAr: row.nameAr,
      nameHe: row.nameHe,
    }));
  }
  return fallbackPiecePlan(meta?.piecesPerKit ?? meta?.expectedPieceCount ?? fallbackCount);
}

export function buildWorkerOutputKits(args: {
  expectedKitCount: number;
  piecePlan: OutputPiecePlan[];
  pieces: TaskWipOutputPiece[];
}): { kits: OutputKitCard[]; leftover: TaskWipOutputPiece[] } {
  const plan = args.piecePlan.length > 0 ? args.piecePlan : fallbackPiecePlan(1);
  const perKit = plan.length;
  const assigned = Math.max(1, Math.floor(Number(args.expectedKitCount) || 1));
  const used = new Set<string>();
  const kits: OutputKitCard[] = Array.from({ length: assigned }, (_, kitIndex) => {
    const pieces: OutputKitPieceSlot[] = plan.map((row, planIndex) => {
      const expectedIndex = kitIndex * perKit + planIndex;
      const existing = args.pieces.find((p) => p.sortOrder === expectedIndex) ?? null;
      if (existing) used.add(existing.id);
      return {
        expectedIndex,
        planIndex,
        plan: row,
        existing,
      };
    });
    const extras: OutputKitPieceSlot[] = args.pieces
      .filter((p) => kitIndexForExtraSortOrder(p.sortOrder) === kitIndex)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p, i) => {
        used.add(p.id);
        const label = p.label?.trim() || `Piece ${perKit + i + 1}`;
        return {
          expectedIndex: p.sortOrder,
          planIndex: perKit + i,
          plan: { index: p.sortOrder, label, nameEn: label },
          existing: p,
        };
      });
    return {
      kitIndex,
      assigned: true,
      pieces,
      extras,
    };
  });
  return {
    kits,
    leftover: args.pieces.filter((p) => !used.has(p.id)),
  };
}
