import { useCallback, useRef, useState } from 'react';
import {
  type PdfDownloadLang,
  type PdfDownloadOptions,
  type PdfDownloadTheme,
} from './pdfDownloadTypes';
import { PdfDownloadSheet } from './PdfDownloadSheet';

type PendingResult = PdfDownloadOptions | 'cancel';

/**
 * Opens PdfDownloadSheet (language + white/brown). Resolves null if dismissed.
 * Resolves only after the sheet Modal fully unmounts (avoids iOS share/open no-op).
 */
export function usePdfDownload() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((opts: PdfDownloadOptions | null) => void) | null>(
    null,
  );
  const pendingRef = useRef<PendingResult | null>(null);

  const pickPdfOptions = useCallback((): Promise<PdfDownloadOptions | null> => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      pendingRef.current = null;
      setOpen(true);
    });
  }, []);

  const requestClose = useCallback((result: PendingResult) => {
    pendingRef.current = result;
    setOpen(false);
  }, []);

  const pdfDownloadSheet = (
    <PdfDownloadSheet
      open={open}
      onClose={() => requestClose('cancel')}
      onConfirm={(lang: PdfDownloadLang, theme: PdfDownloadTheme) =>
        requestClose({ lang, theme })
      }
      onClosed={() => {
        const r = resolver.current;
        resolver.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending && pending !== 'cancel') {
          r?.(pending);
        } else {
          r?.(null);
        }
      }}
    />
  );

  return { pickPdfOptions, pdfDownloadSheet };
}
