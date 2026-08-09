import { isApiError } from './errors';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Client-level / Query-level retry policy.
 * Never auto-retry destructive mutations.
 */
export function shouldRetryRequest(
  method: string,
  status: number | undefined,
  attempt: number,
  maxAttempts = 2,
): boolean {
  if (attempt >= maxAttempts) return false;
  const upper = method.toUpperCase();
  if (MUTATING.has(upper)) return false;
  if (status == null) return true; // network failure on GET
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

/** TanStack Query retry predicate for queries. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!isApiError(error)) return failureCount < 1;
  if (error.isOffline || error.isAborted || error.isTimeout) return false;
  if (error.status === 429) return true;
  if (error.status >= 500) return true;
  if (error.status >= 400 && error.status < 500) return false;
  return false;
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}
