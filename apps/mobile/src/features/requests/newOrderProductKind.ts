/** True when the dealer typed a model name without selecting a catalog product. */
export function isCustomCatalogProduct(
  productId: string | undefined | null,
  modelName: string,
): boolean {
  return Boolean(modelName.trim()) && !String(productId ?? '').trim();
}

/** Clamp New Order qty into the same 1..99 band as catalog PDP. */
export function clampOrderQuantity(raw: number | string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, n));
}
