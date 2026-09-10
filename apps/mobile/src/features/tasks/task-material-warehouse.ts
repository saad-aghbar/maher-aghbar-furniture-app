export type FloorWarehouseOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  availableQty?: number;
  isDefault?: boolean;
};

/** Prefer the bin with stock; otherwise the default RAW warehouse. */
export function pickDefaultWarehouseId(
  warehouses: FloorWarehouseOption[],
): string | null {
  if (!warehouses.length) return null;
  const withStock = warehouses
    .filter((w) => (w.availableQty ?? 0) > 0)
    .sort((a, b) => (b.availableQty ?? 0) - (a.availableQty ?? 0));
  if (withStock[0]) return withStock[0].id;
  return warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]!.id;
}
