'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { useCanPortal, useEscape, useMediaQuery, usePresence, useScrollLock } from './use-presence';

export type SheetSide = 'end' | 'bottom' | 'auto';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Stamp tone before the title. */
  tone?: BoardTone;
  children: ReactNode;
  footer?: ReactNode;
  /** `auto` = side panel at ≥900px, bottom sheet below. */
  side?: SheetSide;
  /** Side-panel width class (default `max-w-md`). */
  widthClassName?: string;
  /** Bottom-sheet max height (default 88vh). */
  className?: string;
  closeLabel?: string;
  /** Hide the header entirely (caller renders its own). */
  headless?: boolean;
}

/**
 * Sheet — the web home for every mobile bottom sheet. Side panel on wide
 * screens, bottom sheet on compact. Paper surface, header band, footer rule.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  tone,
  children,
  footer,
  side = 'auto',
  widthClassName = 'max-w-md',
  className,
  closeLabel = 'Close',
  headless,
}: SheetProps) {
  const titleId = useId();
  const canPortal = useCanPortal();
  const { mounted, closing } = usePresence(open, 160);
  const wide = useMediaQuery('(min-width: 900px)');
  const resolved: Exclude<SheetSide, 'auto'> = side === 'auto' ? (wide ? 'end' : 'bottom') : side;
  const panelRef = useRef<HTMLDivElement>(null);

  useScrollLock(mounted);
  useEscape(open, onClose);

  // Move focus into the panel on open, restore on close.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-sheet-close]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? panel).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!mounted || !canPortal) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[1200] flex',
        resolved === 'end' ? 'items-stretch justify-end' : 'items-end justify-center',
      )}
      role="presentation"
    >
      <button
        type="button"
        aria-label={closeLabel}
        data-sheet-close
        className={cn(
          'absolute inset-0 bg-[#1c1917]/45 backdrop-blur-[2px]',
          closing ? 'maher-animate-fade-out' : 'maher-animate-fade',
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'maher-sheet relative z-10 flex flex-col outline-none',
          resolved === 'end'
            ? cn('maher-sheet--end h-full w-full rounded-s-[22px] border-e-0', widthClassName)
            : 'maher-sheet--bottom max-h-[88vh] w-full rounded-t-[22px] border-b-0',
          closing && 'maher-sheet--closing',
          className,
        )}
      >
        {resolved === 'bottom' ? <div className="maher-sheet__grabber" aria-hidden /> : null}
        {!headless ? (
          <div className="flex items-start justify-between gap-3 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3.5">
            <div className="flex min-w-0 items-start gap-2.5">
              {tone ? <Stamp tone={tone} className="mt-[7px]" /> : null}
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-[var(--maher-text-primary)]">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="mt-0.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{description}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              data-sheet-close
              className="maher-press -me-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[var(--maher-text-tertiary)] hover:bg-[var(--maher-surface)] hover:text-[var(--maher-text-primary)]"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
