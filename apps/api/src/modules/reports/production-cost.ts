import { positiveUnitCost } from '../inventory/issue-unit-cost';
import { roundMoney } from '../../common/helpers/money.util';
import {
  actualMaterialFromTransactions,
  coverageStatus,
  marginFrom,
  type CostCoverageStatus,
  type LedgerTx,
} from './order-cost-ledger';

export const PRODUCTION_CONSUMPTION_TYPES = new Set([
  'PRODUCTION_ISSUE',
  'PRODUCTION_RETURN',
  'SCRAP',
  'DAMAGE',
]);

export const NON_PRODUCTION_COST_TYPES = new Set([
  'WAREHOUSE_TRANSFER',
  'PURCHASE_RECEIPT',
  'SEMI_FINISHED_RECEIPT',
  'FINISHED_GOODS_RECEIPT',
  'SEMI_FINISHED_ISSUE',
  'OPENING_BALANCE',
  'DELIVERY_ISSUE',
  'DELIVERY_RESTORE',
  'CUSTOMER_RETURN',
  'INVENTORY_ADJUSTMENT',
]);

export type ClassifiedTx = LedgerTx & {
  category?: string | null;
  materialGroup?: string | null;
  isRework?: boolean;
  productionTaskId?: string | null;
};

export type UsageScrapRow = {
  inventoryItemId?: string | null;
  sku?: string | null;
  scrapQty: number;
  unitCost: number | null;
  isRework?: boolean;
};

export type LaborMoneyBlock = {
  actual: number | null;
  pricedMinutes: number;
  unpricedMinutes: number;
  timedMinutes: number;
  reworkActual: number | null;
  reworkMinutes: number;
};

export type ActualProductionMix = {
  materials: number | null;
  fabric: number | null;
  labor: number | null;
  waste: number | null;
  rework: number | null;
  total: number | null;
  materialCoverage: CostCoverageStatus;
  fabricCoverage: CostCoverageStatus;
  laborCoverage: CostCoverageStatus;
  wasteCoverage: CostCoverageStatus;
  coverage: CostCoverageStatus;
  coveragePct: number | null;
  complete: boolean;
  laborTimeKnown: boolean;
  laborCostPriced: boolean;
  noActualUsage: boolean;
};

export function isFabricItem(meta?: {
  category?: string | null;
  materialGroup?: string | null;
}): boolean {
  const category = String(meta?.category ?? '').toUpperCase();
  const group = String(meta?.materialGroup ?? '').toUpperCase();
  return category === 'FABRIC' || group === 'FABRIC';
}

export function isProductionConsumption(type: string): boolean {
  return PRODUCTION_CONSUMPTION_TYPES.has(String(type));
}

export function isTransferOrReceipt(type: string): boolean {
  const t = String(type);
  return t === 'WAREHOUSE_TRANSFER' || t === 'PURCHASE_RECEIPT';
}

export function addMoney(parts: Array<number | null | undefined>): number | null {
  const present = parts.filter((n): n is number => n != null && Number.isFinite(n));
  if (!present.length) return null;
  return Number(roundMoney(present.reduce((sum, n) => sum + n, 0)));
}

export function coveragePct(costed: number, total: number): number | null {
  if (!(total > 0)) return null;
  return Number(roundMoney((costed / total) * 100));
}

function mergeCoverage(parts: CostCoverageStatus[]): CostCoverageStatus {
  if (!parts.length) return 'UNPRICED';
  if (parts.every((p) => p === 'FINAL')) return 'FINAL';
  if (parts.every((p) => p === 'UNPRICED')) return 'UNPRICED';
  return 'PARTIAL';
}

