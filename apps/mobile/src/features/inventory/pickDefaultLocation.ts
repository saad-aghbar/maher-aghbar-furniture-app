export type BinLike = {
  id: string;
  code?: string | null;
  name?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

/** Default bin first so the selected shelf is above the fold in pickers. */
export function sortBinsForPicker<T extends BinLike>(locations: T[]): T[] {
  return [...locations].sort((a, b) => {
    if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
    return (a.code ?? '').localeCompare(b.code ?? '');
  });
}

/** Prefer the current selection, then the warehouse default, then the first active bin. */
export function pickDefaultLocationId(
  locations: BinLike[],
  current?: string | null,
): string {
  const active = locations.filter((row) => row.isActive !== false);
  if (current && active.some((row) => row.id === current)) return current;
  return active.find((row) => row.isDefault)?.id ?? active[0]?.id ?? '';
}

export function locationDisplayName(loc: BinLike | null | undefined): string {
  if (!loc) return '';
  return loc.name?.trim() || loc.code?.trim() || '';
}

/** Picker / strip label: keep the scannable code next to the human name. */
export function locationPickerLabel(loc: BinLike | null | undefined): string {
  if (!loc) return '';
  const code = loc.code?.trim() ?? '';
  const name = loc.name?.trim() ?? '';
  if (code && name && name !== code) return `${code} — ${name}`;
  return name || code;
}

export const PICKER_WAREHOUSE_MIN = 300;
export const PICKER_WAREHOUSE_MAX = 380;
export const PICKER_WAREHOUSE_DESK_MIN = 400;
export const PICKER_WAREHOUSE_DESK_MAX = 520;
export const PICKER_BIN_MIN = 280;
export const PICKER_BIN_MAX = 360;
export const PICKER_BIN_DESK_MIN = 360;
export const PICKER_BIN_DESK_MAX = 480;

/** Independent scroll viewports for warehouse + bin boxes inside sheets. */
export function pickerViewportHeights(windowHeight: number, isDesk = false) {
  const h = Math.max(0, windowHeight);
  const warehouseMin = isDesk ? PICKER_WAREHOUSE_DESK_MIN : PICKER_WAREHOUSE_MIN;
  const warehouseMax = isDesk ? PICKER_WAREHOUSE_DESK_MAX : PICKER_WAREHOUSE_MAX;
  const binMin = isDesk ? PICKER_BIN_DESK_MIN : PICKER_BIN_MIN;
  const binMax = isDesk ? PICKER_BIN_DESK_MAX : PICKER_BIN_MAX;
  return {
    sheet: Math.round(h * (isDesk ? 0.88 : 0.86)),
    warehouse: Math.max(
      warehouseMin,
      Math.min(warehouseMax, Math.round(h * (isDesk ? 0.34 : 0.3))),
    ),
    bin: Math.max(binMin, Math.min(binMax, Math.round(h * (isDesk ? 0.3 : 0.26)))),
  };
}

const LRI = '\u2066';
const PDI = '\u2069';

/** Keep Latin bin codes as one run when they sit next to an Arabic warehouse name. */
export function isolateLtrRun(text: string): string {
  const value = text.trim();
  if (!value) return '';
  return `${LRI}${value}${PDI}`;
}

export function warehouseBinLine(
  warehouseName: string,
  binName?: string | null,
): string {
  const bin = binName?.trim();
  if (!bin) return warehouseName;
  if (!warehouseName) return isolateLtrRun(bin);
  return `${warehouseName} · ${isolateLtrRun(bin)}`;
}
