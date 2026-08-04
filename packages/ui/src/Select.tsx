import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, children, ...props }, ref) => {
    const selectId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-[var(--maher-text-primary)]"
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={cn(
              'peer h-10 w-full cursor-pointer appearance-none rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)]',
              'ps-3 pe-9 text-sm text-[var(--maher-text-primary)]',
              'hover:border-[var(--maher-border-strong)]',
              'focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20',
              'disabled:cursor-not-allowed disabled:bg-[var(--maher-surface-muted)] disabled:opacity-60',
              error && 'border-[var(--maher-error)]',
              className,
            )}
            {...props}
          >
            {placeholder ? <option value="">{placeholder}</option> : null}
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--maher-text-tertiary)] transition-transform duration-300 ease-out peer-focus:rotate-180 peer-focus:text-[var(--maher-brand)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 8 4 4 4-4" />
          </svg>
        </div>
        {hint && !error ? (
          <p className="text-xs text-[var(--maher-text-secondary)]">{hint}</p>
        ) : null}
        {error ? (
          <p role="alert" className="maher-animate-drop text-xs text-[var(--maher-error)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
