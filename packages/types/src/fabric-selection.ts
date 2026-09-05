/**
 * Dealer fabric selection — commercial options, never manufacturing signals.
 * Singular fabric/color fields stay for back-compat; `fabrics[]` is canonical.
 */

export type OrderFabricSelection = {
  key: string;
  type?: string | null;
  code?: string | null;
  color?: string | null;
  role?: string | null;
  photoDocumentId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  alternate?: {
    type?: string | null;
    code?: string | null;
    color?: string | null;
  } | null;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function newKey(): string {
  return `fab-${Math.random().toString(36).slice(2, 10)}`;
}

function fromSingular(input: {
  type?: string | null;
  code?: string | null;
  color?: string | null;
}): OrderFabricSelection | null {
  const type = str(input.type);
  const code = str(input.code);
  const color = str(input.color);
  if (!type && !code && !color) return null;
  return { key: 'legacy', type, code, color, unit: 'm' };
}

function parseOne(raw: unknown, index: number): OrderFabricSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = str(r.type) ?? str(r.name) ?? str(r.fabric);
  const code = str(r.code) ?? str(r.fabricCode);
  const color = str(r.color) ?? str(r.fabricColor);
  const role = str(r.role) ?? str(r.placement) ?? str(r.use);
  const notes = str(r.notes) ?? str(r.description);
  const photoDocumentId = str(r.photoDocumentId) ?? str(r.photoId);
  const quantity = num(r.quantity) ?? num(r.qty);
  const unit = str(r.unit) ?? 'm';
  const altRaw = r.alternate && typeof r.alternate === 'object' ? (r.alternate as Record<string, unknown>) : null;
  const alternate = altRaw
    ? {
        type: str(altRaw.type) ?? str(altRaw.name),
        code: str(altRaw.code),
        color: str(altRaw.color),
      }
    : null;
  if (!type && !code && !color && !role && !notes && !photoDocumentId) return null;
  return {
    key: str(r.key) ?? `fab-${index + 1}`,
    type,
    code,
    color,
    role,
    photoDocumentId,
    quantity,
    unit,
    notes,
    alternate,
  };
}

/** Normalize a fabrics JSON payload, falling back to singular type/code/color. */
export function normalizeOrderFabrics(
  fabrics: unknown,
  singular?: { type?: string | null; code?: string | null; color?: string | null } | null,
): OrderFabricSelection[] {
  if (Array.isArray(fabrics)) {
    const rows = fabrics
      .map((row, i) => parseOne(row, i))
      .filter((row): row is OrderFabricSelection => Boolean(row));
    if (rows.length) return rows;
  }
  const one = singular ? fromSingular(singular) : null;
  return one ? [one] : [];
}

export function primaryFabric(fabrics: OrderFabricSelection[]): OrderFabricSelection | null {
  return fabrics[0] ?? null;
}

export function fabricLabelFromSelection(row: OrderFabricSelection | null | undefined): string | null {
  if (!row) return null;
  const parts = [row.type, row.code, row.color].map((x) => str(x)).filter((x): x is string => Boolean(x));
  return parts.length ? parts.join(' · ') : null;
}

export function fabricSelectionsLabel(fabrics: OrderFabricSelection[]): string | null {
  const labels = fabrics.map((f) => fabricLabelFromSelection(f)).filter((x): x is string => Boolean(x));
  return labels.length ? labels.join('; ') : null;
}

export function emptyFabricSelection(): OrderFabricSelection {
  return { key: newKey(), type: '', color: '', role: '', code: '', unit: 'm' };
}
