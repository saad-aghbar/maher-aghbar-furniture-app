'use client';

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
}

/** Switch — a 40×24 brand toggle. Label on the start side, control at the end. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, label, description, className, disabled, id: idProp, ...props }, ref) => {
    const auto = useId();
    const id = idProp ?? auto;
    const control = (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('maher-switch', disabled && 'opacity-50', !label && className)}
        {...props}
      >
        <span className="maher-switch__thumb" aria-hidden />
      </button>
    );
    if (!label) return control;
    return (
      <label htmlFor={id} className={cn('flex cursor-pointer items-start justify-between gap-4 py-1', disabled && 'cursor-not-allowed', className)}>
        <span className="min-w-0">
          <span className="block text-[14px] leading-5 text-[var(--maher-text-primary)]">{label}</span>
          {description ? <span className="mt-0.5 block text-[12px] leading-4 text-[var(--maher-text-secondary)]">{description}</span> : null}
        </span>
        {control}
      </label>
    );
  },
);
Switch.displayName = 'Switch';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
}

/** Checkbox — 18px square, brand fill, authored check. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onChange, label, description, indeterminate, className, disabled, id: idProp, ...props }, ref) => {
    const auto = useId();
    const id = idProp ?? auto;
    const box = (
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input
          ref={(node) => {
            if (node) node.indeterminate = Boolean(indeterminate);
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as { current: HTMLInputElement | null }).current = node;
          }}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[5px] border border-[var(--maher-border-strong)] bg-[var(--maher-surface)] transition-colors checked:border-[var(--maher-brand)] checked:bg-[var(--maher-brand)] indeterminate:border-[var(--maher-brand)] indeterminate:bg-[var(--maher-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <svg
          viewBox="0 0 18 18"
          className="pointer-events-none absolute inset-0 h-full w-full text-white opacity-0 transition-opacity peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {indeterminate ? <path d="M5 9h8" /> : <path d="m4.5 9.5 3 3 6-7" />}
        </svg>
      </span>
    );
    if (!label) return box;
    return (
      <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 py-1', disabled && 'cursor-not-allowed', className)}>
        <span className="mt-0.5">{box}</span>
        <span className="min-w-0">
          <span className="block text-[14px] leading-5 text-[var(--maher-text-primary)]">{label}</span>
          {description ? <span className="mt-0.5 block text-[12px] leading-4 text-[var(--maher-text-secondary)]">{description}</span> : null}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
