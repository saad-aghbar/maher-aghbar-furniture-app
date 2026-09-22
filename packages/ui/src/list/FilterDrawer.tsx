'use client';

import type { ReactNode } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import { Sheet } from '../overlay/Sheet';

export interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onApply: () => void;
  onClear?: () => void;
  applyLabel?: string;
  clearLabel?: string;
  closeLabel?: string;
  /** Number of filters in the draft (shown on Apply). */
  count?: number;
}

/**
 * FilterDrawer — the mobile filter sheet on the web. Side panel ≥900px,
 * bottom sheet below. Sections are ledger-like groups; footer Apply/Clear.
 */
export function FilterDrawer({
  open,
  onClose,
  title,
  description,
  children,
  onApply,
  onClear,
  applyLabel = 'Apply',
  clearLabel = 'Clear',
  closeLabel,
  count,
}: FilterDrawerProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel={closeLabel}
      footer={
        <>
          {onClear ? (
            <Button variant="ghost" onClick={onClear} className="me-auto">
              {clearLabel}
            </Button>
          ) : null}
          <Button
            onClick={() => {
              onApply();
              onClose();
            }}
          >
            {applyLabel}
            {count ? (
              <Stamp size="sm" tone="neutral" className="-me-1" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                {count}
              </Stamp>
            ) : null}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">{children}</div>
    </Sheet>
  );
}

export interface FilterGroupProps {
  title: ReactNode;
  /** Active summary at the end of the header (e.g. "2 selected"). */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  /** `chips` wraps children in a chip row; `stack` stacks them. */
  layout?: 'chips' | 'stack';
}

/** A titled group inside FilterDrawer. No rails — a hairline and a quiet heading. */
export function FilterGroup({ title, meta, children, className, layout = 'chips' }: FilterGroupProps) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-[var(--maher-border)] pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{title}</h3>
        {meta ? <span className="text-[12px] text-[var(--maher-text-tertiary)]">{meta}</span> : null}
      </header>
      <div className={cn(layout === 'chips' ? 'flex flex-wrap gap-2' : 'flex flex-col gap-3')}>{children}</div>
    </section>
  );
}
