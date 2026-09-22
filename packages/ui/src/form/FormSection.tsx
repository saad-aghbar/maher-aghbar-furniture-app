'use client';

import { useEffect, type HTMLAttributes, type ReactNode } from 'react';
import { Board } from '../board/Board';
import type { BoardTone } from '../board/tone';
import { Stamp } from '../board/Stamp';
import { cn } from '../cn';

export interface FormSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** Section state: `error` when it holds invalid fields, `success` when complete. */
  tone?: BoardTone;
  /** Header-end content (a Switch, a count, a link). */
  meta?: ReactNode;
  /** Columns for the field grid (default 2 on md+). */
  columns?: 1 | 2 | 3;
  children: ReactNode;
}

/** FormSection — a Board with a header band and a responsive field grid. */
export function FormSection({ title, description, tone = 'neutral', meta, columns = 2, children, className, ...props }: FormSectionProps) {
  return (
    <Board tone={tone} wash={tone === 'error' ? 'top' : 'none'} className={className} {...props}>
      <Board.Header title={title} description={description} meta={meta} stamp={tone !== 'neutral'} />
      <Board.Body
        className={cn(
          'grid gap-x-5 gap-y-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 md:grid-cols-2',
          columns === 3 && 'grid-cols-1 md:grid-cols-3',
        )}
      >
        {children}
      </Board.Body>
    </Board>
  );
}

export interface FormFooterProps {
  /** Save / primary control. */
  primary: ReactNode;
  /** Cancel / secondary controls. */
  secondary?: ReactNode;
  /** Shows the unsaved dot + label and arms `beforeunload`. */
  dirty?: boolean;
  dirtyLabel?: string;
  /** Inline error line. */
  error?: ReactNode;
  className?: string;
}

/**
 * FormFooter — sticky save bar. Paper, hairline top, unsaved-changes stamp,
 * warns on tab close while dirty. Pair with `useUnsavedChangesGuard` for routing.
 */
export function FormFooter({ primary, secondary, dirty, dirtyLabel = 'Unsaved changes', error, className }: FormFooterProps) {
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--maher-border)] bg-[color:color-mix(in_oklab,var(--maher-surface)_92%,transparent)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-md md:mx-0 md:rounded-[18px] md:border md:px-5',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--maher-text-secondary)]">
        {dirty ? (
          <>
            <Stamp tone="warning" />
            <span>{dirtyLabel}</span>
          </>
        ) : null}
        {error ? <span className="text-[var(--maher-error)]">{error}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {secondary}
        {primary}
      </div>
    </div>
  );
}
