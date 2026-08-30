import { roundMoney } from './money.util';

export type BomMaterialLine = {
  sku?: string;
  qty?: number;
  unitCost?: number;
  category?: string;
};

export type BomDefaults = {
  materials?: BomMaterialLine[];
  fabricQty?: number;
  fabricCost?: number;
  woodQty?: number;
  woodCost?: number;
  foamQty?: number;
  foamCost?: number;
  accessoriesQty?: number;
  accessoriesCost?: number;
};

export type CostProduct = {
  id?: string | null;
  manufacturingCost?: unknown;
  basePrice?: unknown;
  bomDefaults?: unknown;
};

export type CostLine = {
  quantity?: unknown;
  unitPrice?: unknown;
  lineTotal?: unknown;
  productId?: string | null;
  product?: CostProduct | null;
};

export type OrderCostResult = {
  sellerPrice: number;
  productionPrice: number;
  profit: number;
  costBreakdown: {
    fabricQty: number;
    fabricCost: number;
    woodQty: number;
    woodCost: number;
    foamQty: number;
    foamCost: number;
    accessoriesQty: number;
    accessoriesCost: number;
  };
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBom(value: unknown): BomDefaults | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as BomDefaults;
}

/** Latest inventory unit cost by SKU (from material purchases / stock). */
export type MaterialCostMap = Map<string, number>;

/**
 * Prefer an explicit BOM unit cost when it is a positive number.
 * Otherwise use inventory catalog / purchase cost for that SKU.
 * Stored `0` is treated as unset so product/order costing can pick up
 * InventoryItem.standardCost after materials were added without a price.
 */
export function resolveBomLineUnitCost(
  sku: string | undefined,
  explicitUnitCost: number | undefined,
  materialCosts: MaterialCostMap,
): number {
  if (explicitUnitCost != null && Number.isFinite(explicitUnitCost) && explicitUnitCost > 0) {
    return explicitUnitCost;
  }
  if (sku && materialCosts.has(sku)) return materialCosts.get(sku)!;
  return 0;
}

/**
 * MANUFACTURING INVENTORY COST BASIS (Piece 5 — shared with commercial BOM costing).
 *
 * Policy:
 * 1. Seed map from InventoryItem.standardCost where standardCost > 0 (never invent 0).
 * 2. Overlay with latest costed InventoryTransaction per SKU; PURCHASE_RECEIPT preferred
 *    over other types when both exist (stable sort then first-seen wins).
 *
 * Purchasing → inventory → consumption chain:
 *   GRN / purchase receipt posts PURCHASE_RECEIPT with unitCost
 *   → this map resolves unit valuation
 *   → production finalizeForTask freezes unitCost on ISSUE/RETURN + usage extendedCost.
 *
 * Missing / zero costs stay absent from the map — callers must treat as null / incomplete.
 * See also `apps/api/src/modules/production/manufacturing-cost-basis.ts`.
 */
export function buildMaterialCostMap(input: {
  standardCosts?: Array<{ sku: string; standardCost?: unknown }>;
  transactions?: Array<{ sku: string; unitCost?: unknown; type?: string }>;
}): MaterialCostMap {
  const map: MaterialCostMap = new Map();
  for (const item of input.standardCosts ?? []) {
    const n = Number(item.standardCost);
    if (item.sku && Number.isFinite(n) && n > 0) map.set(item.sku, n);
  }
  const txs = [...(input.transactions ?? [])].sort((a, b) => {
    const rank = (t: string | undefined) => (t === 'PURCHASE_RECEIPT' ? 0 : 1);
    return rank(a.type) - rank(b.type);
  });
  const seen = new Set<string>();
  for (const tx of txs) {
    if (!tx.sku || seen.has(tx.sku)) continue;
    const n = Number(tx.unitCost);
    if (!Number.isFinite(n) || n <= 0) continue;
    seen.add(tx.sku);
    map.set(tx.sku, n);
  }
  return map;
}

function categoryBucket(category?: string): keyof OrderCostResult['costBreakdown'] | null {
  const c = (category ?? '').toUpperCase();
  if (c.includes('FABRIC')) return 'fabricCost';
  if (c.includes('WOOD')) return 'woodCost';
  if (c.includes('FOAM')) return 'foamCost';
  if (c.includes('ACCESS')) return 'accessoriesCost';
  return null;
}

