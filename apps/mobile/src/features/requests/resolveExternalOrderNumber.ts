/**
 * Dealer PO / external order number.
 * When the dealer leaves it blank, use the factory request number (RFQ-…).
 */
export function resolveExternalOrderNumber(
  dealerPo: string | undefined | null,
  factoryNumber: string | undefined | null,
): string | undefined {
  const po = String(dealerPo ?? '').trim();
  if (po) return po;
  const factory = String(factoryNumber ?? '').trim();
  return factory || undefined;
}
