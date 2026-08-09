/**
 * Caption under an order ProgressBar: floor stage (or coarse dealer label) · percent.
 * Percent is wrapped in LTR isolates so Arabic bidi never detaches `%` from the digits.
 */
export function formatOrderProgressCaption(
  progressPercent: number,
  progressLabel?: string | null,
): string {
  const pct = Math.round(Number(progressPercent) || 0);
  const label = progressLabel?.trim();
  // U+2066 LRI … U+2069 PDI — keep "41%" as one LTR run inside RTL text.
  const pctToken = `\u2066${pct}%\u2069`;
  if (label) return `${label} · ${pctToken}`;
  return pctToken;
}

/** Digits + % only, already LTR-safe for embedding in Arabic UI. */
export function formatOrderProgressPercent(progressPercent: number): string {
  const pct = Math.round(Number(progressPercent) || 0);
  return `\u2066${pct}%\u2069`;
}