export function wasteFromTransactionsAndUsage(
  txs: LedgerTx[],
  usages: UsageScrapRow[] = [],
): { actualCost: number | null; coverage: CostCoverageStatus; txCount: number; costedCount: number } {
  let money = 0;
  let any = false;
  let txCount = 0;
  let costedCount = 0;
  for (const tx of txs) {
    if (tx.type !== 'SCRAP' && tx.type !== 'DAMAGE') continue;
    txCount += 1;
    const qty = Math.abs(Number(tx.quantity) || 0);
    const cost = positiveUnitCost(tx.unitCost);
    if (cost == null) continue;
    costedCount += 1;
    money += qty * cost;
    any = true;
  }
  if (txCount > 0) {
    return {
      actualCost: any ? Number(roundMoney(money)) : null,
      coverage: coverageStatus(costedCount, txCount),
      txCount,
      costedCount,
    };
  }
  let usageMoney = 0;
  let usageAny = false;
  let usageRows = 0;
  let usageCosted = 0;
  for (const row of usages) {
    if (!(row.scrapQty > 0)) continue;
    usageRows += 1;
    if (row.unitCost == null) continue;
    usageCosted += 1;
    usageMoney += row.scrapQty * row.unitCost;
    usageAny = true;
  }
  return {
    actualCost: usageAny ? Number(roundMoney(usageMoney)) : null,
    coverage: usageRows ? coverageStatus(usageCosted, usageRows) : 'UNPRICED',
    txCount: usageRows,
    costedCount: usageCosted,
  };
}

function issueReturnOnly(txs: ClassifiedTx[]): ClassifiedTx[] {
  return txs.filter((tx) => tx.type === 'PRODUCTION_ISSUE' || tx.type === 'PRODUCTION_RETURN');
}

export function assembleActualProduction(input: {
  txs: ClassifiedTx[];
  usages?: UsageScrapRow[];
  labor: LaborMoneyBlock;
}): ActualProductionMix {
  const consumption = input.txs.filter((tx) => isProductionConsumption(String(tx.type)));
  const fabricTxs = consumption.filter((tx) => isFabricItem(tx));
  const nonFabric = consumption.filter((tx) => !isFabricItem(tx));
  const reworkTxs = nonFabric.filter((tx) => tx.isRework);
  const normalMaterialTxs = reworkTxs.length ? nonFabric.filter((tx) => !tx.isRework) : nonFabric;

  const materialsBlock = actualMaterialFromTransactions(issueReturnOnly(normalMaterialTxs));
  const fabric = actualMaterialFromTransactions(fabricTxs);
  const waste = wasteFromTransactionsAndUsage(consumption, input.usages ?? []);
  const reworkMaterial = reworkTxs.length
    ? actualMaterialFromTransactions(issueReturnOnly(reworkTxs))
    : { actualCost: null as number | null };
  const rework = addMoney([reworkMaterial.actualCost, input.labor.reworkActual]);

  const laborCoverage: CostCoverageStatus =
    input.labor.timedMinutes <= 0
      ? 'UNPRICED'
      : input.labor.unpricedMinutes > 0 && input.labor.pricedMinutes > 0
        ? 'PARTIAL'
        : input.labor.pricedMinutes > 0
          ? 'FINAL'
          : 'UNPRICED';

  const hasIssue = materialsBlock.issueCount > 0 || fabric.issueCount > 0;
  const noActualUsage =
    !hasIssue && input.labor.timedMinutes <= 0 && waste.txCount === 0 && rework == null;

  const total = addMoney([
    materialsBlock.actualCost,
    fabric.actualCost,
    input.labor.actual,
    waste.actualCost,
    reworkMaterial.actualCost,
  ]);

  const materialFinal = !materialsBlock.issueCount || materialsBlock.coverage === 'FINAL';
  const fabricFinal = !fabric.issueCount || fabric.coverage === 'FINAL';
  const wasteFinal = waste.txCount <= 0 || waste.coverage === 'FINAL';
  const laborOk =
    input.labor.timedMinutes <= 0 || (laborCoverage === 'FINAL' && input.labor.actual != null);
  const completeHonest = total != null && materialFinal && fabricFinal && laborOk && wasteFinal;

  const coverages = [
    materialsBlock.issueCount ? materialsBlock.coverage : null,
    fabric.issueCount ? fabric.coverage : null,
    input.labor.timedMinutes > 0 ? laborCoverage : null,
    waste.txCount ? waste.coverage : null,
  ].filter((c): c is CostCoverageStatus => c != null);

  const costedUnits =
    materialsBlock.costedIssueCount +
    fabric.costedIssueCount +
    (input.labor.pricedMinutes > 0 ? 1 : 0) +
    waste.costedCount;
  const totalUnits =
    materialsBlock.issueCount +
    fabric.issueCount +
    (input.labor.timedMinutes > 0 ? 1 : 0) +
    waste.txCount;

  return {
    materials: materialsBlock.actualCost,
    fabric: fabric.actualCost,
    labor: input.labor.actual,
    waste: waste.actualCost,
    rework,
    total,
    materialCoverage: materialsBlock.coverage,
    fabricCoverage: fabric.coverage,
    laborCoverage,
    wasteCoverage: waste.coverage,
    coverage: mergeCoverage(coverages),
    coveragePct: coveragePct(costedUnits, totalUnits),
    complete: completeHonest,
    laborTimeKnown: input.labor.timedMinutes > 0,
    laborCostPriced: input.labor.actual != null && input.labor.unpricedMinutes <= 0,
    noActualUsage,
  };
}

