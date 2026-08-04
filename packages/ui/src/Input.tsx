import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
  /** Magnifying glass at the logical start (left in LTR, right in RTL). */
  withSearchIcon?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leadingIcon, withSearchIcon, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
    const icon = leadingIcon ?? (withSearchIcon ? <SearchGlyph className="h-4 w-4" /> : null);

    return (
      <div className="group flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--maher-text-primary)] transition-colors duration-200 group-focus-within:text-[var(--maher-brand)]"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--maher-text-tertiary)] transition-colors duration-200 group-focus-within:text-[var(--maher-brand)]">
              {icon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'peer h-10 w-full rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
              'px-3 text-sm text-[var(--maher-text-primary)]',
              'placeholder:text-[var(--maher-text-tertiary)] hover:border-[var(--maher-border-strong)]',
              'focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20',
              'disabled:cursor-not-allowed disabled:bg-[var(--maher-surface-muted)] disabled:opacity-60',
              icon ? 'ps-9' : null,
              error && 'border-[var(--maher-error)] focus:ring-[var(--maher-error)]/20',
              className,
            )}
            {...props}
          />
        </div>
        {hint && !error ? (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--maher-text-secondary)]">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="maher-animate-drop text-xs text-[var(--maher-error)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
