export type LineVisualIdentityInput = {
  primaryImageDocumentId?: string | null;
  productImageRef?: string | null;
  variantImageUrl?: string | null;
  productImageUrl?: string | null;
  photoUrls?: Array<string | null | undefined> | null;
  resolveDocumentUrl?: (id: string) => string | null;
};

/** Resolve a line's visual identity without inventing a catalog product for custom. */
export function lineVisualIdentity(input: LineVisualIdentityInput): string | null {
  const docId = input.primaryImageDocumentId?.trim();
  if (docId && input.resolveDocumentUrl) {
    const fromDoc = input.resolveDocumentUrl(docId)?.trim();
    if (fromDoc) return fromDoc;
  }
  const ref = input.productImageRef?.trim();
  if (ref) return ref;
  const photo = (input.photoUrls ?? []).map((u) => u?.trim()).find(Boolean);
  if (photo) return photo;
  const variant = input.variantImageUrl?.trim();
  if (variant) return variant;
  const product = input.productImageUrl?.trim();
  if (product) return product;
  return null;
}

type OrderSpecVisual = {
  productImageRef?: string | null;
  primaryImageDocumentId?: string | null;
};

/** Prefer the frozen commercial snapshot, then live catalog images. */
export function lineVisualFromOrderSpec(
  orderSpec: unknown,
  extras: Omit<LineVisualIdentityInput, 'primaryImageDocumentId' | 'productImageRef'> = {},
): string | null {
  const spec =
    orderSpec && typeof orderSpec === 'object' && !Array.isArray(orderSpec)
      ? (orderSpec as OrderSpecVisual)
      : null;
  return lineVisualIdentity({
    ...extras,
    primaryImageDocumentId: spec?.primaryImageDocumentId,
    productImageRef: spec?.productImageRef,
  });
}
