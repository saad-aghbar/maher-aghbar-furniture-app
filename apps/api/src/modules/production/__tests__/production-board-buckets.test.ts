import {
  productionBoardBucketCountWhere,
  productionBoardBucketWhere,
  type ProductionBoardBucketKey,
} from '../production-board-buckets';

describe('productionBoardBucketWhere (shared predicates)', () => {
  const buckets: ProductionBoardBucketKey[] = [
    'needs_setup',
    'ready_to_start',
    'on_floor',
    'blocked',
    'inspection_packaging',
  ];

  it('exports a predicate for every board bucket', () => {
    const now = new Date('2026-09-01T12:00:00Z');
    for (const bucket of buckets) {
      const where = productionBoardBucketWhere(bucket, now);
      expect(where).toBeTruthy();
      const countWhere = productionBoardBucketCountWhere(bucket, now);
      expect(countWhere).toMatchObject({ archivedAt: null });
    }
  });

  it('Needs Planning (needs_setup) is unreleased — no releasedToFactoryAt', () => {
    const where = productionBoardBucketWhere('needs_setup');
    expect(where).toMatchObject({
      releasedToFactoryAt: null,
      actualStartDate: null,
    });
  });

  it('Ready for Factory requires actualStartDate null (date due does not clear it)', () => {
    const where = productionBoardBucketWhere('ready_to_start') as {
      AND?: Array<Record<string, unknown>>;
    };
    const and = where.AND ?? [];
    const readyClause = and.find((c) => 'actualStartDate' in c);
    expect(readyClause).toMatchObject({ actualStartDate: null });
  });

  it('In Production (on_floor) is IN_PROGRESS — not READY by planned date', () => {
    const where = productionBoardBucketWhere('on_floor') as {
      AND?: Array<Record<string, unknown>>;
    };
    const and = where.AND ?? [];
    const floor = and.find((c) => c.status === 'IN_PROGRESS' || (c.status as { equals?: string })?.equals === 'IN_PROGRESS');
    // Prisma enum may serialize as string
    const statusClause = and.find((c) => 'status' in c && !('OR' in c && Object.keys(c).length === 1));
    expect(JSON.stringify(where)).toContain('IN_PROGRESS');
    expect(JSON.stringify(where)).not.toContain('plannedStartDate');
    expect(statusClause || floor || and.length > 0).toBeTruthy();
  });
});
