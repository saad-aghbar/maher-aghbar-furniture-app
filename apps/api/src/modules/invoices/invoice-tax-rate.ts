/** Invoice line taxRate is Decimal(5,4): a fraction (0.16 = 16%). */

export function normalizeInvoiceTaxRate(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const fraction = n > 1 + 1e-9 ? n / 100 : n;
  const rounded = Math.round(fraction * 10_000) / 10_000;
  return Math.min(9.9999, Math.max(0, rounded));
}

export function taxAmountOnNet(net: number, taxRateRaw: unknown): number {
  return Number(net) * normalizeInvoiceTaxRate(taxRateRaw);
}
