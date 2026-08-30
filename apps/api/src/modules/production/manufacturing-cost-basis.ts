/**
 * Piece 5 — MANUFACTURING INVENTORY COST BASIS.
 *
 * Policy: InventoryItem.standardCost as base; latest costed InventoryTransaction
 * with PURCHASE_RECEIPT preferred overlays standard (buildMaterialCostMap).
 *
 * Chain: Purchase receipt / GRN unitCost → inventory valuation map →
 * production finalize freezes unitCost on ISSUE/RETURN + usage extendedCost.
 *
 * Missing valuation = null / incomplete — never invent 0.00.
 */
export const MANUFACTURING_INVENTORY_COST_BASIS = {
  id: 'standardCost+latestPurchaseReceipt',
  helper: 'buildMaterialCostMap',
  neverInventZero: true,
  netQtyFormula: 'actual+scrap-returned',
  scrapCharged: true,
  semiFinDoubleCount: false,
} as const;
