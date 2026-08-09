export const PO_STATUS_FILTERS = [
  'ALL',
  'DRAFT',
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CLOSED',
] as const;

export const PR_STATUS_FILTERS = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'ORDERED',
  'CLOSED',
] as const;

export const SI_STATUS_FILTERS = [
  'ALL',
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
] as const;

export type PoStatusFilter = (typeof PO_STATUS_FILTERS)[number];
export type PrStatusFilter = (typeof PR_STATUS_FILTERS)[number];
export type SiStatusFilter = (typeof SI_STATUS_FILTERS)[number];

export type PurchasingHubTab = 'orders' | 'requests' | 'invoices';

export type PurchasingSupplierOption = {
  id: string;
  name: string;
  code?: string | null;
  searchText?: string;
  isCertified?: boolean | null;
};

export function statusFiltersForTab(tab: PurchasingHubTab) {
  if (tab === 'orders') return PO_STATUS_FILTERS;
  if (tab === 'requests') return PR_STATUS_FILTERS;
  return SI_STATUS_FILTERS;
}

export function filterSuppliersByQuery(
  suppliers: PurchasingSupplierOption[],
  query: string,
): PurchasingSupplierOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return suppliers;
  return suppliers.filter((s) => {
    const hay = `${s.name} ${s.searchText ?? ''} ${s.code ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function isStatusFilterActive(status: string): boolean {
  return status !== 'ALL';
}
