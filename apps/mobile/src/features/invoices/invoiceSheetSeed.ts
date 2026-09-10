/** Seed a money sheet only on open, not on every remaining/payment tick. */

export function shouldSeedInvoiceSheet(
  open: boolean,
  wasOpen: boolean,
): boolean {
  return open && !wasOpen;
}

export function applyCreditLocalPreview(
  amount: number,
  remaining: number,
  availableCredit: number,
): {
  applyAmount: number;
  invoiceRemainingAfter: number;
  creditRemainingAfter: number;
} {
  const want = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const capRemaining = Math.max(0, remaining);
  const capCredit = Math.max(0, availableCredit);
  const apply = Math.min(want, capRemaining, capCredit);
  return {
    applyAmount: apply,
    invoiceRemainingAfter: Math.max(0, Math.round((capRemaining - apply) * 1000) / 1000),
    creditRemainingAfter: Math.max(0, Math.round((capCredit - apply) * 1000) / 1000),
  };
}
