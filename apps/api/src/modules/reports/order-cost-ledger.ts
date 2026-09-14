import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';

export type CostCoverageStatus = 'FINAL' | 'PARTIAL' | 'UNPRICED';

export type LedgerTx = {
  type: string;
  quantity: unknown;
  unitCost: unknown;
  inventoryItemId?: string;
  sku?: string | null;
};

export type SkuLedgerRow = {
  inventoryItemId: string;
  sku: string;
  issuedQty: number;
  returnedQty: number;
  netQty: number;
  actualCost: number | null;
  costedIssueQty: number;
  unpricedIssueQty: number;
};

export function coverageStatus(costedCount: number, totalCount: number): CostCoverageStatus {
  if (!(totalCount > 0) || !(costedCount > 0)) return 'UNPRICED';
  if (costedCount >= totalCount) return 'FINAL';
  return 'PARTIAL';
}

/** Issue minus return, using only historical per-transaction cost. Never invents zero. */
export function actualMaterialFromTransactions(txs: LedgerTx[]) {
  let issueMoney = 0;
  let returnMoney = 0;
  let issueCount = 0;
  let costedIssueCount = 0;
  let anyCosted = false;

  for (const tx of txs) {
    const qty = Math.abs(Number(tx.quantity) || 0);
    const cost = positiveUnitCost(tx.unitCost);
    if (tx.type === 'PRODUCTION_ISSUE') {
      issueCount += 1;
      if (cost != null) {
        costedIssueCount += 1;
        issueMoney += qty * cost;
        anyCosted = true;
      }
    } else if (tx.type === 'PRODUCTION_RETURN' && cost != null) {
      returnMoney += qty * cost;
      anyCosted = true;
    }
  }

  return {
    actualCost: anyCosted ? Number(roundMoney(issueMoney - returnMoney)) : null,
    returnCredit: Number(roundMoney(returnMoney)),
    issueCount,
    costedIssueCount,
    coverage: coverageStatus(costedIssueCount, issueCount),
  };
}

export function skuLedgerFromTransactions(
  txs: Array<LedgerTx & { inventoryItemId: string; sku?: string | null }>,
): SkuLedgerRow[] {
  const byItem = new Map<string, SkuLedgerRow>();
  for (const tx of txs) {
    const qty = Math.abs(Number(tx.quantity) || 0);
    const cost = positiveUnitCost(tx.unitCost);
    const current = byItem.get(tx.inventoryItemId) ?? {
      inventoryItemId: tx.inventoryItemId,
      sku: tx.sku || tx.inventoryItemId,
      issuedQty: 0,
      returnedQty: 0,
      netQty: 0,
      actualCost: null,
      costedIssueQty: 0,
      unpricedIssueQty: 0,
    };
    if (tx.sku) current.sku = tx.sku;
    if (tx.type === 'PRODUCTION_ISSUE') {
      current.issuedQty += qty;
      if (cost != null) {
        current.costedIssueQty += qty;
        current.actualCost = Number(roundMoney((current.actualCost ?? 0) + qty * cost));
      } else {
        current.unpricedIssueQty += qty;
      }
    } else if (tx.type === 'PRODUCTION_RETURN') {
      current.returnedQty += qty;
      if (cost != null && current.actualCost != null) {
        current.actualCost = Number(roundMoney(current.actualCost - qty * cost));
      }
    }
    current.netQty = current.issuedQty - current.returnedQty;
    byItem.set(tx.inventoryItemId, current);
  }
  return [...byItem.values()];
}

export function saleValueFromSubtotals(invoiceSubtotal: unknown, orderSubtotal: unknown): number | null {
  const invoice = Number(invoiceSubtotal);
  if (Number.isFinite(invoice) && invoice > 0) return Number(roundMoney(invoice));
  const order = Number(orderSubtotal);
  if (Number.isFinite(order) && order > 0) return Number(roundMoney(order));
  return null;
}

export function marginFrom(
  saleValue: number | null,
  actualCost: number | null,
  complete?: boolean,
) {
  const ok = complete ?? (saleValue != null && actualCost != null);
  if (!ok || saleValue == null || actualCost == null) {
    return {
      grossMargin: null as number | null,
      marginPct: null as number | null,
      incomplete: true,
    };
  }
  const grossMargin = Number(roundMoney(saleValue - actualCost));
  return {
    grossMargin,
    marginPct: saleValue > 0 ? Number(roundMoney((grossMargin / saleValue) * 100)) : null,
    incomplete: false,
  };
}

export function averagePerUnit(totalCost: number | null, qty: number): number | null {
  if (totalCost == null || !(qty > 0)) return null;
  return Number(roundMoney(totalCost / qty));
}

/** Actual minus planned. Null when either side is missing — never a silent 0. */
export function costVariance(plannedCost: number | null, actualCost: number | null): number | null {
  if (plannedCost == null || actualCost == null) return null;
  return Number(roundMoney(actualCost - plannedCost));
}
