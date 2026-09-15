'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { Ltr } from '../Ltr';
import { DEFAULT_DESK_COPY } from './desk-copy';

export interface QrDisplayProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
  printLabel?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a QR code (qrcode package when available) plus a print action.
 * Falls back to a large LTR code if generation fails.
 */
export function QrDisplay({
  value,
  size = 196,
  label,
  className,
  printLabel = DEFAULT_DESK_COPY.printQr,
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
          color: { dark: '#1e1a1b', light: '#00000000' },
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
  }, [code, size]);

  const printable = useMemo(() => {
    if (!svg) return null;
    return `<!doctype html><html><head><title>${escapeXml(code)}</title></head><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif">${svg}<p dir="ltr">${escapeXml(code)}</p></body></html>`;
  }, [code, svg]);

  function print() {
    if (!printable) return;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
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

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--maher-radius-xl)] border border-[var(--maher-border)] bg-[var(--maher-surface)] p-4',
        className,
      )}
    >
      {label ? (
        <p className="text-sm font-medium text-[var(--maher-text-primary)]">{label}</p>
      ) : null}
      {svg ? (
        <div
          className="text-[var(--maher-text-primary)]"
          style={{ width: size, height: size }}
          // SVG from qrcode is generated locally from `value`.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-[var(--maher-radius-lg)] bg-[var(--maher-surface-muted)]"
          style={{ width: size, height: size }}
        >
          <Ltr className="px-3 text-center text-xs">{code || '—'}</Ltr>
        </div>
      )}
      <Ltr className="text-xs text-[var(--maher-text-secondary)]">{code}</Ltr>
      {code ? (
        <Button type="button" size="sm" variant="secondary" onClick={print}>
          {printLabel}
        </Button>
      ) : null}
    </div>
  );
}
