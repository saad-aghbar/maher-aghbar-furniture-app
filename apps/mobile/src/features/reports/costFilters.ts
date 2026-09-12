export type CostFilterState = {
  customerId: string | null;
  productId: string | null;
  variantId: string | null;
  optionValueId: string | null;
  status: string | null;
};

export const EMPTY_COST_FILTER: CostFilterState = {
  customerId: null,
  productId: null,
  variantId: null,
  optionValueId: null,
  status: null,
};

export const COST_STATUS_OPTIONS = [
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

export function costFilterQueryKey(filter: CostFilterState) {
  return `${filter.customerId ?? ''}|${filter.productId ?? ''}|${filter.variantId ?? ''}|${filter.optionValueId ?? ''}|${filter.status ?? ''}`;
}

export function costFilterActive(filter: CostFilterState) {
  return Boolean(filter.customerId || filter.productId || filter.variantId || filter.optionValueId || filter.status);
}
