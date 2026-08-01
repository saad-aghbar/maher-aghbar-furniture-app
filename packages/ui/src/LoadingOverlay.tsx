import { cn } from './cn';
import { Spinner } from './Spinner';

export interface LoadingOverlayProps {
  label?: string;
  className?: string;
}

export function LoadingOverlay({ label = 'Loading…', className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'maher-animate-fade absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-[var(--maher-surface)]/75 backdrop-blur-[2px]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="maher-animate-pop flex flex-col items-center gap-3">
        <Spinner className="h-7 w-7 text-[var(--maher-brand)]" />
        <span className="text-sm text-[var(--maher-text-secondary)]">{label}</span>
      </div>
    </div>
  );
}
