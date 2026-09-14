export type CostDesk = 'money' | 'orders' | 'products' | 'inventory' | 'returns' | 'coverage';

export type CostFilterState = {
  customerId: string | null;
  productId: string | null;
  variantId: string | null;
  optionValueId: string | null;
  status: string | null;
  complexity: string | null;
  coverage: string | null;
  marginHealth: string | null;
  hasReturn: string | null;
  hasRework: string | null;
  delivered: string | null;
  lifecycle: string | null;
  issueType: string | null;
  sort: string | null;
};

export const EMPTY_COST_FILTER: CostFilterState = {
  customerId: null,
  productId: null,
  variantId: null,
  optionValueId: null,
  status: null,
  complexity: null,
  coverage: null,
  marginHealth: null,
  hasReturn: null,
  hasRework: null,
  delivered: null,
  lifecycle: null,
  issueType: null,
  sort: null,
};

export type CostFilterOption = {
  id: string;
  name: string;
  searchText?: string;
  code?: string;
};

/** Sales-order statuses sent to `costOrdersWhere`. */
export const COST_ORDER_STATUS_OPTIONS = [
  'IN_PRODUCTION',
  'READY_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

/** @deprecated Use COST_ORDER_STATUS_OPTIONS — returns must use COST_RETURN_STATUS_OPTIONS. */
export const COST_STATUS_OPTIONS = COST_ORDER_STATUS_OPTIONS;

/** Return lifecycle states sent to `costReturnsWhere` (`lifecycleState`). */
export const COST_RETURN_STATUS_OPTIONS = [
  'REQUESTED',
  'NEED_INFO',
  'APPROVED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTING',
  'REWORKING',
  'REPLACING',
  'READY_TO_RETURN',
  'RETURNING',
  'RETURNED_TO_STOCK',
  'SCRAPPED',
  'COMPLETED',
  'REJECTED',
] as const;

export function costStatusLabelKey(desk: CostDesk, status: string) {
  if (desk === 'returns') return `mobile.reports.returnStatus.${status}`;
  return `mobile.reports.status.${status}`;
}

export function costComplexityLabelKey(complexity: string) {
  return `mobile.reports.complexity.${complexity}`;
}

export function costFilterQueryKey(filter: CostFilterState) {
  return [
    filter.customerId,
    filter.productId,
    filter.variantId,
    filter.optionValueId,
    filter.status,
    filter.complexity,
    filter.coverage,
    filter.marginHealth,
    filter.hasReturn,
    filter.hasRework,
    filter.delivered,
    filter.lifecycle,
    filter.issueType,
    filter.sort,
  ].join('|');
}

export function costFilterActiveCount(filter: CostFilterState) {
  return [
    filter.customerId,
    filter.productId,
    filter.variantId,
    filter.optionValueId,
    filter.status,
    filter.complexity,
    filter.coverage,
    filter.marginHealth,
    filter.hasReturn,
    filter.hasRework,
    filter.delivered,
    filter.lifecycle,
    filter.issueType,
    filter.sort,
  ].filter(Boolean).length;
}

export function costFilterActive(filter: CostFilterState) {
  return costFilterActiveCount(filter) > 0;
}

export function costQueryFromFilter(filter: CostFilterState) {
  return {
    customerId: filter.customerId ?? undefined,
    productId: filter.productId ?? undefined,
    variantId: filter.variantId ?? undefined,
    optionValueId: filter.optionValueId ?? undefined,
    status: filter.status ?? undefined,
    complexity: filter.complexity ?? undefined,
    coverage: filter.coverage ?? undefined,
    marginHealth: filter.marginHealth ?? undefined,
    hasReturn: filter.hasReturn ?? undefined,
    hasRework: filter.hasRework ?? undefined,
    delivered: filter.delivered ?? undefined,
    lifecycle: filter.lifecycle ?? undefined,
    type: filter.issueType ?? undefined,
    sort: filter.sort ?? undefined,
  };
}
