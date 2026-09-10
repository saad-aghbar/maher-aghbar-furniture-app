/** UI shows percent; API stores a 0–1 fraction (Decimal 5,4). */

export function storedTaxRateToPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const pct = n > 1 + 1e-9 ? n : n * 100;
  return Math.round(pct * 100) / 100;
}

export function percentToStoredTaxRate(percent: unknown): number {
  const n = Number(percent);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(9.9999, Math.round((n / 100) * 10_000) / 10_000);
}
