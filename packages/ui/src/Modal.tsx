'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { cn } from './cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const titleId = useId();
  // Keep the dialog mounted briefly after `open` flips so the exit animation can play.
  const [mounted, setMounted] = useState(open);
  const closing = mounted && !open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 bg-[#1c1917]/45 backdrop-blur-[2px]',
          closing ? 'maher-animate-fade-out' : 'maher-animate-fade',
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          closing ? 'maher-animate-pop-out' : 'maher-animate-pop',
          'relative z-10 flex max-h-[90vh] w-full flex-col rounded-[var(--maher-radius-xl)]',
          'border border-[var(--maher-border)] bg-[var(--maher-surface)] shadow-[var(--maher-shadow-lg)]',
          // A caller-supplied max-width wins over the size preset (cn does not merge conflicts)
          !className?.includes('max-w-') && sizeClasses[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--maher-border)] px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h2 id={titleId} className="text-lg font-semibold text-[var(--maher-text-primary)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-[var(--maher-text-secondary)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="maher-press -me-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--maher-radius-md)] text-[var(--maher-text-tertiary)] hover:rotate-90 hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
