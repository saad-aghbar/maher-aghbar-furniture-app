/**
 * Expected materials on SalesOrderLineMaterialRequirement are the costing
 * baseline (Piece 2). Piece 4/5 surfaces Estimated (planned) vs Actual
 * (usage × valuation) on setup / order detail — read-only.
 *
 * Actual updates throughout production:
 * - Draft / in-progress usage → provisional cost from live inventory map
 * - Task finalize → frozen unitCost/extendedCost on the usage row
 * - FINAL when PO is complete and all usages are finalized + valued
 *
 * Missing valuation = null / incomplete, never invent 0.00.
 * Does not mutate Product BOM or write usage.
 */
export const PIECE2_EXPECTED_MATERIAL_COSTING_HOOK = {
  sourceModel: 'SalesOrderLineMaterialRequirement',
  unit: 'expectedQty per finished unit × SalesOrderLine.quantity',
  priceSource: 'InventoryItem.standardCost (or latest purchase unit cost)',
  actualSource:
    'ProductionTaskMaterialUsage (draft → live map; finalized → frozen unitCost)',
  doesNotMutate: ['Product.bomDefaults', 'ProductStageMaterialInput'],
  labels: {
    estimated: 'Estimated material cost (planned)',
    actual: 'Actual material cost (usage to date)',
  },
} as const;
