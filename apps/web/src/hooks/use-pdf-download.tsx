'use client';

import {
  PdfDownloadDialog,
  filenameFromDisposition,
  pdfLangFromLocale,
  useOptionalToast,
  withPdfQuery,
  type PdfDownloadCopy,
  type PdfOptions,
  type PdfTheme,
} from '@maher/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

export interface OpenPdfRequest {
  /** API path without query, e.g. `/api/v1/invoices/:id/pdf`. */
  path: string;
  /** Shown in the dialog header. */
  documentName?: ReactNode;
  /** Fallback filename when the server sends none. */
  filename?: string;
  /** Show the statement/report range picker. */
  withRange?: boolean;
  defaultRange?: { from: string; to: string };
  /** Sibling CSV route for the same dataset; enables the CSV button. */
  csvPath?: string;
  /** Extra passthrough query params (report sections…). */
  extra?: PdfOptions['extra'];
  defaultTheme?: PdfTheme;
}

const THEME_KEY = 'maher.pdf.theme';

/**
 * Same flow as mobile's `usePdfDownload`: pick language + paper (+ range),
 * then fetch the API PDF with cookies and save it (`<a download>`), or open
 * it in a new tab. Remembers the last paper choice.
 */
export function usePdfDownload() {
  const locale = useLocale();
  const t = useTranslations('common');
  const toast = useOptionalToast();
  const [request, setRequest] = useState<OpenPdfRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const objectUrls = useRef<string[]>([]);

  const copy = useMemo<PdfDownloadCopy>(
    () => ({
      title: t('pdfDialogTitle'),
      language: t('pdfLanguage'),
      theme: t('pdfPaper'),
      white: t('pdfPaperWhite'),
      brown: t('pdfPaperBrown'),
      range: t('pdfRange'),
      rangeHint: t('pdfRangeHint'),
      download: t('download'),
      open: t('pdfOpen'),
      csv: t('pdfCsv'),
      csvHint: t('pdfCsvHint'),
      cancel: t('cancel'),
    }),
    [t],
  );

  const openPdf = useCallback((req: OpenPdfRequest) => setRequest(req), []);
  const close = useCallback(() => setRequest(null), []);

  const run = useCallback(
    async (opts: PdfOptions, mode: 'download' | 'open' | 'csv') => {
      if (!request) return;
      try {
        localStorage.setItem(THEME_KEY, opts.theme);
      } catch {
        /* ignore */
      }
      const url = withPdfQuery(mode === 'csv' && request.csvPath ? request.csvPath : request.path, { ...opts, extra: request.extra });
      setBusy(true);
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`PDF ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.current.push(objectUrl);
        const fallbackName = mode === 'csv' ? (request.filename ?? 'export.pdf').replace(/\.pdf$/i, '.csv') : request.filename ?? 'document.pdf';
        const filename = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName);
        if (mode === 'open') {
          const win = window.open(objectUrl, '_blank', 'noopener');
          if (!win) {
            // Popup blocked → fall back to download.
            triggerDownload(objectUrl, filename);
          }
        } else {
          triggerDownload(objectUrl, filename);
        }
        toast?.success(t('pdfReady'), filename);
        setRequest(null);
      } catch {
        // Last resort: let the browser open the same-origin authed URL directly.
        const win = window.open(url, '_blank', 'noopener');
        if (!win) toast?.error(t('pdfFailed'));
        else setRequest(null);
      } finally {
        setBusy(false);
      }
    },
    [request, t, toast],
  );

  const defaultTheme = useMemo<PdfTheme>(() => {
    if (request?.defaultTheme) return request.defaultTheme;
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored === 'brown' ? 'brown' : 'white';
    } catch {
      return 'white';
    }
  }, [request]);

  const pdfDialog = (
    <PdfDownloadDialog
      open={Boolean(request)}
      onClose={close}
      onConfirm={run}
      busy={busy}
      copy={copy}
      locale={locale}
      defaultLang={pdfLangFromLocale(locale)}
      defaultTheme={defaultTheme}
      withRange={request?.withRange}
      defaultRange={request?.defaultRange}
      documentName={request?.documentName}
      csv={Boolean(request?.csvPath)}
    />
  );

  return { openPdf, pdfDialog, busy };
}

function triggerDownload(objectUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 0);
}
