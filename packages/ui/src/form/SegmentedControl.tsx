'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../cn';
import { useSlidingIndicator } from '../nav/use-sliding-indicator';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Stretch to container width. */
  fill?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Segmented control — 2–5 exclusive options with a sliding paper thumb. */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fill,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const { containerRef, rect } = useSlidingIndicator<HTMLDivElement>(value);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const idx = enabled.findIndex((o) => o.value === value);
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const forward = (e.key === 'ArrowRight') !== rtl;
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (idx + (forward ? 1 : -1) + enabled.length) % enabled.length;
    const target = enabled[next];
    if (target) {
      onChange(target.value);
      e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[options.indexOf(target)]?.focus();
    }
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      className={cn('maher-segmented', fill && 'flex w-full', className)}
      onKeyDown={onKeyDown}
      {...aria}
    >
      <span
        aria-hidden
        className="maher-segmented__indicator"
        style={{ left: 0, width: rect?.width ?? 0, transform: `translateX(${rect?.left ?? 0}px)`, opacity: rect ? 1 : 0 }}
      />
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={o.disabled}
            data-active={checked ? 'true' : undefined}
            className={cn('maher-segmented__option maher-press', fill && 'flex-1', size === 'sm' && 'min-h-[28px] px-2.5 text-[12px]', o.disabled && 'opacity-40')}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
