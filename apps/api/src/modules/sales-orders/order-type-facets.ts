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
};

export function crossFilterOrderFacets(
  rows: OrderFacetRow[],
  opts: {
    journeyBucket?: AdminOrderJourneyBucket | null;
    orderType?: ManufacturingComplexityCode | null;
  },
): {
  journeyCounts: AdminOrderJourneyCounts;
  orderTypeCounts: OrderTypeCounts;
  scopedIds: string[];
} {
  const typeFilter = opts.orderType ?? null;
  const journeyFilter = opts.journeyBucket ?? null;
  const journeyCounts = emptyJourneyCounts();
  const orderTypeCounts = emptyOrderTypeCounts();
  const scopedIds: string[] = [];

  for (const row of rows) {
    const type = rollupOrderType(row.lines);
    const journey = classifyAdminOrderJourneyBucket(row);
    const matchesType = !typeFilter || type === typeFilter;
    const matchesJourney = !journeyFilter || journey === journeyFilter;

    if (matchesType) {
      journeyCounts[journey] += 1;
      journeyCounts.all += 1;
    }
    if (matchesJourney) {
      orderTypeCounts[manufacturingComplexityToTypeSlug(type)] += 1;
    }
    if (matchesType && matchesJourney) {
      scopedIds.push(row.id);
    }
  }

  return { journeyCounts, orderTypeCounts, scopedIds };
}
