/**
 * Curated raw-material photography for the compact demo catalog.
 * Decorative Unsplash URLs — not owned brand assets.
 */
const CROP = 'auto=format&fit=crop&w=800&h=600&q=80';

function photo(id: string): string {
  return `https://images.unsplash.com/${id}?${CROP}`;
}

export const MATERIAL_PHOTO_BY_SKU: Record<string, string> = {
  'MAT-BEECH': photo('photo-1610507998472-1d8b2278c1d1'),
  'MAT-PINE': photo('photo-1416879595882-3373a0480b5b'),
  'MAT-FOAM-HD': photo('photo-1586105251261-72a756497a11'),
  'MAT-FOAM-MD': photo('photo-1493663284031-b7e3aefcae8e'),
  'MAT-VEL-SAND': photo('photo-1615874959474-d609969a20ed'),
  'MAT-VEL-NAVY': photo('photo-1578662996442-48f60103fc96'),
  'MAT-LIN-NAT': photo('photo-1528459801416-a9e53bbf4e17'),
  'MAT-BOU-CRM': photo('photo-1567538096630-e0c55bd6374c'),
  'MAT-HW-KIT': photo('photo-1597484662317-9bd7bdda2907'),
};

/** @deprecated Cedar Italian velvet SKU removed from compact demo; kept for validate migration. */
export const CEDAR_VELVET_SKU = 'MAT-VEL-NAVY';

export function materialPhotoUrl(sku: string): string {
  const url = MATERIAL_PHOTO_BY_SKU[sku];
  if (!url) {
    throw new Error(`No curated demo photo for raw-material SKU ${sku}`);
  }
  return url;
}

export function isHttpImageUrl(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
