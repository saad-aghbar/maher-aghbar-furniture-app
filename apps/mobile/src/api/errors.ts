export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  code: string;
  message: string;
  fieldErrors?: ApiFieldErrors;
  requestId?: string | null;
  runId?: string;
  reasons?: unknown;
  conflicts?: unknown;
  suggestedWindow?: unknown;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: ApiFieldErrors;
  readonly requestId: string | null;
  readonly runId: string | null;
  readonly isOffline: boolean;
  readonly isAborted: boolean;
  readonly isTimeout: boolean;
  /** Extra payload from the API error body (conflicts, suggestedWindow, reasons, …). */
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      fieldErrors?: ApiFieldErrors;
      requestId?: string | null;
      runId?: string | null;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.requestId = options.requestId ?? null;
    this.runId = options.runId ?? null;
    this.details = options.details ?? {};
    this.isOffline = options.code === 'OFFLINE';
    this.isAborted = options.code === 'ABORTED';
    this.isTimeout = options.code === 'TIMEOUT';
  }
}

export function normalizeStatusCode(status: number, bodyCode?: string): string {
  if (bodyCode && status !== 400 && status !== 422) {
    // Prefer domain codes for 401/409/etc. when present
    if (status === 401 || status === 409 || status >= 500) {
      return bodyCode;
    }
  }

  switch (status) {
    case 401:
      return bodyCode ?? 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return bodyCode ?? 'CONFLICT';
    case 400:
    case 422:
      return bodyCode ?? 'VALIDATION_ERROR';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      if (status >= 500) return bodyCode ?? 'INTERNAL_ERROR';
      return bodyCode ?? 'UNKNOWN';
  }
}

export function apiErrorFromResponse(
  status: number,
  body: unknown,
  fallbackRequestId?: string | null,
): ApiError {
  const parsed = extractErrorBody(body);
  const code = normalizeStatusCode(status, parsed?.code);
  const details: Record<string, unknown> = {};
  if (parsed) {
    for (const key of ['conflicts', 'suggestedWindow', 'reasons', 'overrideRequires'] as const) {
      if (parsed[key] != null) details[key] = parsed[key];
    }
  }
  return new ApiError(parsed?.message ?? `Request failed (${status})`, {
    status,
    code,
    fieldErrors: normalizeFieldErrors(parsed?.fieldErrors),
    requestId: parsed?.requestId ?? fallbackRequestId ?? null,
    runId: typeof parsed?.runId === 'string' ? parsed.runId : null,
    details,
  });
}

export function extractErrorBody(body: unknown): ApiErrorBody | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === 'object') {
    return nested as ApiErrorBody;
  }
  if (typeof record.code === 'string' && typeof record.message === 'string') {
    return record as unknown as ApiErrorBody;
  }
  return undefined;
}

function normalizeFieldErrors(raw: unknown): ApiFieldErrors {
  if (!raw || typeof raw !== 'object') return {};
  if (Array.isArray(raw)) return { _: raw.map(String) };
  const out: ApiFieldErrors = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value.map(String);
    else if (value != null) out[key] = [String(value)];
  }
  return out;
}

export function offlineError(): ApiError {
  return new ApiError('No network connection', {
    status: 0,
    code: 'OFFLINE',
  });
}

export function timeoutError(requestId?: string | null): ApiError {
  return new ApiError('Request timed out', {
    status: 0,
    code: 'TIMEOUT',
    requestId,
  });
}

export function abortedError(requestId?: string | null): ApiError {
  return new ApiError('Request cancelled', {
    status: 0,
    code: 'ABORTED',
    requestId,
  });
}

export function assertOnline(isConnected: boolean | null): void {
  if (isConnected === false) {
    throw offlineError();
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
