'use client';

import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { useSlidingIndicator } from './use-sliding-indicator';

export interface SectionTabItem {
  id: string;
  label: ReactNode;
  /** Link tabs navigate; button tabs call `onChange`. */
  href?: string;
  /** Live count shown as a small stamp chip. Zero renders muted. */
  count?: number | null;
  tone?: BoardTone;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SectionTabsProps {
  items: SectionTabItem[];
  /** Active item id. */
  value: string;
  onChange?: (id: string) => void;
  LinkComponent?: AppLinkComponent;
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible name for the strip. */
  'aria-label'?: string;
  /** Stretch tabs to fill the strip (in-page tabs). */
  fill?: boolean;
}

/**
 * SectionTabs — the one strip for nested sections and in-page tabs.
 * Paper strip, ink-filled active tab, sliding indicator, count stamps.
 * Link mode = navigation (`aria-current`), button mode = tablist.
 */
export function SectionTabs({
  items,
  value,
  onChange,
  LinkComponent,
  size = 'md',
  className,
  fill,
  ...aria
}: SectionTabsProps) {
  const { containerRef, rect, scrollable } = useSlidingIndicator<HTMLDivElement>(value);
  const isNav = items.some((i) => i.href);
  const Link = LinkComponent ?? 'a';

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (isNav || !onChange) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const enabled = items.filter((i) => !i.disabled);
      const idx = enabled.findIndex((i) => i.id === value);
      const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
      const forward = (e.key === 'ArrowRight') !== rtl;
      let next = idx;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = enabled.length - 1;
      else next = (idx + (forward ? 1 : -1) + enabled.length) % enabled.length;
      const target = enabled[next];
      if (target) {
        onChange(target.id);
        e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[items.indexOf(target)]?.focus();
      }
    },
    [isNav, onChange, items, value],
  );

  return (
    <div
      ref={containerRef}
      role={isNav ? 'navigation' : 'tablist'}
      className={cn('maher-section-tabs', size === 'sm' && 'maher-section-tabs--sm', scrollable && 'maher-section-tabs--scrollable', className)}
      onKeyDown={onKeyDown}
      {...aria}
    >
      <span
        aria-hidden
        className="maher-section-tabs__indicator"
        style={{
          width: rect?.width ?? 0,
          transform: `translateX(${rect?.left ?? 0}px)`,
          opacity: rect ? 1 : 0,
          left: 0,
        }}
      />
      {items.map((item) => {
        const active = item.id === value;
        const count = item.count ?? null;
        const inner = (
          <>
            {item.icon ? <span className="flex h-4 w-4 items-center justify-center">{item.icon}</span> : null}
            <span>{item.label}</span>
            {count != null ? (
              <Stamp
                size="sm"
                tone={active ? 'neutral' : count > 0 ? item.tone ?? 'brand' : 'neutral'}
                className="tabular-nums"
                style={active ? { background: 'rgba(245,241,234,0.14)', color: 'var(--maher-background)' } : undefined}
              >
                {count}
              </Stamp>
            ) : null}
          </>
        );
        const cls = cn('maher-section-tabs__tab maher-press', fill && 'flex-1 justify-center', item.disabled && 'pointer-events-none opacity-40');
        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              data-active={active ? 'true' : undefined}
              aria-current={active ? 'page' : undefined}
              className={cls}
              onClick={() => onChange?.(item.id)}
            >
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            data-active={active ? 'true' : undefined}
            className={cls}
            onClick={() => onChange?.(item.id)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
