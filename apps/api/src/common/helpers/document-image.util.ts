/** True when a document is an image (mime or extension). */
export function isImageDocument(doc: {
  mimeType?: string | null;
  fileName?: string | null;
}): boolean {
  const mime = (doc.mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = (doc.fileName ?? '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(name);
}

/** First image attachment on an RFQ / order request, if any. */
export function firstImageDocument<T extends {
  id: string;
  mimeType?: string | null;
  fileName?: string | null;
}>(docs: T[] | null | undefined): T | null {
  if (!docs?.length) return null;
  return docs.find((d) => isImageDocument(d)) ?? null;
}
