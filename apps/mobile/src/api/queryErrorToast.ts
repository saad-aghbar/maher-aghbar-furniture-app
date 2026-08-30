/** RN / fetch debug strings that should never reach the user. */
export function isRawNetworkFailureMessage(message: string | undefined | null): boolean {
  if (!message) return false;
  return /network request failed|failed to fetch|networkerror|load failed/i.test(message);
}

export function isRawNetworkFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return isRawNetworkFailureMessage(message);
}

/**
 * Floor queue (worker-home + /tasks). Failures belong on employee screens
 * that requested the feed — never as a global toast on admin/dealer routes.
 */
export function isWorkerQueueQueryKey(queryKey: readonly unknown[] | undefined): boolean {
  if (!queryKey || queryKey.length === 0) return false;
  if (queryKey[0] === 'tasks') return true;
  return queryKey[0] === 'reports' && queryKey[1] === 'worker-home';
}

export function shouldSkipGlobalQueryErrorToast(
  queryKey?: readonly unknown[],
  meta?: unknown,
): boolean {
  if (isWorkerQueueQueryKey(queryKey)) return true;
  if (meta && typeof meta === 'object' && (meta as { skipGlobalErrorToast?: boolean }).skipGlobalErrorToast) {
    return true;
  }
  return false;
}
