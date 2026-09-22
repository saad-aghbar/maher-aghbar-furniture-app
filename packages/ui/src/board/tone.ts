export type BoardTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

/** Ink color for a tone (CSS var expression). Neutral falls back to brand. */
export function toneInk(tone: BoardTone | undefined): string {
  switch (tone) {
    case 'success':
      return 'var(--maher-success)';
    case 'warning':
      return 'var(--maher-warning)';
    case 'error':
      return 'var(--maher-error)';
    case 'info':
      return 'var(--maher-info)';
    case 'neutral':
      return 'var(--maher-text-tertiary)';
    default:
      return 'var(--maher-brand)';
  }
}

/** Soft wash color for a tone (CSS var expression). */
export function toneSoft(tone: BoardTone | undefined): string {
  switch (tone) {
    case 'success':
      return 'var(--maher-success-soft)';
    case 'warning':
      return 'var(--maher-warning-soft)';
    case 'error':
      return 'var(--maher-error-soft)';
    case 'info':
      return 'var(--maher-info-soft)';
    case 'neutral':
      return 'var(--maher-surface-muted)';
    default:
      return 'var(--maher-brand-soft)';
  }
}

/** Map a factory signal word to a tone. Used by dashboards to color rows from tile keys. */
export function toneFromKey(key: string, count = 1): BoardTone {
  if (count <= 0) return 'neutral';
  if (/overdue|late|fail|shortage|conflict|critical|cancel/i.test(key)) return 'error';
  if (/block|waiting|needs|attention|correction|return|incomplete|rework|hold/i.test(key)) {
    return 'warning';
  }
  if (/passed|finished|completed|done|shipped|received|arriving/i.test(key)) return 'success';
  return 'brand';
}
