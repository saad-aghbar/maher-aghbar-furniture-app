/**
 * COUNT = DATASET — orderTypeCounts + journeyCounts must not depend on page size.
 * Cross-filter: each bar respects every OTHER filter, not its own selection.
 */

import { rollupOrderType } from '@maher/types';
import { crossFilterOrderFacets } from './order-type-facets';
import type { OrderFacetRow } from './order-type-facets';

function row(
  partial: Pick<OrderFacetRow, 'id' | 'status' | 'lines'> &
    Partial<Omit<OrderFacetRow, 'id' | 'status' | 'lines'>>,
): OrderFacetRow {
  return {
    productionOrders: [],
    deliveries: [],
    ...partial,
  };
}

/** Search-scoped "Milano" slice used by several cases. */
const DATASET: OrderFacetRow[] = [
  row({
    id: 's-prep-1',
    status: 'CONFIRMED',
    lines: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 's-prep-2',
    status: 'CONFIRMED',
    lines: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 'm-prep-1',
    status: 'CONFIRMED',
    lines: [{ manufacturingComplexity: 'MODIFIED', productId: 'p1' }],
  }),
  row({
    id: 'm-prep-2',
    status: 'DRAFT',
    lines: [{ manufacturingComplexity: 'MODIFIED', productId: 'p1' }],
  }),
  row({
    id: 'm-prep-3',
    status: 'READY_FOR_PRODUCTION',
    lines: [{ manufacturingComplexity: 'MODIFIED', productId: 'p1' }],
  }),
  row({
    id: 'c-prep-1',
    status: 'CONFIRMED',
    lines: [{ manufacturingComplexity: 'CUSTOM', productId: null }],
  }),
  row({
    id: 's-floor-1',
    status: 'IN_PRODUCTION',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-08-18T08:00:00.000Z',
        actualStartDate: '2026-08-21T07:30:00.000Z',
        status: 'IN_PROGRESS',
      },
    ],
    lines: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 's-floor-2',
    status: 'IN_PRODUCTION',
    productionOrders: [
      {
        releasedToFactoryAt: '2026-08-18T08:00:00.000Z',
        actualStartDate: '2026-08-21T07:30:00.000Z',
        status: 'IN_PROGRESS',
      },
    ],
    lines: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
  }),
  row({
    id: 'mixed-prep',
    status: 'CONFIRMED',
    lines: [
      { manufacturingComplexity: 'STANDARD', productId: 'p1' },
      { manufacturingComplexity: 'MODIFIED', productId: 'p1' },
    ],
  }),
  ...Array.from({ length: 8 }, (_, i) =>
    row({
      id: `s-extra-${i}`,
      status: 'CONFIRMED',
      lines: [{ manufacturingComplexity: 'STANDARD', productId: 'p1' }],
    }),
  ),
];

function paginate(ids: string[], page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  return ids.slice(skip, skip + pageSize);
}

describe('COUNT=DATASET orderTypeCounts regression', () => {
  it('mixed-line rollup is CUSTOM > MODIFIED > STANDARD — no MIXED', () => {
    expect(
      rollupOrderType([
        { manufacturingComplexity: 'STANDARD', productId: 'p1' },
        { manufacturingComplexity: 'MODIFIED', productId: 'p1' },
      ]),
    ).toBe('MODIFIED');
    const mixed = DATASET.find((r) => r.id === 'mixed-prep')!;
    const facets = crossFilterOrderFacets([mixed], {});
    expect(facets.orderTypeCounts).toEqual({ standard: 0, modified: 1, custom: 0 });
  });

  it('type + journey intersection equals scoped totalItems', () => {
    const facets = crossFilterOrderFacets(DATASET, {
      orderType: 'MODIFIED',
      journeyBucket: 'preparing',
    });
    expect(facets.scopedIds.length).toBe(facets.orderTypeCounts.modified);
    expect(facets.scopedIds.length).toBe(facets.journeyCounts.preparing);
    expect(facets.scopedIds.length).toBe(4);
  });

  it('Standard / Modified / Custom counts stay stable under pagination', () => {
    const all = crossFilterOrderFacets(DATASET, {});
    expect(all.orderTypeCounts.standard).toBe(12);
    expect(all.orderTypeCounts.modified).toBe(4);
    expect(all.orderTypeCounts.custom).toBe(1);

    for (const type of ['STANDARD', 'MODIFIED', 'CUSTOM'] as const) {
      const page1 = crossFilterOrderFacets(DATASET, { orderType: type });
      const page2 = crossFilterOrderFacets(DATASET, { orderType: type });
      expect(page1.orderTypeCounts).toEqual(all.orderTypeCounts);
      expect(page2.orderTypeCounts).toEqual(all.orderTypeCounts);
      const loaded = paginate(page1.scopedIds, 1, 3);
      expect(loaded.length).toBeLessThanOrEqual(3);
      expect(page1.scopedIds.length).toBe(all.orderTypeCounts[type.toLowerCase() as 'standard']);
    }
  });

  it('search-scoped dataset: type counts split that slice, not the global total', () => {
    const milano = DATASET.filter((r) =>
      ['s-prep-1', 's-prep-2', 'm-prep-1', 'm-prep-2', 'm-prep-3', 'c-prep-1'].includes(
        r.id,
      ),
    );
    const preparing = crossFilterOrderFacets(milano, { journeyBucket: 'preparing' });
    expect(preparing.orderTypeCounts).toEqual({ standard: 2, modified: 3, custom: 1 });
    const modified = crossFilterOrderFacets(milano, {
      journeyBucket: 'preparing',
      orderType: 'MODIFIED',
    });
    expect(modified.scopedIds.length).toBe(3);
    expect(modified.scopedIds.length).toBe(preparing.orderTypeCounts.modified);
  });

  it('switching type changes scoped ids — Standard pages are not the Modified dataset', () => {
    const standard = crossFilterOrderFacets(DATASET, { orderType: 'STANDARD' });
    const modified = crossFilterOrderFacets(DATASET, { orderType: 'MODIFIED' });
    expect(standard.scopedIds).not.toEqual(modified.scopedIds);
    expect(standard.scopedIds.some((id) => modified.scopedIds.includes(id))).toBe(false);
    expect(paginate(standard.scopedIds, 1, 5)).not.toEqual(
      paginate(modified.scopedIds, 1, 5),
    );
  });

  it('journeyCounts ignore the selected journey but respect selected type', () => {
    const modified = crossFilterOrderFacets(DATASET, { orderType: 'MODIFIED' });
    const modifiedPreparing = crossFilterOrderFacets(DATASET, {
      orderType: 'MODIFIED',
      journeyBucket: 'preparing',
    });
    expect(modifiedPreparing.journeyCounts).toEqual(modified.journeyCounts);
    expect(modifiedPreparing.scopedIds.length).toBe(modified.journeyCounts.preparing);
  });
});
