export type DealerPricePick = {
  productId: string;
  variantId?: string | null;
  price: unknown;
  currency: string;
};

/** Prefer a variant-specific dealer price, then the product-level row. */
export function preferDealerPrice<T extends DealerPricePick>(
  rows: T[],
  productId: string,
  preferredVariantId?: string | null,
): T | null {
  const mine = rows.filter((row) => row.productId === productId);
  if (preferredVariantId) {
    const variantRow = mine.find((row) => row.variantId === preferredVariantId);
    if (variantRow) return variantRow;
  }
  return mine.find((row) => row.variantId == null) ?? null;
}

/** Per-customer: variant price overrides product-level, else fall through. */
export function mergeVariantDealerPrices<T extends { customerId: string; variantId?: string | null }>(
  rows: T[],
  variantId: string,
): T[] {
  const byCustomer = new Map<string, T>();
  for (const row of rows) {
    if (row.variantId == null) byCustomer.set(row.customerId, row);
  }
  for (const row of rows) {
    if (row.variantId === variantId) byCustomer.set(row.customerId, row);
  }
  return [...byCustomer.values()];
}
