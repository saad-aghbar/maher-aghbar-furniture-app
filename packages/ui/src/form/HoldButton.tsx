'use client';

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';

export interface HoldButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
  /** Fires once when the hold completes. */
  onHold: () => void;
  /** Hold duration in ms (default 1200). */
  durationMs?: number;
  children: ReactNode;
  /** Label while holding (default: children). */
  holdingLabel?: ReactNode;
  loading?: boolean;
  /** Ink pill (default) or the sienna danger pill. */
  tone?: 'ink' | 'danger';
  className?: string;
}

/**
 * HoldButton — the mobile "hold to finish" pill on the web. Press and hold; a ring
 * fills around the pill and the action fires when it closes. Space/Enter also hold.
 * Keyboard users can press-and-hold Enter; releasing early cancels.
 */
export function HoldButton({ onHold, durationMs = 1200, children, holdingLabel, loading, tone = 'ink', className, disabled, ...props }: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef<number | null>(null);
  const fired = useRef(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const cancel = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    start.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (start.current == null) return;
      const p = Math.min(1, (now - start.current) / durationMs);
      setProgress(p);
      if (p >= 1) {
        if (!fired.current) {
          fired.current = true;
          onHold();
        }
        cancel();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    },
    [durationMs, onHold, cancel],
  );

  const begin = useCallback(() => {
    if (disabled || loading) return;
    fired.current = false;
    setHolding(true);
    if (reduced) {
      // Reduced motion: a short hold without the ring animation.
      start.current = performance.now() - durationMs * 0.5;
    } else {
      start.current = performance.now();
    }
    raf.current = requestAnimationFrame(tick);
  }, [disabled, loading, reduced, durationMs, tick]);

  useEffect(() => () => cancel(), [cancel]);

  const r = 11;
  const c = 2 * Math.PI * r;
  const inkClass = tone === 'danger' ? 'bg-[var(--maher-error)] text-white' : 'bg-[var(--maher-text-primary)] text-[var(--maher-surface)]';

  return (
    <button
      type="button"
      className={cn(
        'maher-press relative inline-flex h-12 w-full select-none items-center justify-center gap-2.5 overflow-hidden rounded-full px-5 text-[15px] font-semibold shadow-[var(--maher-shadow-board)] transition',
        inkClass,
        (disabled || loading) && 'cursor-not-allowed opacity-50',
        holding && 'scale-[0.99]',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          /* synthetic / already-released pointer */
        }
        begin();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !holding && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') cancel();
      }}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 origin-left bg-white/15 transition-none rtl:origin-right"
        style={{ transform: `scaleX(${progress})` }}
      />
      <svg aria-hidden width="28" height="28" viewBox="0 0 28 28" className="relative shrink-0 -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <circle className="maher-hold__ring" cx="14" cy="14" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
      </svg>
      <span className="relative">{holding && holdingLabel ? holdingLabel : children}</span>
    </button>
  );
}
