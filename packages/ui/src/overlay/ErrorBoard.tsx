'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { useUiCopy } from '../UiCopy';
import { Board } from '../board/Board';
import { Skeleton } from '../Skeleton';

export interface ErrorBoardProps {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

/** Error as a board: error stamp, plain words, one retry. Replaces ErrorState inside pages. */
export function ErrorBoard({ title, description, onRetry, retryLabel, action, className }: ErrorBoardProps) {
  const copy = useUiCopy();
  return (
    <Board tone="error" wash="top" className={className} role="alert">
      <Board.Header title={title} description={description} />
      {onRetry || action ? (
        <Board.Footer>
          <span />
          <span className="flex items-center gap-2">
            {onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {retryLabel ?? copy.retry}
              </Button>
            ) : null}
            {action}
          </span>
        </Board.Footer>
      ) : null}
    </Board>
  );
}

export interface BoardSkeletonProps {
  /** Body rows to shimmer. */
  rows?: number;
  /** Render a header band. */
  header?: boolean;
  className?: string;
  /** Height class for the body when `rows` is 0 (e.g. charts). */
  bodyClassName?: string;
}

/** Skeleton shaped like a Board so the layout does not jump on load. */
export function BoardSkeleton({ rows = 3, header = true, className, bodyClassName }: BoardSkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'maher-board maher-animate-fade overflow-hidden rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
        className,
      )}
    >
      {header ? (
        <div className="flex items-center gap-2.5 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3.5">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      ) : null}
      <div className={cn('space-y-3 px-5 py-4', bodyClassName)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton shaped like a DataBoard (header + N rows). */
export function DataBoardSkeleton({ rows = 6, columns = 5, className, flush }: { rows?: number; columns?: number; className?: string; flush?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'maher-animate-fade overflow-hidden',
        !flush && 'maher-board rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
        className,
      )}
    >
      <div className="flex gap-4 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-[var(--maher-border)] px-4 py-4 last:border-0">
          <Skeleton className="h-2 w-2 rounded-full" />
          {Array.from({ length: columns - 1 }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
