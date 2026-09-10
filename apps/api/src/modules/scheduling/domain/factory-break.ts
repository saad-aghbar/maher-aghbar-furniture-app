export const DEFAULT_FACTORY_BREAK = { start: '12:00', end: '12:30' } as const;
export const LEGACY_HOUR_LUNCH = { start: '12:00', end: '13:00' } as const;

export const DEFAULT_FACTORY_BREAKS = [DEFAULT_FACTORY_BREAK];

/** True when the stored break list is exactly the old 12:00–13:00 lunch. */
export function isLegacyHourLunch(breaks: unknown): boolean {
  if (!Array.isArray(breaks) || breaks.length !== 1) return false;
  const row = breaks[0] as { start?: unknown; end?: unknown };
  return row?.start === LEGACY_HOUR_LUNCH.start && row?.end === LEGACY_HOUR_LUNCH.end;
}
