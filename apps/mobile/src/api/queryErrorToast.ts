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
