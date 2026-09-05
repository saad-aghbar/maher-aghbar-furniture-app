/**
 * COUNT = DATASET — request typeCounts + inboxCounts must not depend on page size.
 */

import { crossFilterRequestFacets } from './request-type-facets';
import type { RequestFacetRow } from './request-type-facets';

function row(partial: RequestFacetRow): RequestFacetRow {
  return partial;
}

const DATASET: RequestFacetRow[] = [
  row({
    id: 'w-s',
    status: 'SUBMITTED',
    items: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 'w-m',
    status: 'UNDER_REVIEW',
    items: [{ manufacturingComplexity: 'MODIFIED', productId: 'p1' }],
  }),
  row({
    id: 'n-c',
    status: 'NEEDS_INFORMATION',
    items: [{ manufacturingComplexity: 'CUSTOM', productId: null }],
  }),
  row({
    id: 'n-m',
    status: 'NEEDS_INFORMATION',
    items: [{ manufacturingComplexity: 'MODIFIED', productId: 'p1' }],
  }),
  row({
    id: 'q-s',
    status: 'QUOTED',
    items: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 'd-s',
    status: 'DRAFT',
    items: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 'd-c',
    status: 'DRAFT',
    items: [{ manufacturingComplexity: 'CUSTOM', productId: null }],
  }),
  ...Array.from({ length: 9 }, (_, i) =>
    row({
      id: `w-s-extra-${i}`,
      status: 'SUBMITTED',
      items: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
    }),
  ),
];

function paginate(ids: string[], page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  return ids.slice(skip, skip + pageSize);
}

describe('COUNT=DATASET request type + inbox regression', () => {
  it('type + review/status intersection equals scoped totalItems', () => {
    const facets = crossFilterRequestFacets(DATASET, {
      requestType: 'CUSTOM',
      statusGroup: 'needs_information',
    });
    expect(facets.scopedIds).toEqual(['n-c']);
    expect(facets.scopedIds.length).toBe(facets.typeCounts.custom);
    expect(facets.scopedIds.length).toBe(facets.inboxCounts.needs_info);
  });

  it('inbox chip counts are server-authoritative and ignore the selected chip', () => {
    const customAll = crossFilterRequestFacets(DATASET, { requestType: 'CUSTOM' });
    const customNeeds = crossFilterRequestFacets(DATASET, {
      requestType: 'CUSTOM',
      statusGroup: 'needs_information',
    });
    expect(customNeeds.inboxCounts).toEqual(customAll.inboxCounts);
    expect(customAll.inboxCounts).toEqual({
      all: 2,
      waiting: 0,
      needs_info: 1,
      quoted: 0,
      drafts: 1,
    });
  });

  it('pagination does not inflate type counts', () => {
    const full = crossFilterRequestFacets(DATASET, { statusGroup: 'open_inbox' });
    const page1Ids = paginate(full.scopedIds, 1, 5);
    expect(page1Ids.length).toBe(5);
    expect(full.typeCounts.standard).toBeGreaterThan(page1Ids.length);
    const again = crossFilterRequestFacets(DATASET, { statusGroup: 'open_inbox' });
    expect(again.typeCounts).toEqual(full.typeCounts);
    expect(again.inboxCounts).toEqual(full.inboxCounts);
  });

  it('search + type: counts split the search-scoped slice', () => {
    const sofa = DATASET.filter((r) =>
      ['w-s', 'w-m', 'n-c', 'n-m', 'q-s'].includes(r.id),
    );
    const split = crossFilterRequestFacets(sofa, { statusGroup: 'open_inbox' });
    expect(split.typeCounts).toEqual({ standard: 2, modified: 2, custom: 1 });
    const modified = crossFilterRequestFacets(sofa, {
      statusGroup: 'open_inbox',
      requestType: 'MODIFIED',
    });
    expect(modified.scopedIds.length).toBe(2);
    expect(modified.scopedIds.length).toBe(split.typeCounts.modified);
  });
});
