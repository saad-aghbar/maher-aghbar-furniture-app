import type { Query } from '@tanstack/react-query';

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
