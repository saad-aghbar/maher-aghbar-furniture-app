import { statusLabel } from '@maher/i18n';
import type { Locale } from '@maher/types';
import { translate } from '@/i18n/translate';
import { englishStatusFallback } from './badgeStyles';

const STATUS_ENUM = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

/** Extra mobile keys for codes that are not in `statuses.*` (request origin, etc.). */
const STATUS_MESSAGE_KEYS = ['mobile.adminRequest.source.'] as const;

export function normalizeStatusKey(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_');
}

export function looksLikeStatusEnum(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) return false;
  return STATUS_ENUM.test(trimmed);
}

function isUnresolvedStatusLabel(key: string, labeled: string): boolean {
  return labeled === key || labeled === key.replace(/_/g, ' ');
}

/**
 * Localized status copy for EN / AR / HE.
 * Never returns SCREAMING_SNAKE — unknown codes title-case as a last resort.
 */
export function displayStatusLabel(locale: Locale, status: string): string {
  const key = normalizeStatusKey(status);
  if (!key) return status;

  const fromStatuses = statusLabel(locale, key);
  if (!isUnresolvedStatusLabel(key, fromStatuses)) return fromStatuses;

  for (const prefix of STATUS_MESSAGE_KEYS) {
    const path = `${prefix}${key}`;
    const translated = translate(locale, path);
    if (translated !== path) return translated;
  }

  return englishStatusFallback(key);
}

/**
 * Search / list subtitles often arrive as `PARTIALLY_PAID · 196.27`.
 * Localize the leading enum; leave the rest of the line intact.
 */
export function localizeStatusPrefixedText(locale: Locale, raw: string): string {
  const text = raw.trim();
  if (!text) return raw;

  const parts = text.split(/\s*[·•|]\s*/);
  const head = parts[0]?.trim() ?? '';
  if (!looksLikeStatusEnum(head)) return raw;

  const labeled = displayStatusLabel(locale, head);
  if (parts.length === 1) return labeled;
  return [labeled, ...parts.slice(1)].join(' · ');
}
