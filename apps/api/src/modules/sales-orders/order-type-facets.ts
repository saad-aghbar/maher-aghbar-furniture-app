/**
 * Cross-filtered Order Journey × Standard/Modified/Custom facets.
 * Each bar respects every OTHER active filter, not its own selection.
 */

import {
  emptyOrderTypeCounts,
  manufacturingComplexityToTypeSlug,
  rollupOrderType,
  type ManufacturingComplexityCode,
  type OrderTypeCounts,
  type OrderTypeLineInput,
} from '@maher/types';
import {
  classifyAdminOrderJourneyBucket,
  emptyJourneyCounts,
  type AdminOrderJourneyBucket,
  type AdminOrderJourneyCounts,
  type JourneyClassifyInput,
} from './admin-order-journey';

export type OrderFacetRow = JourneyClassifyInput & {
  id: string;
  lines: OrderTypeLineInput[];
  hasReturn?: boolean;
};

export function crossFilterOrderFacets(
  rows: OrderFacetRow[],
  opts: {
    journeyBucket?: AdminOrderJourneyBucket | null;
    orderType?: ManufacturingComplexityCode | null;
    returned?: boolean;
  },
): {
  journeyCounts: AdminOrderJourneyCounts;
  orderTypeCounts: OrderTypeCounts;
  returned: number;
  scopedIds: string[];
} {
  const typeFilter = opts.orderType ?? null;
  const journeyFilter = opts.journeyBucket ?? null;
  const returnedFilter = opts.returned === true;
  const journeyCounts = emptyJourneyCounts();
  const orderTypeCounts = emptyOrderTypeCounts();
  const scopedIds: string[] = [];
  let returned = 0;

  for (const row of rows) {
    const type = rollupOrderType(row.lines);
    const journey = classifyAdminOrderJourneyBucket(row);
    const hasReturn = Boolean(row.hasReturn);
    const matchesType = !typeFilter || type === typeFilter;
    const matchesJourney = !journeyFilter || journey === journeyFilter;
    const matchesReturned = !returnedFilter || hasReturn;

    if (matchesType && matchesReturned) {
      journeyCounts[journey] += 1;
      journeyCounts.all += 1;
    }
    if (matchesJourney && matchesReturned) {
      orderTypeCounts[manufacturingComplexityToTypeSlug(type)] += 1;
    }
    if (matchesType && matchesJourney && hasReturn) {
      returned += 1;
    }
    if (matchesType && matchesJourney && matchesReturned) {
      scopedIds.push(row.id);
    }
  }

  return { journeyCounts, orderTypeCounts, returned, scopedIds };
}
