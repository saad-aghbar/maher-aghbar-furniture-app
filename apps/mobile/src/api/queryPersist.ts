import type { Query } from '@tanstack/react-query';

type PersistedQueryLike = { state?: { status?: string } };
type PersistedClientLike = {
  clientState?: { queries?: PersistedQueryLike[] };
};

export const QUERY_PERSIST_KEY = 'maher.rq.cache';

function isWhitelistedKey(query: Query): boolean {
  const key = query.queryKey;
  if (!Array.isArray(key) || key.length < 2) return false;
  const root = key[0];
  const kind = key[1];
  if (root === 'catalog' && kind === 'list') return true;
  if (root === 'tasks' && kind === 'list') return true;
  if (root === 'sales-orders' && kind === 'list') return true;
  if (root === 'statements' && kind === 'detail') return true;
  return false;
}

/**
 * Persist recent lists for offline — never tokens, mutations, or in-flight queries.
 * Pending dehydrate throws a TanStack debug string that must never reach the UI.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state?.status !== 'success') return false;
  return isWhitelistedKey(query);
}

/** Drop in-flight queries from a restored persist blob so hydrate cannot throw debug UI. */
export function stripPendingFromPersistedClient<T>(client: T): T {
  if (!client || typeof client !== 'object') return client;
  const rec = client as PersistedClientLike;
  const queries = rec.clientState?.queries;
  if (!Array.isArray(queries)) return client;
  return {
    ...rec,
    clientState: {
      ...rec.clientState,
      queries: queries.filter((q) => q?.state?.status === 'success'),
    },
  } as T;
}
