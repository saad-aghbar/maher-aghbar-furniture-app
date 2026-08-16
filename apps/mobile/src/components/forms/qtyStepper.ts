export type QtyStepperBounds = {
  min?: number;
  max?: number;
  decimals?: number;
  step?: number;
};

export function sanitizeQtyInput(raw: string): string {
  const next = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const dot = next.indexOf('.');
  if (dot === -1) return next;
  return `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`;
}

export function parseQty(value: string): number | null {
  const trimmed = String(value).trim().replace(',', '.');
  if (trimmed === '' || trimmed === '.') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function formatQty(n: number, decimals = 2): string {
  return String(Number(n.toFixed(decimals)));
}

export function bumpQtyValue(value: string, delta: number, bounds: QtyStepperBounds = {}): string {
  const min = bounds.min ?? 0;
  const max = bounds.max;
  const decimals = bounds.decimals ?? 2;
  const step = Math.abs(bounds.step ?? delta);
  const cur = parseQty(value);
  let next: number;
  if (cur == null) {
    next = delta > 0 ? Math.max(min, step) : min;
  } else {
    next = cur + delta;
  }
  if (next < min) next = min;
  if (max != null && next > max) next = max;
  return formatQty(next, decimals);
}
