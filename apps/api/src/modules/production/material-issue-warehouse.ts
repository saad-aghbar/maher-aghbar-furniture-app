export type IssueWarehouseOption = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe: string | null;
  availableQty: number;
  isDefault: boolean;
};

/** Prefer the bin with stock; otherwise the default RAW warehouse. */
export function pickSuggestedIssueWarehouseId(
  warehouses: Array<{ id: string; availableQty?: number; isDefault?: boolean }>,
): string | null {
  if (!warehouses.length) return null;
  const withStock = warehouses
    .filter((w) => (w.availableQty ?? 0) > 0)
    .sort((a, b) => (b.availableQty ?? 0) - (a.availableQty ?? 0));
  if (withStock[0]) return withStock[0].id;
  return warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]!.id;
}

export function issueWarehousesFromBalances(
  balances: Array<{
    availableQty: unknown;
    warehouse: {
      id: string;
      code: string;
      nameEn: string;
      nameAr: string;
      nameHe: string | null;
      isDefault: boolean;
    };
  }>,
): IssueWarehouseOption[] {
  const byId = new Map<string, IssueWarehouseOption>();
  for (const bal of balances) {
    const existing = byId.get(bal.warehouse.id);
    const qty = Number(bal.availableQty);
    if (existing) {
      existing.availableQty += qty;
      continue;
    }
    byId.set(bal.warehouse.id, {
      id: bal.warehouse.id,
      code: bal.warehouse.code,
      nameEn: bal.warehouse.nameEn,
      nameAr: bal.warehouse.nameAr,
      nameHe: bal.warehouse.nameHe,
      availableQty: qty,
      isDefault: bal.warehouse.isDefault,
    });
  }
  return [...byId.values()].sort((a, b) => b.availableQty - a.availableQty);
}

export function issueWarehousesFromCatalog(
  warehouses: Array<{
    id: string;
    code: string;
    nameEn: string;
    nameAr: string;
    nameHe: string | null;
    isDefault: boolean;
  }>,
): IssueWarehouseOption[] {
  return warehouses.map((w) => ({
    ...w,
    availableQty: 0,
  }));
}
