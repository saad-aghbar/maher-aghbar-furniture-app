import type { Query } from '@tanstack/react-query';

export const QUERY_PERSIST_KEY = 'maher.rq.cache';

/** Persist recent lists for offline — never tokens or mutations. */
export function shouldDehydrateQuery(query: Query): boolean {
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
