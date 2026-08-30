import { statusLabel } from '@maher/i18n';

/** SNAKE_CASE / kebab / spaced leftovers → STATUS_KEY. */
export function normalizeChipKey(raw: string): string {
  return raw
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleCaseWords(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Badge copy for leftover enum-ish chips (SPEC_INCOMPLETE, "Spec incomplete").
 * Prefers `statuses` i18n; otherwise title-cases the key instead of screaming SNAKE.
 */
export function humanizeOrderChip(
  locale: string,
  raw: string | null | undefined,
): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  const key = normalizeChipKey(trimmed);
  if (!key) return trimmed;
  const labeled = statusLabel(locale, key);
  if (labeled !== key.replace(/_/g, ' ')) return labeled;
  return titleCaseWords(key);
}

export function chipsLookLikeSameLabel(a: string, b: string): boolean {
  return normalizeChipKey(a) === normalizeChipKey(b);
}
