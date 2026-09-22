/** Mirrors apps/mobile/src/features/pdf/pdfDownloadTypes.ts so both clients ask the API the same way. */

export type PdfLang = 'en' | 'ar' | 'he';
export type PdfTheme = 'white' | 'brown';

export type PdfOptions = {
  lang: PdfLang;
  theme: PdfTheme;
  /** Statement/report range (YYYY-MM-DD). Omitted = full document. */
  from?: string;
  to?: string;
  /** Extra passthrough params (e.g. report `sections`). */
  extra?: Record<string, string | string[] | undefined>;
};

export function pdfQuery(opts: PdfOptions): string {
  const qs = new URLSearchParams({ lang: opts.lang, theme: opts.theme });
  if (opts.from) qs.set('from', opts.from);
  if (opts.to) qs.set('to', opts.to);
  if (opts.extra) {
    for (const [key, value] of Object.entries(opts.extra)) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
      else qs.set(key, value);
    }
  }
  return `?${qs.toString()}`;
}

/** Append a pdf query to a path, honouring an existing `?`. */
export function withPdfQuery(path: string, opts: PdfOptions): string {
  const q = pdfQuery(opts).slice(1);
  return path.includes('?') ? `${path}&${q}` : `${path}?${q}`;
}

/** Pick the API language from the UI locale. */
export function pdfLangFromLocale(locale: string): PdfLang {
  return locale === 'ar' ? 'ar' : locale === 'he' ? 'he' : 'en';
}

/** Filename from a Content-Disposition header, or a fallback. */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}
