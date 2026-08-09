/** Whether the caller may see inventory unit / standard costs. */
export function canViewInventoryCost(permissions: string[] | undefined): boolean {
  return Boolean(permissions?.includes('inventory.cost.read'));
}

type CostFields = {
  standardCost?: unknown;
  unitCost?: unknown;
};

/** Strip cost fields from a single record when unauthorized. */
export function stripInventoryCostFields<T extends CostFields>(
  record: T,
  permissions: string[] | undefined,
): Omit<T, 'standardCost' | 'unitCost'> | T {
  if (canViewInventoryCost(permissions)) return record;
  const { standardCost: _sc, unitCost: _uc, ...rest } = record;
  return rest;
}

export function stripInventoryCostList<T extends CostFields>(
  records: T[],
  permissions: string[] | undefined,
): Array<Omit<T, 'standardCost' | 'unitCost'> | T> {
  return records.map((r) => stripInventoryCostFields(r, permissions));
}
