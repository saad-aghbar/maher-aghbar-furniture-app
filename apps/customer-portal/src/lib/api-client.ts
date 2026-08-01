import type { ApiError } from '@maher/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: ApiError,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      const json = (await res.json()) as { error?: ApiError } & ApiError;
      body = json.error ?? json;
    } catch {
      /* empty */
    }
    throw new ApiClientError(body?.message ?? `Request failed (${res.status})`, res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      const json = (await res.json()) as { error?: ApiError } & ApiError;
      body = json.error ?? json;
    } catch {
      /* empty */
    }
    throw new ApiClientError(body?.message ?? `Upload failed (${res.status})`, res.status, body);
  }
  return res.json() as Promise<T>;
}

export { API_URL };
