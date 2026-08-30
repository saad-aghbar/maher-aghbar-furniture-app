import { shouldDehydrateQuery, stripPendingFromPersistedClient } from '../queryPersist';
import type { Query } from '@tanstack/react-query';

function q(key: unknown[], status: 'success' | 'pending' | 'error' = 'success'): Query {
  return { queryKey: key, state: { status } } as Query;
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

  it('never persists pending or error queries (avoids TanStack dehydrate debug UI)', () => {
    expect(shouldDehydrateQuery(q(['catalog', 'list', {}], 'pending'))).toBe(false);
    expect(shouldDehydrateQuery(q(['catalog', 'list', {}], 'error'))).toBe(false);
    expect(shouldDehydrateQuery(q(['tasks', 'list', {}], 'pending'))).toBe(false);
  });

  it('strips pending queries from a restored persist blob', () => {
    const restored = stripPendingFromPersistedClient({
      clientState: {
        queries: [
          { state: { status: 'success' } },
          { state: { status: 'pending' } },
          { state: { status: 'error' } },
        ],
      },
    });
    expect(restored.clientState.queries).toEqual([{ state: { status: 'success' } }]);
  });
});
