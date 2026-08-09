/**
 * Pure helpers for offline / network UI visibility (unit-testable).
 */
export function shouldShowOfflineBanner(isConnected: boolean | null): boolean {
  return isConnected === false;
}

export function networkStatusLabel(isConnected: boolean | null): 'online' | 'offline' | 'unknown' {
  if (isConnected === true) return 'online';
  if (isConnected === false) return 'offline';
  return 'unknown';
}
