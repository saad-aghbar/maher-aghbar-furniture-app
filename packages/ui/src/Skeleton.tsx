import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'maher-shimmer rounded-[var(--maher-radius-md)] bg-[var(--maher-border)]/70',
        className,
      )}
    />
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, columns = 5, className }: TableSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'maher-animate-fade overflow-hidden rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
        className,
      )}
    >
      <div className="flex gap-4 border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-[var(--maher-border)] px-4 py-4 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
