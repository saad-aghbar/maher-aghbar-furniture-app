import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export function FloorBoard({
  children,
  header,
  accent,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  header?: ReactNode;
  accent?: 'brand' | 'warning' | 'error' | 'success';
}) {
  const accentVar =
    accent === 'warning'
      ? 'var(--maher-warning)'
      : accent === 'error'
        ? 'var(--maher-error)'
        : accent === 'success'
          ? 'var(--maher-success)'
          : 'var(--maher-brand)';
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[20px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-sm)]',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[3px] opacity-80"
        style={{ background: accentVar } satisfies CSSProperties}
      />
      {header ? (
        <div className="border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-3 ps-6">
          {header}
        </div>
      ) : null}
      <div className="px-5 py-4 ps-6">{children}</div>
    </section>
  );
}
