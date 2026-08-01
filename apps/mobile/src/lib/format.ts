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

type Translate = (key: string, fallback?: string) => string;

/**
 * Localised relative-day label. Uses proper pluralisation instead of a raw "d"
 * suffix, and special-cases today / tomorrow.
 *
 * `kind` selects the framing: due dates, quote expiry, or overdue.
 */
export function relativeDay(
  days: number | null | undefined,
  t: Translate,
  kind: 'due' | 'expires' | 'overdue' = 'due',
): string | undefined {
  if (days == null || !Number.isFinite(days)) return undefined;
  const n = Math.trunc(days);

  if (kind === 'overdue' || n < 0) {
    const abs = Math.abs(n);
    if (abs === 0) return t('mobile.dueToday', 'Due today');
    const unit = abs === 1 ? t('mobile.day', 'day') : t('mobile.days', 'days');
    return t('mobile.relativeOverdue', 'Overdue by {n} {unit}')
      .replace('{n}', String(abs))
      .replace('{unit}', unit);
  }

  if (n === 0) {
    return kind === 'expires'
      ? t('mobile.expiresToday', 'Expires today')
      : t('mobile.dueToday', 'Due today');
  }
  if (n === 1 && kind === 'due') return t('mobile.dueTomorrow', 'Due tomorrow');

  const unit = n === 1 ? t('mobile.day', 'day') : t('mobile.days', 'days');
  const template =
    kind === 'expires'
      ? t('mobile.relativeExpiresIn', 'Expires in {n} {unit}')
      : t('mobile.relativeDueIn', 'Due in {n} {unit}');
  return template.replace('{n}', String(n)).replace('{unit}', unit);
}

/**
 * Last-resort label for a backend enum that has no translation yet,
 * e.g. READY_FOR_DELIVERY -> "Ready for delivery". Never show the raw enum.
 */
export function humaniseEnum(value: string): string {
  return value
    .toLowerCase()
    .split(/[_-]/)
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('');
}
