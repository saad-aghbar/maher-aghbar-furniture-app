/** Named pieces inside a SEMI kit (setup → snapshot metadata → WIP labels). */
export type PieceLabel = {
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
};

export function isPackagingStageCode(code?: string | null): boolean {
  const c = String(code ?? '').toUpperCase();
  return c === 'PACKAGING' || c === 'PACK';
}

export function isInspectionStageCode(code?: string | null): boolean {
  return String(code ?? '').toUpperCase() === 'INSPECTION';
}

export function isDeliveryStageCode(code?: string | null): boolean {
  return String(code ?? '').toUpperCase() === 'DELIVERY';
}

export function normalizePieceLabels(raw: unknown): PieceLabel[] {
  if (!Array.isArray(raw)) return [];
  const out: PieceLabel[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const nameEn = String(rec.nameEn ?? '').trim();
    if (!nameEn) continue;
    const nameAr = String(rec.nameAr ?? '').trim() || nameEn;
    const heRaw = rec.nameHe == null ? '' : String(rec.nameHe).trim();
    out.push({ nameEn, nameAr, nameHe: heRaw || null });
  }
  return out;
}

export function pieceLabelsFromJson(raw: unknown): PieceLabel[] {
  return normalizePieceLabels(raw);
}

export function pieceLabelsFromMetadata(metadata: unknown): PieceLabel[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return normalizePieceLabels((metadata as Record<string, unknown>).pieceLabels);
}

export function labelForPieceIndex(
  labels: PieceLabel[] | null | undefined,
  index: number,
): string {
  const row = labels?.[index];
  if (row?.nameEn?.trim()) return row.nameEn.trim();
  if (row?.nameAr?.trim()) return row.nameAr.trim();
  return `Piece ${index + 1}`;
}

/** 1-based pieceIndex → packaging label, cycling when lot qty expands rows. */
export function packLabelForPieceIndex(
  labels: PieceLabel[] | null | undefined,
  pieceIndex1Based: number,
  packagesPerUnit?: number,
): PieceLabel | null {
  if (!labels?.length) return null;
  const perUnit = Math.max(1, Math.floor(Number(packagesPerUnit) || labels.length));
  const idx = ((Math.max(1, Math.floor(pieceIndex1Based)) - 1) % perUnit + perUnit) % perUnit;
  return labels[idx] ?? null;
}

export function mergeSnapshotMetadata(
  existing: unknown,
  pieceLabels: PieceLabel[] | null | undefined,
): Record<string, unknown> | undefined {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (pieceLabels?.length) {
    base.pieceLabels = pieceLabels;
  } else {
    delete base.pieceLabels;
  }
  return Object.keys(base).length ? base : undefined;
}
