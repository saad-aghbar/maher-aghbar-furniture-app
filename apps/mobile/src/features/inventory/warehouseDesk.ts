import { localizedName } from '@maher/i18n';
import type { Warehouse, WarehouseBinContents, WarehouseDesk, WarehouseDeskLocation } from './api';

export function warehouseDisplayName(
  warehouse: Pick<Warehouse, 'code' | 'nameEn' | 'nameAr'> & { nameHe?: string | null },
  locale: string,
): string {
  return localizedName(locale, warehouse, warehouse.code);
}

export function warehouseTypeKey(type?: string | null): string {
  if (!type) return 'RAW_MATERIALS';
  return type;
}

export function formatWarehouseQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function binStockSummary(
  contents: Array<{ availableQty?: number | string | null }>,
): { skuCount: number; qty: number } {
  const skuCount = contents.length;
  const qty = contents.reduce((sum, row) => sum + Number(row.availableQty ?? 0), 0);
  return { skuCount, qty };
}

export function deskLocationToBinContents(
  warehouse: WarehouseDesk,
  loc: WarehouseDeskLocation,
): WarehouseBinContents {
  return {
    ...loc,
    warehouse: {
      id: warehouse.id,
      code: warehouse.code,
      nameEn: warehouse.nameEn,
      nameAr: warehouse.nameAr,
      nameHe: warehouse.nameHe,
      type: warehouse.type,
    },
    contents: loc.contents ?? [],
  };
}
