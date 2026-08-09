import { clearTokens } from '@/storage/tokens';

type SessionListener = () => void;

const listeners = new Set<SessionListener>();

/** Subscribe to forced session expiry (refresh failed / logout). */
export function onSessionExpired(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

/** Clear tokens and notify listeners. */
export async function clearSession(): Promise<void> {
  await clearTokens();
  emitSessionExpired();
}