export function grossProductionMargin(
  saleValue: number | null,
  actualProductionCost: number | null,
  complete: boolean,
): {
  grossMargin: number | null;
  marginPct: number | null;
  incomplete: boolean;
} {
  return marginFrom(saleValue, actualProductionCost, complete);
}

export function saleValueFromCommercial(parts: {
  invoiceSubtotal?: unknown;
  lineTotalsSum?: unknown;
  orderSubtotal?: unknown;
}): number | null {
  const invoice = Number(parts.invoiceSubtotal);
  if (Number.isFinite(invoice) && invoice > 0) return Number(roundMoney(invoice));
  const lines = Number(parts.lineTotalsSum);
  if (Number.isFinite(lines) && lines > 0) return Number(roundMoney(lines));
  const order = Number(parts.orderSubtotal);
  if (Number.isFinite(order) && order > 0) return Number(roundMoney(order));
  return null;
}

export function collectionFromInvoices(
  invoices: Array<{
    subtotal?: unknown;
    paidAmount?: unknown;
    outstandingAmount?: unknown;
    status?: string;
  }>,
): { invoiced: number | null; collected: number | null; outstanding: number | null } {
  const open = invoices.filter((inv) => {
    const status = String(inv.status ?? '');
    return status !== 'CANCELLED' && status !== 'VOID';
  });
  if (!open.length) return { invoiced: null, collected: null, outstanding: null };
  let invoiced = 0;
  let collected = 0;
  let outstanding = 0;
  let anyInvoice = false;
  for (const inv of open) {
    const sub = Number(inv.subtotal);
    if (Number.isFinite(sub) && sub > 0) {
      invoiced += sub;
      anyInvoice = true;
    }
    const paid = Number(inv.paidAmount);
    if (Number.isFinite(paid) && paid > 0) collected += paid;
    const due = Number(inv.outstandingAmount);
    if (Number.isFinite(due) && due > 0) outstanding += due;
  }
  return {
    invoiced: anyInvoice ? Number(roundMoney(invoiced)) : null,
    collected: collected > 0 ? Number(roundMoney(collected)) : collected === 0 && anyInvoice ? 0 : null,
    outstanding: anyInvoice ? Number(roundMoney(outstanding)) : null,
  };
}

export type DisplayToken =
  | 'zero'
  | 'na'
  | 'not_costed'
  | 'partial'
  | 'labor_rate_missing'
  | 'no_usage'
  | 'complete';

export function displayToken(mix: ActualProductionMix, value: number | null): DisplayToken {
  if (mix.noActualUsage) return 'no_usage';
  if (mix.laborTimeKnown && !mix.laborCostPriced && value === mix.labor) return 'labor_rate_missing';
  if (value == null && mix.coverage === 'UNPRICED') return 'not_costed';
  if (value == null) return 'na';
  if (value === 0 && mix.complete) return 'zero';
  if (!mix.complete) return 'partial';
  return 'complete';
}