/** Per-unit production cost from product BOM + current material costs. */
export function productionUnitCost(
  product: CostProduct | null | undefined,
  materialCosts: MaterialCostMap = new Map(),
): { unitCost: number; breakdown: OrderCostResult['costBreakdown'] } {
  const breakdown = {
    fabricQty: 0,
    fabricCost: 0,
    woodQty: 0,
    woodCost: 0,
    foamQty: 0,
    foamCost: 0,
    accessoriesQty: 0,
    accessoriesCost: 0,
  };

  const bom = asBom(product?.bomDefaults);
  if (bom?.materials?.length) {
    for (const m of bom.materials) {
      const qty = num(m.qty);
      const unit = resolveBomLineUnitCost(m.sku, m.unitCost, materialCosts);
      const lineCost = qty * unit;
      const bucket = categoryBucket(m.category) ?? categoryBucket(m.sku);
      if (bucket === 'fabricCost') {
        breakdown.fabricQty += qty;
        breakdown.fabricCost += lineCost;
      } else if (bucket === 'woodCost') {
        breakdown.woodQty += qty;
        breakdown.woodCost += lineCost;
      } else if (bucket === 'foamCost') {
        breakdown.foamQty += qty;
        breakdown.foamCost += lineCost;
      } else {
        breakdown.accessoriesQty += qty;
        breakdown.accessoriesCost += lineCost;
      }
    }
  } else if (bom) {
    const fabricQty = num(bom.fabricQty);
    const woodQty = num(bom.woodQty);
    const foamQty = num(bom.foamQty);
    const accessoriesQty = num(bom.accessoriesQty);
    const fabric =
      bom.fabricCost != null
        ? num(bom.fabricCost)
        : fabricQty * resolveBomLineUnitCost('FAB-ROLL', undefined, materialCosts);
    const wood =
      bom.woodCost != null
        ? num(bom.woodCost)
        : woodQty * resolveBomLineUnitCost('WOOD-BEECH', undefined, materialCosts);
    const foam =
      bom.foamCost != null
        ? num(bom.foamCost)
        : foamQty * resolveBomLineUnitCost('FOAM-HD', undefined, materialCosts);
    const accessories = num(bom.accessoriesCost);
    breakdown.fabricQty = fabricQty;
    breakdown.fabricCost = fabric;
    breakdown.woodQty = woodQty;
    breakdown.woodCost = wood;
    breakdown.foamQty = foamQty;
    breakdown.foamCost = foam;
    breakdown.accessoriesQty = accessoriesQty;
    breakdown.accessoriesCost = accessories;
  }

  let unitCost =
    breakdown.fabricCost + breakdown.woodCost + breakdown.foamCost + breakdown.accessoriesCost;

  // Fall back to product.manufacturingCost when BOM has no priced materials yet
  if (unitCost <= 0 && product?.manufacturingCost != null) {
    unitCost = num(product.manufacturingCost);
  }

  return { unitCost, breakdown };
}

/**
 * Seller price prefers dealer price list, then catalog base price, then line unit price.
 * Production price is BOM/materials × quantity (auto).
 */
export function calculateOrderCosts(
  lines: CostLine[],
  opts: {
    customerId?: string | null;
    dealerPrices?: Map<string, number>;
    materialCosts?: MaterialCostMap;
    /** Existing SO total — used only if no line prices can be derived */
    fallbackSellerTotal?: unknown;
  } = {},
): OrderCostResult {
  const dealerPrices = opts.dealerPrices ?? new Map<string, number>();
  const materialCosts = opts.materialCosts ?? new Map<string, number>();

  let sellerPrice = 0;
  let productionPrice = 0;
  const costBreakdown = {
    fabricQty: 0,
    fabricCost: 0,
    woodQty: 0,
    woodCost: 0,
    foamQty: 0,
    foamCost: 0,
    accessoriesQty: 0,
    accessoriesCost: 0,
  };

  for (const line of lines) {
    const qty = num(line.quantity, 1);
    const product = line.product ?? null;
    const productId = line.productId ?? product?.id ?? null;

    let unitSell: number | null = null;
    if (productId && dealerPrices.has(productId)) {
      unitSell = dealerPrices.get(productId)!;
    } else if (product?.basePrice != null) {
      unitSell = num(product.basePrice);
    } else if (line.unitPrice != null) {
      unitSell = num(line.unitPrice);
    } else if (line.lineTotal != null && qty > 0) {
      unitSell = num(line.lineTotal) / qty;
    }

    if (unitSell != null) sellerPrice += unitSell * qty;

    const { unitCost, breakdown } = productionUnitCost(product, materialCosts);
    productionPrice += unitCost * qty;
    costBreakdown.fabricQty += breakdown.fabricQty * qty;
    costBreakdown.fabricCost += breakdown.fabricCost * qty;
    costBreakdown.woodQty += breakdown.woodQty * qty;
    costBreakdown.woodCost += breakdown.woodCost * qty;
    costBreakdown.foamQty += breakdown.foamQty * qty;
    costBreakdown.foamCost += breakdown.foamCost * qty;
    costBreakdown.accessoriesQty += breakdown.accessoriesQty * qty;
    costBreakdown.accessoriesCost += breakdown.accessoriesCost * qty;
  }

  if (sellerPrice <= 0 && opts.fallbackSellerTotal != null) {
    sellerPrice = num(opts.fallbackSellerTotal);
  }

  const profit = sellerPrice - productionPrice;
  return {
    sellerPrice: Number(roundMoney(sellerPrice)),
    productionPrice: Number(roundMoney(productionPrice)),
    profit: Number(roundMoney(profit)),
    costBreakdown: {
      fabricQty: Number(roundMoney(costBreakdown.fabricQty)),
      fabricCost: Number(roundMoney(costBreakdown.fabricCost)),
      woodQty: Number(roundMoney(costBreakdown.woodQty)),
      woodCost: Number(roundMoney(costBreakdown.woodCost)),
      foamQty: Number(roundMoney(costBreakdown.foamQty)),
      foamCost: Number(roundMoney(costBreakdown.foamCost)),
      accessoriesQty: Number(roundMoney(costBreakdown.accessoriesQty)),
      accessoriesCost: Number(roundMoney(costBreakdown.accessoriesCost)),
    },
  };
}

export function moneyLabel(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value).toFixed(2);
}
