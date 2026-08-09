import { getMe, type MeResponse } from '@/api/modules/auth';
import { isApiError } from '@/api/errors';
import { getIsConnected } from '@/api/online';
import { refreshSession } from '@/api/refresh';
import { getRefreshToken } from '@/storage/tokens';
import { mapRestoreFailure } from './mapAuthError';

export type RestoreResult =
  | { status: 'authenticated'; user: MeResponse }
  | { status: 'unauthenticated' }
  | { status: 'disabled' }
  | { status: 'session_expired' }
  | { status: 'offline' };

export type RestoreDeps = {
  getRefreshTokenFn?: () => Promise<string | null>;
  getIsConnectedFn?: () => Promise<boolean | null>;
  refreshFn?: () => Promise<unknown>;
  getMeFn?: () => Promise<MeResponse>;
};

/**
 * Cold-start session restore — pure async helper for AuthProvider + tests.
 */
export async function restoreSession(deps: RestoreDeps = {}): Promise<RestoreResult> {
  const getRefresh = deps.getRefreshTokenFn ?? getRefreshToken;
  const getConnected = deps.getIsConnectedFn ?? getIsConnected;
  const doRefresh = deps.refreshFn ?? (() => refreshSession());
  const doMe = deps.getMeFn ?? getMe;

  const refresh = await getRefresh();
  if (!refresh) {
    return { status: 'unauthenticated' };
  }

  const connected = await getConnected();
  if (connected === false) {
    // Tokens exist but offline — defer network; treat as needing unlock/home with stale risk.
    // Prefer offline status so UI can retry.
    return { status: 'offline' };
  }

  try {
    await doRefresh();
    const user = await doMe();
    return { status: 'authenticated', user };
  } catch (error) {
    if (isApiError(error) && error.code === 'ACCOUNT_SUSPENDED') {
      return { status: 'disabled' };
    }
    return { status: mapRestoreFailure(error) };
  }
}
