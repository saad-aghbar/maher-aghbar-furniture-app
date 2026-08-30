/**
 * Human-readable status presentation for mobile UI.
 * Prefer `mobile.status.*` i18n when `t` is provided; otherwise Piece 13 EN fallbacks.
 */

const HUMAN_FALLBACK: Record<string, string> = {
  OUT_FOR_DELIVERY: 'Shipped',
  READY_FOR_DELIVERY: 'Ready',
  PLANNED: 'Planned',
  UNDER_REVIEW: 'Under review',
  READY_FOR_INSPECTION: 'Waiting inspection',
  FAILED_REWORK_REQUIRED: 'Fail-rework',
  IN_PRODUCTION: 'In production',
  READY_FOR_PRODUCTION: 'Ready to start',
  WAITING_FOR_MATERIALS: 'Waiting for materials',
  NEEDS_INFORMATION: 'Needs information',
  READY_FOR_QUOTATION: 'Ready for quotation',
  READY_FOR_PACKAGING: 'Ready for packaging',
  PARTIALLY_PAID: 'Partially paid',
  ISSUED: 'Open',
  VOID: 'Void',
  ON_HOLD: 'On hold',
  IN_PROGRESS: 'In progress',
  NOT_STARTED: 'Not started',
  NEEDS_REVIEW: 'Needs review',
  SETUP_REQUIRED: 'Setup required',
  SETUP_IN_PROGRESS: 'Preparing',
  READY_FOR_RELEASE: 'Ready for release',
  AWAITING_APPROVAL: 'Awaiting approval',
  AWAITING_CONFIRMATION: 'Awaiting confirmation',
  MAY_BE_DELAYED: 'May be delayed',
  AT_RISK: 'May be late',
  WAITING_RETURN: 'Waiting for return',
  NEED_INFO: 'Needs information',
};

function normalizeStatusKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '_');
}

function titleCaseStatus(key: string): string {
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map a raw status enum to a human label.
 * When `t` is passed, prefers `mobile.status.<ENUM>` if the key resolves.
 */
export function presentStatus(
  raw: string | null | undefined,
  t?: (key: string) => string,
): string {
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  const key = normalizeStatusKey(trimmed);

  if (t) {
    const i18nKey = `mobile.status.${key}`;
    const translated = t(i18nKey);
    if (translated !== i18nKey) return translated;
  }

  if (HUMAN_FALLBACK[key]) return HUMAN_FALLBACK[key];
  return titleCaseStatus(key);
}
