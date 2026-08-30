/**
 * Expected materials on SalesOrderLineMaterialRequirement are the costing
 * baseline (Piece 2). Piece 4 surfaces Estimated (planned) vs Actual (finalized
 * ProductionTaskMaterialUsage × valuation) on setup GET — read-only.
 *
 * Missing valuation = null / incomplete, never invent 0.00.
 * Does not mutate Product BOM or write usage.
 */
export const PIECE2_EXPECTED_MATERIAL_COSTING_HOOK = {
  sourceModel: 'SalesOrderLineMaterialRequirement',
  unit: 'expectedQty per finished unit × SalesOrderLine.quantity',
  priceSource: 'InventoryItem.standardCost (or latest purchase unit cost)',
  actualSource: 'ProductionTaskMaterialUsage (finalized) × same valuation map',
  doesNotMutate: ['Product.bomDefaults', 'ProductStageMaterialInput'],
  labels: {
    estimated: 'Estimated material cost (planned)',
    actual: 'Actual material cost (usage)',
  },
} as const;
