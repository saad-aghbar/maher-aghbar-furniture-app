import type { GoodsReceiptInput, PurchaseOrder, PurchaseOrderLine } from '@/api/modules/purchasing';
import { locationPickerLabel, pickDefaultLocationId, warehouseBinLine } from '@/features/inventory/pickDefaultLocation';
import { isFabricCategory } from './orderBuilder';

export type ReceiveLineDraft = {
  lineId: string;
  inventoryItemId: string;
  description: string;
  sku?: string | null;
  unit: string;
  orderedQty: number;
  alreadyReceived: number;
  remaining: number;
  receiveNow: string;
  rejectedQty: string;
  unitCost: string;
  warehouseId: string;
  locationId: string;
  isFabric: boolean;
  fabricProcurementId?: string | null;
  warehouseName?: string;
  locationName?: string;
  verified?: boolean;
  /** Operator marked this line received on the checklist. */
  checked?: boolean;
};

function toNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function acceptedReceiveQty(receiveNow: string, rejectedQty: string): number {
  return Math.max(0, toNum(receiveNow) - toNum(rejectedQty));
}

export function isOverReceipt(draft: ReceiveLineDraft): boolean {
  return acceptedReceiveQty(draft.receiveNow, draft.rejectedQty) > draft.remaining + 1e-9;
}

export function lineIsManualFabric(line: PurchaseOrderLine): boolean {
  return Boolean(line.isFabric || isFabricCategory(line.inventoryItem?.category)) &&
    !line.fabricProcurementId;
}

export function buildReceivableDrafts(
  order: PurchaseOrder,
  opts: { includeManualFabric?: boolean } = {},
): ReceiveLineDraft[] {
  const includeManualFabric = opts.includeManualFabric !== false;
  return (order.lines ?? [])
    .filter((line) => line.inventoryItemId)
    .filter((line) => {
      if (line.fabricProcurementId) return false;
      if (lineIsManualFabric(line)) return includeManualFabric;
      return true;
    })
    .map((line) => {
      const ordered = toNum(line.quantity);
      const already = toNum(line.receivedQty);
      const remaining =
        line.remainingQty != null ? toNum(line.remainingQty) : Math.max(0, ordered - already);
      return {
        lineId: line.id ?? line.inventoryItemId!,
        inventoryItemId: line.inventoryItemId!,
        description: line.description,
        sku: line.inventoryItem?.sku ?? null,
        unit: line.unit || line.inventoryItem?.unit || 'pcs',
        orderedQty: ordered,
        alreadyReceived: already,
        remaining,
        receiveNow: remaining > 0 ? String(remaining) : '0',
        rejectedQty: '0',
        unitCost: String(toNum(line.unitPrice)),
        warehouseId: line.warehouseId ?? order.warehouseId ?? '',
        locationId: line.locationId ?? '',
        isFabric: lineIsManualFabric(line) || isFabricCategory(line.inventoryItem?.category),
        fabricProcurementId: line.fabricProcurementId ?? null,
        warehouseName:
          line.warehouse?.nameEn || line.warehouse?.nameAr || line.warehouse?.name || undefined,
        locationName: line.location?.name || line.location?.code || undefined,
        verified: false,
        checked: false,
      };
    })
    .filter((line) => line.remaining > 0);
}

export function validateReceiveDrafts(drafts: ReceiveLineDraft[]): 'empty' | 'over' | 'holding' | 'invalid' | null {
  const active = drafts.filter((d) => toNum(d.receiveNow) > 0);
  if (active.length === 0) return 'empty';
  for (const draft of drafts) {
    const received = toNum(draft.receiveNow);
    const rejected = toNum(draft.rejectedQty);
    if (received < 0 || rejected < 0 || rejected > received + 1e-9) return 'invalid';
    if (isOverReceipt(draft)) return 'over';
    if (received > 0 && !draft.locationId) return 'holding';
  }
  return null;
}

export function buildReceivePayload(
  drafts: ReceiveLineDraft[],
  extra: { notes?: string; idempotencyKey?: string; warehouseId?: string } = {},
): GoodsReceiptInput {
  return {
    warehouseId: extra.warehouseId,
    notes: extra.notes,
    idempotencyKey: extra.idempotencyKey,
    lines: drafts
      .filter((d) => toNum(d.receiveNow) > 0)
      .map((d) => ({
        inventoryItemId: d.inventoryItemId,
        orderedQty: d.orderedQty,
        receivedQty: toNum(d.receiveNow),
        rejectedQty: toNum(d.rejectedQty) || undefined,
        warehouseId: d.warehouseId || undefined,
        locationId: d.locationId || undefined,
      })),
  };
}

export function groupReceiptsByWarehouse<T extends { warehouseId?: string | null; warehouse?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null }>(
  receipts: T[],
): { warehouseId: string; label: string; receipts: T[] }[] {
  const map = new Map<string, { warehouseId: string; label: string; receipts: T[] }>();
  for (const receipt of receipts) {
    const warehouseId = receipt.warehouseId ?? 'unknown';
    const label =
      receipt.warehouse?.nameEn ||
      receipt.warehouse?.nameAr ||
      receipt.warehouse?.name ||
      warehouseId;
    const bucket = map.get(warehouseId) ?? { warehouseId, label, receipts: [] };
    bucket.receipts.push(receipt);
    map.set(warehouseId, bucket);
  }
  return [...map.values()];
}

