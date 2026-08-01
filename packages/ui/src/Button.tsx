import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'maher-sheen bg-[var(--maher-brand)] text-white shadow-[var(--maher-shadow-sm)] hover:bg-[var(--maher-brand-hover)] hover:shadow-[var(--maher-shadow-md)] focus-visible:ring-[var(--maher-brand)]',
  secondary:
    'bg-[var(--maher-surface)] text-[var(--maher-text-primary)] border border-[var(--maher-border)] shadow-[var(--maher-shadow-sm)] hover:border-[var(--maher-border-strong)] hover:bg-[var(--maher-surface-muted)] hover:shadow-[var(--maher-shadow-md)] focus-visible:ring-[var(--maher-brand)]',
  subtle:
    'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)] hover:bg-[var(--maher-brand-border)] focus-visible:ring-[var(--maher-brand)]',
  ghost:
    'bg-transparent text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)] focus-visible:ring-[var(--maher-brand)]',
  danger:
    'maher-sheen bg-[var(--maher-error)] text-white shadow-[var(--maher-shadow-sm)] hover:brightness-110 hover:shadow-[var(--maher-shadow-md)] focus-visible:ring-[var(--maher-error)]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-9 w-9',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      leadingIcon,
      trailingIcon,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'maher-press group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--maher-radius-md)] font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--maher-surface)]',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner className="maher-animate-pop" />
      ) : leadingIcon ? (
        <span className="inline-flex transition-transform duration-200 ease-out group-hover:-translate-y-px group-hover:scale-110">
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {!loading && trailingIcon ? (
        <span className="inline-flex transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  ),
);

Button.displayName = 'Button';
