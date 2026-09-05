/**
 * Cross-filtered Factory Review inbox × Standard/Modified/Custom facets.
 * Each bar respects every OTHER active filter, not its own selection.
 */

import {
  classifyRequestInboxChip,
  emptyOrderTypeCounts,
  emptyRequestInboxCounts,
  manufacturingComplexityToTypeSlug,
  requestStatusesForGroup,
  rollupOrderType,
  type ManufacturingComplexityCode,
  type OrderTypeCounts,
  type OrderTypeLineInput,
  type RequestInboxCounts,
} from '@maher/types';

export type RequestFacetRow = {
  id: string;
  status: string;
  items: OrderTypeLineInput[];
};

export function crossFilterRequestFacets(
  rows: RequestFacetRow[],
  opts: {
    statusGroup?: string | null;
    requestType?: ManufacturingComplexityCode | null;
  },
): {
  typeCounts: OrderTypeCounts;
  inboxCounts: RequestInboxCounts;
  scopedIds: string[];
} {
  const typeFilter = opts.requestType ?? null;
  const groupStatuses = opts.statusGroup
    ? requestStatusesForGroup(opts.statusGroup)
    : null;
  const typeCounts = emptyOrderTypeCounts();
  const inboxCounts = emptyRequestInboxCounts();
  const scopedIds: string[] = [];

  for (const row of rows) {
    const type = rollupOrderType(row.items);
    const status = String(row.status ?? '').toUpperCase();
    const matchesType = !typeFilter || type === typeFilter;
    const matchesGroup =
      !groupStatuses?.length || groupStatuses.includes(status);

    if (matchesGroup) {
      typeCounts[manufacturingComplexityToTypeSlug(type)] += 1;
    }
    if (matchesType) {
      const chip = classifyRequestInboxChip(status);
      if (chip) {
        inboxCounts[chip] += 1;
        inboxCounts.all += 1;
      }
    }
    if (matchesType && matchesGroup) {
      scopedIds.push(row.id);
    }
  }

  return { typeCounts, inboxCounts, scopedIds };
}