export function applyReceiveScanVerify(
  drafts: ReceiveLineDraft[],
  lineId: string,
  scannedItemId: string | null | undefined,
): ReceiveLineDraft[] {
  return drafts.map((draft) =>
    draft.lineId === lineId
      ? { ...draft, verified: Boolean(scannedItemId && scannedItemId === draft.inventoryItemId) }
      : draft,
  );
}

export type ReceiveWarehouseRef = {
  id: string;
  code?: string | null;
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  locations?: Array<{
    id: string;
    name?: string | null;
    code?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }>;
};

function warehouseDisplayName(warehouse: ReceiveWarehouseRef | undefined, locale: string): string {
  if (!warehouse) return '';
  return locale === 'ar'
    ? warehouse.nameAr || warehouse.nameEn || warehouse.name || warehouse.code || ''
    : warehouse.nameEn || warehouse.nameAr || warehouse.name || warehouse.code || '';
}

export function namesForReceiveDestination(
  line: Pick<ReceiveLineDraft, 'warehouseId' | 'locationId' | 'warehouseName' | 'locationName'>,
  warehouses: ReceiveWarehouseRef[],
  locale: string,
): { warehouseName?: string; locationName?: string } {
  const byId = warehouses.find((w) => w.id === line.warehouseId);
  const byLoc = warehouses.find((w) => (w.locations ?? []).some((l) => l.id === line.locationId));
  const warehouse = byId ?? byLoc;
  const location = (warehouse?.locations ?? []).find((l) => l.id === line.locationId);
  return {
    warehouseName: warehouseDisplayName(warehouse, locale) || line.warehouseName,
    locationName: location
      ? locationPickerLabel(location) || line.locationName
      : line.locationName,
  };
}

export function receiveDraftsForNames(
  prev: ReceiveLineDraft[] | null,
  seeded: ReceiveLineDraft[],
): ReceiveLineDraft[] {
  return prev && prev.length > 0 ? prev : seeded;
}

export function applyReceiveDestinationNames(
  drafts: ReceiveLineDraft[],
  warehouses: ReceiveWarehouseRef[],
  locale: string,
): ReceiveLineDraft[] {
  return drafts.map((draft) => {
    const byId = warehouses.find((w) => w.id === draft.warehouseId);
    const warehouse = byId ?? warehouses.find((w) => (w.locations ?? []).some((l) => l.id === draft.locationId));
    const locationId =
      draft.locationId ||
      (draft.warehouseId ? pickDefaultLocationId(warehouse?.locations ?? []) : '');
    const next = { ...draft, locationId };
    return { ...next, ...namesForReceiveDestination(next, warehouses, locale) };
  });
}

export type ReceiveLineReadyIssue = 'qty' | 'over' | 'holding' | 'warehouse' | 'invalid';

export function receiveLineReadyIssue(line: ReceiveLineDraft): ReceiveLineReadyIssue | null {
  const received = toNum(line.receiveNow);
  const rejected = toNum(line.rejectedQty);
  if (!(received > 0)) return 'qty';
  if (rejected < 0 || rejected > received + 1e-9) return 'invalid';
  if (isOverReceipt(line)) return 'over';
  if (!line.warehouseId) return 'warehouse';
  if (!line.locationId) return 'holding';
  return null;
}

export function setReceiveLineChecked(
  drafts: ReceiveLineDraft[],
  lineId: string,
  checked: boolean,
): ReceiveLineDraft[] {
  return drafts.map((draft) => (draft.lineId === lineId ? { ...draft, checked } : draft));
}

export function tryMarkReceiveLineDone(
  drafts: ReceiveLineDraft[],
  lineId: string,
): { drafts: ReceiveLineDraft[]; issue: ReceiveLineReadyIssue | null } {
  const line = drafts.find((draft) => draft.lineId === lineId);
  if (!line) return { drafts, issue: 'qty' };
  const issue = receiveLineReadyIssue(line);
  if (issue) return { drafts, issue };
  return { drafts: setReceiveLineChecked(drafts, lineId, true), issue: null };
}

export function allReceiveLinesChecked(drafts: ReceiveLineDraft[]): boolean {
  return drafts.length > 0 && drafts.every((draft) => draft.checked);
}

export function receiveCheckedCount(drafts: ReceiveLineDraft[]): { done: number; total: number } {
  return {
    done: drafts.filter((draft) => draft.checked).length,
    total: drafts.length,
  };
}

export function receiveDestinationLabel(line: ReceiveLineDraft): string {
  return warehouseBinLine(line.warehouseName ?? '', line.locationName);
}

export function groupReceiveDraftsByWarehouse(
  drafts: ReceiveLineDraft[],
): { warehouseId: string; label: string; lines: ReceiveLineDraft[] }[] {
  const map = new Map<string, { warehouseId: string; label: string; lines: ReceiveLineDraft[] }>();
  for (const draft of drafts.filter((row) => toNum(row.receiveNow) > 0)) {
    const warehouseId = draft.warehouseId || 'unknown';
    const label = draft.warehouseName || warehouseId;
    const bucket = map.get(warehouseId) ?? { warehouseId, label, lines: [] };
    bucket.lines.push(draft);
    map.set(warehouseId, bucket);
  }
  return [...map.values()];
}
