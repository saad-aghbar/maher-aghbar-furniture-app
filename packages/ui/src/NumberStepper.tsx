'use client';

import { useId } from 'react';
import { cn } from './cn';

export type NumberStepperProps = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  hint?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

function parse(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  error,
  hint,
  disabled,
  'aria-label': ariaLabel,
}: NumberStepperProps) {
  const id = useId();
  const n = parse(value);

  const bump = (delta: number) => {
    const current = n ?? 0;
    let next = current + delta;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(String(next));
  };

  return (
    <div className="group flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="text-sm font-medium text-[var(--maher-text-primary)]"
        >
          {label}
        </label>
      ) : null}
      <div className="flex h-10 items-stretch overflow-hidden rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface)] focus-within:border-[var(--maher-brand)] focus-within:ring-2 focus-within:ring-[var(--maher-brand)]/20">
        <button
          type="button"
          aria-label={`${ariaLabel ?? label ?? 'value'} minus`}
          disabled={disabled || (n != null && n <= min)}
          onClick={() => bump(-step)}
          className="w-10 text-lg text-[var(--maher-text-secondary)] disabled:opacity-40"
        >
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              bump(step);
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              bump(-step);
            }
          }}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-center text-sm text-[var(--maher-text-primary)] outline-none',
            error && 'text-[var(--maher-error)]',
          )}
        />
        <button
          type="button"
          aria-label={`${ariaLabel ?? label ?? 'value'} plus`}
          disabled={disabled || (max != null && n != null && n >= max)}
          onClick={() => bump(step)}
          className="w-10 text-lg text-[var(--maher-text-secondary)] disabled:opacity-40"
        >
          +
        </button>
      </div>
      {hint && !error ? (
        <p className="text-xs text-[var(--maher-text-secondary)]">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-[var(--maher-error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
