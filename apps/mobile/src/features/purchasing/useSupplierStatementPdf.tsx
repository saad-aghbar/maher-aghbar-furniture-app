import { useRef, useState } from 'react';
import { StatementRangeSheet } from '@/features/dealers/components/StatementRangeSheet';
import type { StatementPdfRange } from '@/features/account/selectStatement';
import { usePdfDownload } from '@/features/pdf/usePdfDownload';
import { useToast } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';
import { openSupplierStatementPdf } from './api';

export function useSupplierStatementPdf() {
  const { pickPdfOptions, pdfDownloadSheet } = usePdfDownload();
  const { showToast } = useToast();
  const { t } = useLocale();
  const [rangeOpen, setRangeOpen] = useState(false);
  const pendingId = useRef<string | null>(null);
  const pendingRange = useRef<StatementPdfRange | null>(null);

  const start = (supplierId: string) => {
    pendingId.current = supplierId;
    pendingRange.current = null;
    setRangeOpen(true);
  };

  const continuePdf = async (range: StatementPdfRange) => {
    const id = pendingId.current;
    if (!id) return;
    const opts = await pickPdfOptions();
    if (!opts) return;
    try {
      await openSupplierStatementPdf(id, {
        ...opts,
        from: range.from,
        to: range.to,
      });
    } catch {
      showToast({ variant: 'error', message: t('mobile.invoices.pdfFailed') });
    }
  };

  const sheets = (
    <>
      <StatementRangeSheet
        open={rangeOpen}
        onClose={() => {
          pendingRange.current = null;
          setRangeOpen(false);
        }}
        onConfirm={(range) => {
          pendingRange.current = range;
          setRangeOpen(false);
        }}
        onClosed={() => {
          const range = pendingRange.current;
          pendingRange.current = null;
          if (!range) return;
          void continuePdf(range);
        }}
      />
      {pdfDownloadSheet}
    </>
  );

  return { start, sheets };
}
