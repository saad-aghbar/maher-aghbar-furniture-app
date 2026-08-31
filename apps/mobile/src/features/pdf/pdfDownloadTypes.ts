export type PdfDownloadLang = 'en' | 'ar' | 'he';
export type PdfDownloadTheme = 'white' | 'brown';

export type PdfDownloadOptions = {
  lang: PdfDownloadLang;
  theme: PdfDownloadTheme;
  /** Statement PDF range (YYYY-MM-DD). Omitted = full statement. */
  from?: string;
  to?: string;
};

export function pdfQuery(opts: PdfDownloadOptions): string {
  const qs = new URLSearchParams({
    lang: opts.lang,
    theme: opts.theme,
  });
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  return `?${qs.toString()}`;
}
