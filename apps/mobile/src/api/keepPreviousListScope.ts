/**
 * keepPreviousData must not paint another type/journey/inbox scope.
 * Search and sort may keep the previous page; type and lane switches may not.
 */
export function keepPreviousListDataIfSameScope<T>(
  previousData: T | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
  currentScope: Record<string, unknown>,
  scopeKeys: readonly string[],
): T | undefined {
  if (previousData == null || previousQuery == null) return undefined;
  const prevFilters = previousQuery.queryKey[previousQuery.queryKey.length - 1];
  if (!prevFilters || typeof prevFilters !== 'object') return undefined;
  const prev = prevFilters as Record<string, unknown>;
  for (const key of scopeKeys) {
    if ((prev[key] ?? null) !== (currentScope[key] ?? null)) return undefined;
  }
  return previousData;
}
