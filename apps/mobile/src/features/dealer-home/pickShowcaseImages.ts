/**
 * Pick a shuffled slice of product image URIs for the home showcase.
 * Prefers thumbnail → primary image → first gallery frame.
 */
export function pickShowcaseImages(
  products: Array<{
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    galleryUrls?: string[] | null;
  }>,
  options: {
    min?: number;
    max?: number;
    random?: () => number;
  } = {},
): string[] {
  const min = options.min ?? 5;
  const max = options.max ?? 10;
  const random = options.random ?? Math.random;

  const pool: string[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const candidates = [
      product.thumbnailUrl,
      product.imageUrl,
      ...(product.galleryUrls ?? []),
    ];
    for (const raw of candidates) {
      const uri = raw?.trim();
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      pool.push(uri);
      break; // one image per product for variety
    }
  }

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }

  if (pool.length === 0) return [];
  const span = Math.max(0, max - min);
  const desired = Math.min(pool.length, min + Math.floor(random() * (span + 1)));
  return pool.slice(0, Math.max(1, desired));
}
