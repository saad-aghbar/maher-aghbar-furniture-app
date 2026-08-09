import type {
  InventoryStockCount,
  Warehouse,
  WarehouseTransfer,
} from './api';

export type TransferCardModel = {
  id: string;
  number: string;
  status: string;
  notes: string | null;
  createdAt: string;
  lineCount: number;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
};

export type StockCountCardModel = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  lineCount: number;
  countedLineCount: number;
  warehouseCode: string;
  warehouseName: string;
};

function warehouseName(
  wh: { code: string; nameEn: string; nameAr: string } | undefined,
  locale: string,
  fallbackId?: string,
): { code: string; name: string } {
  if (!wh) {
    return { code: '—', name: fallbackId || '—' };
  }
  const name =
    locale === 'ar' ? wh.nameAr || wh.nameEn || wh.code : wh.nameEn || wh.nameAr || wh.code;
  return { code: wh.code, name };
}

export function selectTransferCard(
  transfer: WarehouseTransfer,
  locale: string,
): TransferCardModel {
  const from = warehouseName(transfer.fromWarehouse, locale, transfer.fromWarehouseId);
  const to = warehouseName(transfer.toWarehouse, locale, transfer.toWarehouseId);
  return {
    id: transfer.id,
    number: transfer.number,
    status: transfer.status,
    notes: transfer.notes ?? null,
    createdAt: transfer.createdAt,
    lineCount: transfer.lines?.length ?? 0,
    fromCode: from.code,
    fromName: from.name,
    toCode: to.code,
    toName: to.name,
  };
}

export function selectStockCountCard(
  count: InventoryStockCount,
  locale: string,
  warehouses: Warehouse[] = [],
): StockCountCardModel {
  const wh = warehouses.find((w) => w.id === count.warehouseId);
  const resolved = warehouseName(wh, locale, count.warehouseId);
  const lines = count.lines ?? [];
  return {
    id: count.id,
    number: count.number,
    status: count.status,
    createdAt: count.createdAt,
    lineCount: lines.length,
    countedLineCount: lines.filter(
      (l) => l.countedQty != null && String(l.countedQty) !== '',
    ).length,
    warehouseCode: resolved.code,
    warehouseName: resolved.name,
  };
}

export function filterTransferCards(
  rows: TransferCardModel[],
  q: string,
): TransferCardModel[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = [
      row.number,
      row.status,
      row.notes ?? '',
      row.fromCode,
      row.fromName,
      row.toCode,
      row.toName,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function filterStockCountCards(
  rows: StockCountCardModel[],
  q: string,
): StockCountCardModel[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = [row.number, row.status, row.warehouseCode, row.warehouseName]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}
