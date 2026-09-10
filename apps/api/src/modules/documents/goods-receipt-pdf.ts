/** GRN PDF rows — never invent a unit cost of 0 when the receipt has none. */

export function hasPresentUnitCost(unitCost: unknown): boolean {
  if (unitCost == null || unitCost === '') return false;
  const n = Number(unitCost);
  return Number.isFinite(n);
}

export function formatGoodsReceiptUnitCost(unitCost: unknown): string {
  return hasPresentUnitCost(unitCost) ? String(unitCost) : '—';
}

export function goodsReceiptPdfColumns(
  labels: {
    description: string;
    ordered: string;
    received: string;
    rejected: string;
    unitPrice: string;
  },
  lines: Array<{ unitCost?: unknown }>,
): string[] {
  const cols = [labels.description, labels.ordered, labels.received, labels.rejected];
  if (lines.some((line) => hasPresentUnitCost(line.unitCost))) {
    cols.push(labels.unitPrice);
  }
  return cols;
}

export function goodsReceiptPdfRow(
  line: {
    item: string;
    orderedQty: unknown;
    receivedQty: unknown;
    rejectedQty: unknown;
    unitCost?: unknown;
  },
  showCost: boolean,
): string[] {
  const row = [
    line.item,
    String(line.orderedQty ?? 0),
    String(line.receivedQty ?? 0),
    String(line.rejectedQty ?? 0),
  ];
  if (showCost) row.push(formatGoodsReceiptUnitCost(line.unitCost));
  return row;
}
