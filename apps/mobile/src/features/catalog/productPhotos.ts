/** Merge cover + gallery into a de-duplicated photo list (cover first). */
export function mergeProductPhotos(
  imageUrl?: string | null,
  galleryUrls?: string[] | null,
): string[] {
  const out: string[] = [];
  const add = (raw?: string | null) => {
    const v = raw?.trim();
    if (v && !out.includes(v)) out.push(v);
  };
  add(imageUrl);
  for (const g of galleryUrls ?? []) add(g);
  return out;
}

/** Persist photos as cover + remaining gallery extras. */
export function splitProductPhotos(photos: string[]): {
  imageUrl: string | null;
  galleryUrls: string[];
} {
  const clean = photos.map((p) => p.trim()).filter(Boolean);
  return {
    imageUrl: clean[0] ?? null,
    galleryUrls: clean.slice(1),
  };
}
