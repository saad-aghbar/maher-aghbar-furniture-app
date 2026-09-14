import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';
import { NON_PRODUCTION_COST_TYPES } from './production-cost';

export type InventoryFlowKind =
  | 'receipt'
  | 'productionIssue'
  | 'productionReturn'
  | 'wipOutput'
  | 'finishedOutput'
  | 'scrap'
  | 'recovery'
  | 'adjustment'
  | 'transfer'
  | 'other';

export type InventoryFlowMoney = Record<InventoryFlowKind, number | null>;

export function classifyInventoryFlow(type: string): InventoryFlowKind {
  switch (String(type)) {
    case 'PURCHASE_RECEIPT':
      return 'receipt';
    case 'PRODUCTION_ISSUE':
      return 'productionIssue';
    case 'PRODUCTION_RETURN':
      return 'productionReturn';
    case 'SEMI_FINISHED_RECEIPT':
      return 'wipOutput';
    case 'FINISHED_GOODS_RECEIPT':
      return 'finishedOutput';
    case 'SCRAP':
    case 'DAMAGE':
      return 'scrap';
    case 'CUSTOMER_RETURN':
      return 'recovery';
    case 'INVENTORY_ADJUSTMENT':
      return 'adjustment';
    case 'WAREHOUSE_TRANSFER':
      return 'transfer';
    default:
      return 'other';
  }
}

export function isInventoryConsumption(type: string): boolean {
  return String(type) === 'PRODUCTION_ISSUE';
}

export function emptyFlowMoney(): InventoryFlowMoney {
  return {
    receipt: null,
    productionIssue: null,
    productionReturn: null,
    wipOutput: null,
    finishedOutput: null,
    scrap: null,
    recovery: null,
    adjustment: null,
    transfer: null,
    other: null,
  };
}

export function addFlowMoney(flow: InventoryFlowMoney, type: string, qty: unknown, unitCost: unknown) {
  const kind = classifyInventoryFlow(type);
  const cost = positiveUnitCost(unitCost);
  if (cost == null) return flow;
  const value = Math.abs(Number(qty) || 0) * cost;
  flow[kind] = Number(roundMoney((flow[kind] ?? 0) + value));
  return flow;
}

/** Transfers never become factory consumption or new value. */
export function consumptionFromFlow(flow: InventoryFlowMoney): number | null {
  const issues = flow.productionIssue;
  const returns = flow.productionReturn;
  if (issues == null && returns == null) return null;
  return Number(roundMoney((issues ?? 0) - (returns ?? 0)));
}

export function currentInventoryValue(
  rows: Array<{ qty: unknown; unitCost: unknown }>,
): { value: number | null; pricedQty: number; totalQty: number; coveragePct: number | null } {
  let value = 0;
  let pricedQty = 0;
  let totalQty = 0;
  let any = false;
  for (const row of rows) {
    const qty = Math.abs(Number(row.qty) || 0);
    totalQty += qty;
    const cost = positiveUnitCost(row.unitCost);
    if (cost == null || !(qty > 0)) continue;
    value += qty * cost;
    pricedQty += qty;
    any = true;
  }
  return {
    value: any ? Number(roundMoney(value)) : null,
    pricedQty,
    totalQty,
    coveragePct: totalQty > 0 ? Number(roundMoney((pricedQty / totalQty) * 100)) : null,
  };
}

export function rawGroupFromCategory(category?: string | null, materialGroup?: string | null): string {
  const group = String(materialGroup ?? '').toUpperCase();
  if (group === 'FABRIC' || group === 'WOOD' || group === 'FOAM' || group === 'ACCESSORIES') return group;
  const c = String(category ?? '').toUpperCase();
  if (c === 'FABRIC') return 'FABRIC';
  if (c === 'WOOD') return 'WOOD';
  if (c === 'FOAM') return 'FOAM';
  return 'ACCESSORIES';
}

export { NON_PRODUCTION_COST_TYPES };
