/** Always a digit. Empty reads 0 — never a dash or blank. */
export function honestJourneyCount(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return String(Math.max(0, Math.round(n)));
}
