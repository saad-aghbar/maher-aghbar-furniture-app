export const PURCHASE_ORDER_ORIGINS = [
  'MANUAL',
  'LOW_STOCK',
  'DEMAND',
  'FABRIC',
  'REQUEST',
] as const;

export type PurchaseOrderOrigin = (typeof PURCHASE_ORDER_ORIGINS)[number];

export function normalizePurchaseOrderOrigin(
  value: string | null | undefined,
  fallback: PurchaseOrderOrigin = 'MANUAL',
): PurchaseOrderOrigin {
  const next = String(value ?? '').trim().toUpperCase();
  return (PURCHASE_ORDER_ORIGINS as readonly string[]).includes(next)
    ? (next as PurchaseOrderOrigin)
    : fallback;
}
