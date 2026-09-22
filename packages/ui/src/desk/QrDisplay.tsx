'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BRAND_LOGO_MARK_LIGHT_URI } from '../brand-logo-data';
import { Button } from '../Button';
import { cn } from '../cn';
import { Ltr } from '../Ltr';
import { DEFAULT_DESK_COPY } from './desk-copy';

export interface QrDisplayProps {
  value: string;
  size?: number;
  label?: string;
  /** Second line under the code (item name, bin, stage). */
  caption?: ReactNode;
  className?: string;
  /** Legacy browser print of the SVG. Prefer `onPrintLabel` (API PDF). */
  printLabel?: string;
  /** Opens the label PDF flow (API `qr-label`). Replaces the browser print when set. */
  onPrintLabel?: () => void;
  /** Hide the centered brand mark (dense codes). */
  plain?: boolean;
  /** Hide the print button. */
  hidePrint?: boolean;
  /** Extra actions under the code. */
  actions?: ReactNode;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * QrDisplay — paper board with a high-ECL QR and the brand sofa mark in the
 * centre (mobile BrandQrCode parity). Plain scan codes only; never URLs.
 */
export function QrDisplay({
  value,
  size = 196,
  label,
  caption,
  className,
  printLabel = DEFAULT_DESK_COPY.printQr,
  onPrintLabel,
  plain,
  hidePrint,
  actions,
}: QrDisplayProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const code = value.trim();

  useEffect(() => {
    if (!code) {
      setSvg(null);
      return undefined;
    }
    let cancelled = false;
    void import('qrcode')
      .then((mod) =>
        mod.toString(code, {
          type: 'svg',
          margin: 1,
          width: size,
          errorCorrectionLevel: plain ? 'M' : 'H',
          color: { dark: '#1a1a1a', light: '#00000000' },
        }),
      )
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, size, plain]);

  const printable = useMemo(() => {
    if (!svg) return null;
    return `<!doctype html><html><head><title>${escapeXml(code)}</title></head><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif">${svg}<p dir="ltr">${escapeXml(code)}</p></body></html>`;
  }, [code, svg]);

  function browserPrint() {
    if (!printable) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(printable);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }

  const markSize = Math.round(size * 0.22);

  return (
    <div className={cn('maher-board flex flex-col items-center gap-3 rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4', className)}>
      {label ? <p className="text-[13px] font-medium text-[var(--maher-text-primary)]">{label}</p> : null}
      <div className="relative rounded-[14px] bg-white p-2.5 shadow-[inset_0_0_0_1px_rgba(30,26,27,0.06)]">
        {svg ? (
          <div style={{ width: size, height: size }} className="[&_svg]:block [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex items-center justify-center rounded-[10px] bg-[var(--maher-surface-muted)]" style={{ width: size, height: size }}>
            <Ltr className="px-3 text-center text-xs text-[var(--maher-text-secondary)]">{code || '—'}</Ltr>
          </div>
        )}
        {svg && !plain ? (
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[8px] bg-white"
            style={{ width: markSize + 10, height: markSize + 10 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_LOGO_MARK_LIGHT_URI} alt="" style={{ width: markSize, height: markSize }} className="object-contain" />
          </span>
        ) : null}
      </div>
      <Ltr className="text-[13px] font-medium text-[var(--maher-text-primary)]">{code}</Ltr>
      {caption ? <p className="-mt-2 text-center text-[12px] text-[var(--maher-text-secondary)]">{caption}</p> : null}
      {code && (!hidePrint || actions) ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!hidePrint ? (
            <Button type="button" size="sm" variant="secondary" onClick={onPrintLabel ?? browserPrint}>
              {printLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
