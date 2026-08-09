import { shouldDehydrateQuery } from '../queryPersist';
import type { Query } from '@tanstack/react-query';

function q(key: unknown[]): Query {
  return { queryKey: key } as Query;
}

describe('shouldDehydrateQuery offline whitelist', () => {
  it('persists catalog, tasks, sales-orders lists and statement detail', () => {
    expect(shouldDehydrateQuery(q(['catalog', 'list', {}]))).toBe(true);
    expect(shouldDehydrateQuery(q(['tasks', 'list', {}]))).toBe(true);
    expect(shouldDehydrateQuery(q(['sales-orders', 'list', {}]))).toBe(true);
    expect(shouldDehydrateQuery(q(['statements', 'detail', 'c1']))).toBe(true);
  });

  it('never persists auth or mutations-shaped keys', () => {
    expect(shouldDehydrateQuery(q(['auth', 'me']))).toBe(false);
    expect(shouldDehydrateQuery(q(['notifications', 'list']))).toBe(false);
    expect(shouldDehydrateQuery(q(['catalog', 'detail', 'p1']))).toBe(false);
  });
});
