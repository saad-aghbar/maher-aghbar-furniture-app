/**
 * Admin product manage PDP chrome — one real title (name, else SKU).
 * Does not invent copy; empty Arabic/Hebrew names stay empty.
 */
export function adminProductChromeTitle(opts: {
  locale: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  sku: string;
  fallback: string;
}): string {
  const nameEn = opts.nameEn.trim();
  const nameAr = opts.nameAr.trim();
  const nameHe = (opts.nameHe ?? '').trim();
  const sku = opts.sku.trim();
  if (opts.locale === 'ar') return nameAr || nameEn || sku || opts.fallback;
  if (opts.locale === 'he') return nameHe || nameEn || sku || opts.fallback;
  return nameEn || sku || opts.fallback;
}
