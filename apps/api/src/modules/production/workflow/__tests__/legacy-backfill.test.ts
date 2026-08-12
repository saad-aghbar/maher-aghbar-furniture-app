import { inferLegacySnapshotEdges } from '../domain/legacy-backfill';

describe('legacy backfill edge inference', () => {
  it('infers edges from dependsOnCodes without inventing missing codes', () => {
    const edges = inferLegacySnapshotEdges([
      { code: 'A', dependsOnCodes: [] },
      { code: 'B', dependsOnCodes: ['A'] },
      { code: 'C', dependsOnCodes: ['B', 'MISSING'] },
    ]);
    expect(edges).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ]);
  });

  it('is idempotent on duplicate depends', () => {
    const edges = inferLegacySnapshotEdges([
      { code: 'A', dependsOnCodes: [] },
      { code: 'B', dependsOnCodes: ['A', 'A'] },
    ]);
    expect(edges).toEqual([{ from: 'A', to: 'B' }]);
  });
});
