/**
 * Formatting helpers. All numeric output uses Western (Latin) digits on purpose,
 * including in Arabic, so quantities and money read consistently.
 */

const NUMERIC_LOCALE = 'en-US';

export function formatNumber(value: unknown, fractionDigits?: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 2,
  });
}

export function formatMoney(value: unknown, currency = 'JOD'): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(NUMERIC_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mi}`;
}

export function formatMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const total = Math.max(0, Math.round(Number(value)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Days until a date; negative means overdue. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}
