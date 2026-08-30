import { getAccessToken } from '@/storage/tokens';
import { getActiveLocale } from '@/i18n/LocaleProvider';
import { getApiV1Url } from './config';
import {
  abortedError,
  apiErrorFromResponse,
  assertOnline,
  isApiError,
  timeoutError,
} from './errors';
import { getIsConnected } from './online';
import { createRequestId } from './requestId';
import { isMutatingMethod, shouldRetryRequest } from './retry';
import { refreshSession } from './refresh';

export const DEFAULT_TIMEOUT_MS = 30_000;

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** When false, skip Bearer header. */
  auth?: boolean;
  /** Skip 401 → refresh → retry. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injected for tests. */
  fetchFn?: typeof fetch;
  getAccessTokenFn?: () => Promise<string | null>;
  getIsConnectedFn?: () => Promise<boolean | null>;
  refreshFn?: () => Promise<unknown>;
  /** Accept-Language override (tests / callers). */
  acceptLanguage?: string;
};

function mergeSignals(timeoutMs: number, external?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort();
  };
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort);
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (external) external.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Core API request against `/api/v1`.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const fetchFn = options.fetchFn ?? fetch;
  const getToken = options.getAccessTokenFn ?? getAccessToken;
  const getConnected = options.getIsConnectedFn ?? getIsConnected;
  const doRefresh = options.refreshFn ?? refreshSession;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const auth = options.auth !== false;

  const connected = await getConnected();
  assertOnline(connected);

  const url = path.startsWith('http') ? path : `${getApiV1Url()}${path.startsWith('/') ? path : `/${path}`}`;

  let attempt = 0;
  let didRefresh = false;

  // Transport retries for safe GETs
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const requestId = createRequestId();
    const { signal, cleanup, didTimeout } = mergeSignals(timeoutMs, options.signal);

    const headers: Record<string, string> = {
      'x-request-id': requestId,
      Accept: 'application/json',
      ...options.headers,
      'Accept-Language': options.acceptLanguage ?? getActiveLocale(),
    };

    let body: BodyInit | undefined;
    if (options.body !== undefined && options.body !== null) {
      if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
        body = options.body;
      } else {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
        body = JSON.stringify(options.body);
      }
    }

    if (auth) {
      const token = await getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetchFn(url, {
        method,
        headers,
        body,
        signal,
      });

      if (res.status === 401 && auth && !options.skipRefresh && !didRefresh) {
        cleanup();
        didRefresh = true;
        await doRefresh();
        continue;
      }

      if (!res.ok) {
        const errBody = await parseJsonSafe(res);
        const err = apiErrorFromResponse(
          res.status,
          errBody,
          res.headers.get('x-request-id') ?? requestId,
        );

        if (shouldRetryRequest(method, res.status, attempt)) {
          cleanup();
          attempt += 1;
          await sleep(300 * attempt);
          continue;
        }
        cleanup();
        throw err;
      }

      const data = (await parseJsonSafe(res)) as T;
      cleanup();
      return data;
    } catch (error) {
      cleanup();

      if (isApiError(error)) {
        throw error;
      }

      const aborted =
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError');

      if (aborted) {
        if (didTimeout()) throw timeoutError(requestId);
        if (options.signal?.aborted) throw abortedError(requestId);
        throw abortedError(requestId);
      }

      if (!isMutatingMethod(method) && shouldRetryRequest(method, undefined, attempt)) {
        attempt += 1;
        await sleep(300 * attempt);
        continue;
      }

      throw error;
    }
  }
}

export function apiGet<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PUT', body });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>,
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: 'DELETE', body });
}
