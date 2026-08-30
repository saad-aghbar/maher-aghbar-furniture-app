/**
 * Curated raw-material photography (Unsplash) for the factory demo.
 * One URL per SKU — not a random pool. Variants must look like the variant.
 * Decorative — not owned brand assets.
 */
const CROP = 'auto=format&fit=crop&w=800&h=600&q=80';

function photo(id: string): string {
  return `https://images.unsplash.com/${id}?${CROP}`;
}

export const MATERIAL_PHOTO_BY_SKU: Record<string, string> = {
  'MAT-BEECH': photo('photo-1610507998472-1d8b2278c1d1'),
  'MAT-OAK': photo('photo-1589939705384-5185137a7f0f'),
  'MAT-PLY': photo('photo-1595514535415-dae285232c41'),
  'MAT-MDF': photo('photo-1504148455328-c376907d081c'),
  'MAT-WALNUT': photo('photo-1611486212557-88be5ff6f941'),
  'MAT-PINE': photo('photo-1416879595882-3373a0480b5b'),
  'MAT-TEAK': photo('photo-1600566753086-00f18fb6b3ea'),
  'MAT-BIRCH': photo('photo-1441974231531-c6227db76b6e'),
  'MAT-EDGE': photo('photo-1616628188540-3253c50dc95a'),
  'MAT-DOWEL': photo('photo-1504328345606-18bbc8c9d7d1'),
  'MAT-FOAM-HD': photo('photo-1586105251261-72a756497a11'),
  'MAT-FOAM-MD': photo('photo-1493663284031-b7e3aefcae8e'),
  'MAT-FOAM-LD': photo('photo-1583847268964-b28dc8f51f92'),
  'MAT-FOAM-HR': photo('photo-1556228453-efd6c1ff04f6'),
  'MAT-DACRON': photo('photo-1616627988031-f8dd0d5bde3f'),
  'MAT-VEL-SAND': photo('photo-1615874959474-d609969a20ed'),
  'MAT-VEL-NAVY': photo('photo-1578662996442-48f60103fc96'),
  'MAT-LIN-NAT': photo('photo-1528459801416-a9e53bbf4e17'),
  'MAT-LIN-OLV': photo('photo-1598300042247-d088f8ab3a25'),
  'MAT-BOU-CRM': photo('photo-1567538096630-e0c55bd6374c'),
  'MAT-LEA-BRN': photo('photo-1473181488821-2d23949a045a'),
  'MAT-LEA-BLK': photo('photo-1553062407-98eeb64c6a62'),
  'MAT-CHE-GRY': photo('photo-1558618666-fcd25c85cd64'),
  /** Cedar recliner — dark / emerald velvet, deterministic */
  'MAT-ITAL-VEL': photo('photo-1576566588028-4147f3842f27'),
  'MAT-HW-KIT': photo('photo-1597484662317-9bd7bdda2907'),
  'MAT-HW-SCREW': photo('photo-1563299796-17596ed6b017'),
  'MAT-SPRING': photo('photo-1610701596007-11502861dcfa'),
  'MAT-MECH-RECL': photo('photo-1503602642458-232111445657'),
  'MAT-CASTER': photo('photo-1558618047-f4b511aee74e'),
  'MAT-ZIP': photo('photo-1558171813-4c0887536907'),
  'MAT-BUTTON': photo('photo-1617038260897-41a1f14a8ca0'),
  'MAT-THREAD': photo('photo-1452860606245-08befc0ff44b'),
  'MAT-LACQ': photo('photo-1513475382644-a3bbd8a6cba6'),
  'MAT-STAIN-WAL': photo('photo-1562259949-e8e744536fba'),
  'MAT-PRIMER': photo('photo-1589933446682-29ef9d3ea83e'),
  'MAT-WHT-PAINT': photo('photo-1562259929-b4e1fd3aef09'),
  'MAT-GLUE': photo('photo-1581833971358-2c8b550f87b3'),
  'MAT-SPRAY-ADH': photo('photo-1581091226825-a6a2a5aee158'),
  'MAT-FOIL': photo('photo-1602143407151-7111542de6e8'),
  'MAT-CARTON': photo('photo-1513201099705-a9746e1e201f'),
  'MAT-CORNER': photo('photo-1600880292089-90a7e086ee0c'),
  'MAT-STRAP': photo('photo-1586528116311-ad8dd3c8310d'),
};

export const CEDAR_VELVET_SKU = 'MAT-ITAL-VEL';

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
