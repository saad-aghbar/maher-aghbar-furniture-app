/** Uppercase slug for warehouse codes (SHOWROOM, RAW-MATERIALS). */
export function slugFromWarehouseName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
  return ascii || 'WH';
}

/** Unique code: BASE, then BASE-2, BASE-3, … */
export function nextWarehouseCode(base: string, existing: string[]): string {
  const root = (base.trim().toUpperCase() || 'WH').slice(0, 16);
  const taken = new Set(existing.map((code) => code.trim().toUpperCase()));
  if (!taken.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36).toUpperCase()}`;
}
