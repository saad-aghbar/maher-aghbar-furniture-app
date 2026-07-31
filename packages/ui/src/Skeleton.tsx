import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--maher-radius-md)] bg-[var(--maher-border)]',
        className,
      )}
    />
  );
}
