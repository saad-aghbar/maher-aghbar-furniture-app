import { API_PREFIX, getApiBaseUrl } from './config';
import { tokenStorage } from '../storage/tokens';
import { ApiClientError } from './client';

export type UploadResult = {
  document: { id: string; fileName: string; mimeType: string };
  accessToken?: string;
  downloadPath?: string;
};

/**
 * Multipart upload for camera photos and other binary files.
 * Uses FormData so we don't go through the JSON-only `apiFetch` path.
 */
export async function uploadFile(input: {
  uri: string;
  name: string;
  mimeType: string;
  taskId?: string;
  category?: string;
}): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', {
    uri: input.uri,
    name: input.name,
    type: input.mimeType,
  } as unknown as Blob);

  const params = new URLSearchParams();
  if (input.taskId) params.set('taskId', input.taskId);
  if (input.category) params.set('category', input.category);
  const qs = params.toString();

  const headers: Record<string, string> = { Accept: 'application/json' };
  const access = await tokenStorage.getAccessToken();
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(
    `${getApiBaseUrl()}${API_PREFIX}/uploads${qs ? `?${qs}` : ''}`,
    { method: 'POST', headers, body: form },
  );

  if (!res.ok) {
    let body = null;
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      body = json.error ?? json;
    } catch {
      body = null;
    }
    throw new ApiClientError(res.status, body as never);
  }

  return (await res.json()) as UploadResult;
}
