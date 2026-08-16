import { apiGet, apiPost } from '../client';
import { getApiBaseUrl, getApiV1Url } from '../config';
import { getAccessToken } from '@/storage/tokens';

export type DocumentLinkResponse = {
  downloadPath: string;
  expiresInSeconds: number;
};

export type UploadDocumentResult = {
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    storageKey: string;
    category?: string | null;
  };
  downloadPath?: string;
  expiresInSeconds?: number;
};

export async function getDocumentLink(id: string): Promise<DocumentLinkResponse> {
  return apiGet<DocumentLinkResponse>(
    `/uploads/documents/${encodeURIComponent(id)}/link`,
  );
}

/** Resolve a document signed download to an absolute URL safe for Linking / Image. */
export async function resolveDocumentUrl(id: string): Promise<string> {
  const { downloadPath } = await getDocumentLink(id);
  const base = getApiBaseUrl();
  if (downloadPath.startsWith('http')) return downloadPath;
  return `${base}${downloadPath.startsWith('/') ? downloadPath : `/${downloadPath}`}`;
}

export type UploadFileParams = {
  uri: string;
  fileName: string;
  mimeType: string;
  category: string;
  requestId?: string;
  taskId?: string;
  productionOrderId?: string;
  idempotencyKey?: string;
};

export type UploadProgressHandlers = {
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
};

/** Hermes / RN has no DOMException — use a plain Error with AbortError name. */
function abortError(message = 'Upload cancelled'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

/**
 * Multipart upload with optional progress + abort (XMLHttpRequest).
 */
export async function uploadFile(
  params: UploadFileParams,
  handlers?: UploadProgressHandlers,
): Promise<UploadDocumentResult> {
  const qs = new URLSearchParams({ category: params.category });
  if (params.requestId) qs.set('requestId', params.requestId);
  if (params.taskId) qs.set('taskId', params.taskId);
  if (params.productionOrderId) qs.set('productionOrderId', params.productionOrderId);
  if (params.idempotencyKey) qs.set('idempotencyKey', params.idempotencyKey);

  const form = new FormData();
  const mimeType = params.mimeType.trim().toLowerCase();
  const normalizedMime =
    mimeType === 'image/jpg' || mimeType === 'image/pjpeg'
      ? 'image/jpeg'
      : mimeType === 'image/x-png'
        ? 'image/png'
        : mimeType || 'application/octet-stream';
  form.append('file', {
    uri: params.uri,
    name: params.fileName,
    type: normalizedMime,
  } as unknown as Blob);

  const token = await getAccessToken();
  const url = `${getApiV1Url()}/uploads?${qs.toString()}`;

  return new Promise<UploadDocumentResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!handlers?.onProgress) return;
      if (event.lengthComputable && event.total > 0) {
        handlers.onProgress(Math.max(0, Math.min(1, event.loaded / event.total)));
        return;
      }
      // Some RN runtimes omit total — still advance past the initial 5% marker.
      if (event.loaded > 0) {
        handlers.onProgress(Math.min(0.9, 0.08 + event.loaded / (event.loaded + 750_000)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadDocumentResult);
        } catch {
          reject(new Error('Invalid upload response'));
        }
        return;
      }
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as {
          message?: string;
          error?: { message?: string };
        };
        message = body.message || body.error?.message || message;
      } catch {
        if (xhr.responseText?.trim()) message = xhr.responseText.trim().slice(0, 200);
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onabort = () => reject(abortError());

    const onAbort = () => xhr.abort();
    if (handlers?.signal) {
      if (handlers.signal.aborted) {
        reject(abortError());
        return;
      }
      handlers.signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.send(form);
  });
}

export async function uploadFromUrl(params: {
  url: string;
  fileName?: string;
  category: string;
  requestId?: string;
}): Promise<UploadDocumentResult> {
  const qs = new URLSearchParams({ category: params.category });
  if (params.requestId) qs.set('requestId', params.requestId);
  return apiPost<UploadDocumentResult>(`/uploads/from-url?${qs.toString()}`, {
    url: params.url,
    fileName: params.fileName,
  });
}
