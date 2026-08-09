import type { AuthUser } from '@maher/types';
import { getApiV1Url } from './config';
import { apiErrorFromResponse, ApiError } from './errors';
import { createRequestId } from './requestId';
import {
  clearTokens,
  getRefreshToken,
  setTokens,
  type TokenPair,
} from '@/storage/tokens';
import { clearSession } from '@/auth/session';

export type MobileAuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type TokenStore = {
  getRefreshToken: () => Promise<string | null>;
  setTokens: (pair: TokenPair) => Promise<void>;
  clearTokens: () => Promise<void>;
};

export type RefreshDeps = {
  fetchFn?: typeof fetch;
  store?: TokenStore;
  baseUrl?: string;
  onRefreshFailed?: () => Promise<void>;
};

let inFlight: Promise<TokenPair> | null = null;

const defaultStore: TokenStore = {
  getRefreshToken,
  setTokens,
  clearTokens,
};

/**
 * Single-flight refresh. Concurrent callers share one POST /auth/mobile/refresh.
 */
export async function refreshSession(deps: RefreshDeps = {}): Promise<TokenPair> {
  if (inFlight) return inFlight;

  const run = doRefresh(deps).finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

/** Test helper — reset single-flight gate. */
export function resetRefreshFlight(): void {
  inFlight = null;
}

async function doRefresh(deps: RefreshDeps): Promise<TokenPair> {
  const fetchFn = deps.fetchFn ?? fetch;
  const store = deps.store ?? defaultStore;
  const baseUrl = deps.baseUrl ?? getApiV1Url();
  const onRefreshFailed =
    deps.onRefreshFailed ??
    (async () => {
      await clearSession();
    });

  const refreshToken = await store.getRefreshToken();
  if (!refreshToken) {
    await onRefreshFailed();
    throw new ApiError('Missing refresh token', { status: 401, code: 'UNAUTHORIZED' });
  }

  const requestId = createRequestId();
  const res = await fetchFn(`${baseUrl}/auth/mobile/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': requestId,
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    await onRefreshFailed();
    throw apiErrorFromResponse(res.status, body, res.headers.get('x-request-id') ?? requestId);
  }

  const json = (await res.json()) as MobileAuthResponse;
  const pair: TokenPair = {
    accessToken: json.accessToken,
    refreshToken: json.refreshToken,
  };
  await store.setTokens(pair);
  return pair;
}
