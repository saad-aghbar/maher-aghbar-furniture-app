import { remainingOrderedQty } from './goods-receipt-cost';

export const RECEIVABLE_PO_STATUSES = ['SENT', 'PARTIALLY_RECEIVED'] as const;

export type ReceivableLineInput = {
  id: string;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  warehouseId?: string | null;
  locationId?: string | null;
  category?: string | null;
  fabricProcurementId?: string | null;
  receivedQty?: number;
};

export function isFabricCategory(category?: string | null): boolean {
  return String(category ?? '').toUpperCase() === 'FABRIC';
}

export function receivableRemaining(ordered: number, received: number): number {
  return remainingOrderedQty(ordered, received);
}

export function mapReceivableLines(
  lines: ReceivableLineInput[],
  receivedByItem: Map<string, number>,
): Array<
  ReceivableLineInput & {
    remainingQty: number;
    isFabric: boolean;
  }
> {
  return lines
    .map((line) => {
      const ordered = Number(line.quantity);
      const received = line.inventoryItemId
        ? receivedByItem.get(line.inventoryItemId) ?? Number(line.receivedQty ?? 0)
        : Number(line.receivedQty ?? 0);
      const remainingQty = receivableRemaining(ordered, received);
      return {
        ...line,
        remainingQty,
        isFabric: isFabricCategory(line.category) || Boolean(line.fabricProcurementId),
      };
    })
    .filter((line) => line.remainingQty > 1e-9);
}

export function groupReceiptLinesByWarehouse<
  T extends { warehouseId?: string | null; receivedQty?: number; rejectedQty?: number },
>(
  lines: T[],
  fallbackWarehouseId: string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const accepted = Number(line.receivedQty ?? 0) - Number(line.rejectedQty ?? 0);
    if (accepted <= 0 && Number(line.receivedQty ?? 0) <= 0) continue;
    const warehouseId = line.warehouseId?.trim() || fallbackWarehouseId;
    const list = groups.get(warehouseId) ?? [];
    list.push(line);
    groups.set(warehouseId, list);
  }
  return groups;
}

export function receiptIdempotencyKey(
  requestKey: string | null | undefined,
  warehouseId: string,
): string | null {
  const base = requestKey?.trim();
  if (!base) return null;
  return `${base}:${warehouseId}`;
}
