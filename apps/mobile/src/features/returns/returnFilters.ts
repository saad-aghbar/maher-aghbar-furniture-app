export const RETURN_STATUS_FILTERS = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type ReturnStatusFilter = (typeof RETURN_STATUS_FILTERS)[number];

export type ReturnsDealerOption = {
  id: string;
  name: string;
  code?: string | null;
  searchText?: string;
};

export function filterDealersByQuery(
  dealers: ReturnsDealerOption[],
  query: string,
): ReturnsDealerOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return dealers;
  return dealers.filter((d) => {
    const hay = `${d.name} ${d.searchText ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function isReturnStatusFilterActive(status: ReturnStatusFilter): boolean {
  return status !== 'ALL';
}
