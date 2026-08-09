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
  form.append('file', {
    uri: params.uri,
    name: params.fileName,
    type: params.mimeType,
  } as unknown as Blob);

  const token = await getAccessToken();
  const url = `${getApiV1Url()}/uploads?${qs.toString()}`;

  return new Promise<UploadDocumentResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !handlers?.onProgress) return;
      handlers.onProgress(Math.max(0, Math.min(1, event.loaded / event.total)));
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
      reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    const onAbort = () => xhr.abort();
    if (handlers?.signal) {
      if (handlers.signal.aborted) {
        xhr.abort();
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
