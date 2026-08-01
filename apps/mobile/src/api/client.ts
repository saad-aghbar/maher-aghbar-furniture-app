import type { ApiError } from '@maher/types';
import { API_PREFIX, getApiBaseUrl } from './config';
import { tokenStorage } from '../storage/tokens';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(body?.message ?? `Request failed (${status})`);
    this.name = 'ApiClientError';
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(`${getApiBaseUrl()}${API_PREFIX}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken, client: 'mobile' }),
  });
  if (!res.ok) {
    await tokenStorage.clear();
    return false;
  }
  const data = (await res.json()) as {
    accessToken?: string;
    refreshToken?: string;
  };
  if (!data.accessToken || !data.refreshToken) {
    await tokenStorage.clear();
    return false;
  }
  await tokenStorage.saveTokens(data.accessToken, data.refreshToken);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const access = await tokenStorage.getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  const doFetch = () =>
    fetch(`${getApiBaseUrl()}${API_PREFIX}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

  let res = await doFetch();

  if (res.status === 401 && options.auth !== false) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      const access = await tokenStorage.getAccessToken();
      if (access) headers.Authorization = `Bearer ${access}`;
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let body: ApiError | null = null;
    try {
      const json = (await res.json()) as { error?: ApiError };
      body = json.error ?? (json as ApiError);
    } catch {
      body = null;
    }
    throw new ApiClientError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
