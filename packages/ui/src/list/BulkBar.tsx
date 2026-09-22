'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { useCanPortal } from '../overlay/use-presence';

export interface BulkBarProps {
  count: number;
  /** "{count} selected" — token replaced. */
  label?: string;
  children: ReactNode;
  onClear: () => void;
  clearLabel?: string;
  className?: string;
}

/**
 * BulkBar — floating ink bar that appears when rows are selected.
 * Count on the start, actions in the middle, clear at the end.
 */
export function BulkBar({ count, label = '{count} selected', children, onClear, clearLabel = 'Clear', className }: BulkBarProps) {
  const canPortal = useCanPortal();
  if (count <= 0 || !canPortal) return null;
  return createPortal(
    <div className={cn('maher-bulk-bar', className)} role="toolbar" aria-label={label.replace('{count}', String(count))}>
      <span className="text-[13px] font-semibold tabular-nums">{label.replace('{count}', String(count))}</span>
      <span className="h-5 w-px bg-[rgba(245,241,234,0.18)]" aria-hidden />
      <div className="flex items-center gap-1.5 [&_button]:rounded-full [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[13px] [&_button]:font-medium [&_button]:text-[#f5f1ea] [&_button:hover]:bg-[rgba(245,241,234,0.1)]">
        {children}
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="maher-press flex h-8 w-8 items-center justify-center rounded-full text-[rgba(245,241,234,0.7)] hover:bg-[rgba(245,241,234,0.1)] hover:text-[#f5f1ea]"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

/** "Showing N results · 2 filters" style summary line. */
export function ResultLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[13px] text-[var(--maher-text-secondary)]', className)}>{children}</p>;
}
