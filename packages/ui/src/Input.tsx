import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leadingIcon, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

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
          {leadingIcon ? (
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--maher-text-tertiary)] transition-colors duration-200 peer-focus:text-[var(--maher-brand)] group-focus-within:text-[var(--maher-brand)]">
              {leadingIcon}
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
              leadingIcon ? 'ps-9' : null,
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
