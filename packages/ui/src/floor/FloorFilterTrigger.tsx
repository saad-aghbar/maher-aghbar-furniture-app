import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export function FloorFilterTrigger({
  active,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm',
        active
          ? 'border-[var(--maher-brand)] bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]'
          : 'border-[var(--maher-border-strong)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)]',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
