/** How much to add to this invoice’s allocation when a payment amount grows. */

export function planPaymentAllocationGrow(input: {
  extra: number;
  invoiceOutstanding: number;
}): number {
  const extra = Number(input.extra);
  const remaining = Number(input.invoiceOutstanding);
  if (!Number.isFinite(extra) || extra <= 1e-6) return 0;
  if (!Number.isFinite(remaining) || remaining <= 1e-6) return 0;
  return Math.min(extra, remaining);
}
