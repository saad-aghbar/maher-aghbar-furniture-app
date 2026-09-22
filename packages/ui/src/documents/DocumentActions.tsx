'use client';

import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface DocumentAction {
  id: string;
  label: ReactNode;
  onClick: () => void;
  /** `pdf` | `label` | `csv` | `share` picks the glyph. */
  kind?: 'pdf' | 'label' | 'csv' | 'share' | 'print';
  disabled?: boolean;
  busy?: boolean;
}

export interface DocumentActionsProps {
  actions: DocumentAction[];
  className?: string;
  size?: 'sm' | 'md';
}

function Glyph({ kind }: { kind: DocumentAction['kind'] }) {
  const common = { className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (kind) {
    case 'label':
      return (
        <svg viewBox="0 0 20 20" {...common}>
          <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
          <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
          <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
          <path d="M11.5 11.5h2.5v2.5h-2.5zM14.5 14.5H17V17h-2.5z" />
        </svg>
      );
    case 'csv':
      return (
        <svg viewBox="0 0 20 20" {...common}>
          <path d="M4 4h12v12H4zM4 8h12M4 12h12M8 4v12M12 4v12" />
        </svg>
      );
    case 'share':
      return (
        <svg viewBox="0 0 20 20" {...common}>
          <path d="M10 12V3m0 0L7 6m3-3 3 3M4 11v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
        </svg>
      );
    case 'print':
      return (
        <svg viewBox="0 0 20 20" {...common}>
          <path d="M6 7V3h8v4M4 7h12a1 1 0 0 1 1 1v5h-3v3H6v-3H3V8a1 1 0 0 1 1-1zM6 13h8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" {...common}>
          <path d="M12 3H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 17h8a1.5 1.5 0 0 0 1.5-1.5V6.5z" />
          <path d="M12 3v3.5h3.5M7.5 11h5M7.5 13.5h3" />
        </svg>
      );
  }
}

/** DocumentActions — a quiet pill row of document buttons (PDF, label, CSV). */
export function DocumentActions({ actions, className, size = 'md' }: DocumentActionsProps) {
  if (!actions.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={a.disabled || a.busy}
          onClick={a.onClick}
          aria-busy={a.busy || undefined}
          className={cn(
            'maher-press inline-flex items-center gap-1.5 rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] font-medium text-[var(--maher-text-primary)] hover:border-[var(--maher-border-strong)] hover:bg-[var(--maher-surface-muted)] disabled:opacity-50',
            size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]',
          )}
        >
          <span className={cn('text-[var(--maher-brand)]', a.busy && 'animate-pulse')}>
            <Glyph kind={a.kind} />
          </span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
