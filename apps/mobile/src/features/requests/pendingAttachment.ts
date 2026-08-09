export type AttachmentCategory =
  | 'ORDER_IMAGE'
  | 'HANDWRITTEN_ORDER'
  | 'ORDER_DOCUMENT';

export type AttachmentKind = 'model' | 'gallery' | 'pdf' | 'handwritten';

export type AttachmentStatus =
  | 'ready'
  | 'uploading'
  | 'uploaded'
  | 'error'
  | 'cancelled';

export type PendingAttachment = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  category: AttachmentCategory;
  kind: AttachmentKind;
  status: AttachmentStatus;
  progress: number;
  storageKey?: string;
  documentId?: string;
  errorMessage?: string;
  /** Bytes hint for progress UI */
  sizeBytes?: number;
};

export function newAttachmentId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isImageMime(mime: string) {
  return mime.startsWith('image/');
}

export function isPdfMime(mime: string) {
  return mime === 'application/pdf' || mime.includes('pdf');
}
