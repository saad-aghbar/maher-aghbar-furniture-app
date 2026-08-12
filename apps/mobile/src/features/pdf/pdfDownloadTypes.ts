export type PdfDownloadLang = 'en' | 'ar' | 'he';
export type PdfDownloadTheme = 'white' | 'brown';

export type PdfDownloadOptions = {
  lang: PdfDownloadLang;
  theme: PdfDownloadTheme;
};

export function pdfQuery(opts: PdfDownloadOptions): string {
  const qs = new URLSearchParams({
    lang: opts.lang,
    theme: opts.theme,
  });
  return `?${qs.toString()}`;
}
