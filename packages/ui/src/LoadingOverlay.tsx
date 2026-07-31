import { cn } from './cn';

export interface LoadingOverlayProps {
  label?: string;
  className?: string;
}

export function LoadingOverlay({ label = 'Loading…', className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center bg-[var(--maher-surface)]/80 backdrop-blur-[1px]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--maher-border)] border-t-[var(--maher-brand)]" />
        <span className="text-sm text-[var(--maher-text-secondary)]">{label}</span>
      </div>
    </div>
  );
}
