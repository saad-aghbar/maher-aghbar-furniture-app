import {
  fabricStageI18nKey,
  fabricStatusKind,
  fabricStatusLabelKey,
  type FabricStatusSurface,
  type FabricTrackerRow,
} from './selectFabricTracker';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function resolveFabricStatusLabel(
  t: Translate,
  row: Pick<
    FabricTrackerRow,
    'derivedStatus' | 'overridden' | 'readyForProduction' | 'expectedQty' | 'arrivedQty' | 'attentionCode'
  >,
  surface: FabricStatusSurface,
): string {
  const kind = fabricStatusKind(row);
  const key = fabricStatusLabelKey(kind, surface);
  const value = t(key);
  if (value !== key) return value;
  const fallbackKey = `statuses.${row.derivedStatus}`;
  const fallback = t(fallbackKey);
  if (fallback !== fallbackKey) return fallback;
  return kind.replace(/_/g, ' ');
}

/** Localized factory stage — never the raw enum (UPHOLSTERY). */
export function resolveFabricStageLabel(t: Translate, stageCode: string | null | undefined): string | null {
  const key = fabricStageI18nKey(stageCode);
  if (!key) return null;
  const value = t(key);
  if (value !== key) return value;
  const raw = String(stageCode ?? '').trim();
  if (!raw) return null;
  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function looksLikeRawI18nKey(value: string): boolean {
  return /^(mobile|statuses|production|inventory|fabric|errors)\./.test(value);
}
