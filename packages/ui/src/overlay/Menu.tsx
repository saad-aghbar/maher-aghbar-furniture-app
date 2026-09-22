'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Placement } from '@floating-ui/react-dom';
import { cn } from '../cn';
import type { AppLinkComponent } from '../AppLinkComponent';
import { Popover } from './Popover';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Renders as a link when set (pass `LinkComponent`). */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** `error` paints the row sienna for destructive actions. */
  tone?: 'default' | 'error';
  /** Small trailing text (shortcut, count). */
  hint?: ReactNode;
  /** Draw a rule above this item. */
  separator?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  /** The trigger. Receives `onClick`, `aria-haspopup`, `aria-expanded`, `ref`. */
  trigger: ReactElement;
  placement?: Placement;
  LinkComponent?: AppLinkComponent;
  className?: string;
  'aria-label'?: string;
}

/**
 * Menu — overflow actions on paper. Roving focus with arrow keys, Enter/Space
 * selects, Escape closes. Use for row actions and hero overflow.
 */
export function Menu({ items, trigger, placement = 'bottom-end', LinkComponent, className, ...aria }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = items.filter((i) => !i.disabled);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    setActive(0);
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[data-menu-item]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!enabled.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = (active + dir + enabled.length) % enabled.length;
      setActive(next);
      listRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]')[next]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : enabled.length - 1;
      setActive(next);
      listRef.current?.querySelectorAll<HTMLElement>('[data-menu-item]')[next]?.focus();
    } else if (e.key === 'Tab') {
      close();
    }
  }

  const triggerEl = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<ButtonHTMLAttributes<HTMLButtonElement> & { ref?: unknown }>, {
        ref: setAnchor,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        onClick: (e: MouseEvent<HTMLButtonElement>) => {
          (trigger.props as ButtonHTMLAttributes<HTMLButtonElement>).onClick?.(e);
          setOpen((v) => !v);
        },
      } as never)
    : trigger;

  let enabledIndex = -1;

  return (
    <>
      {triggerEl}
      <Popover open={open} onClose={close} anchor={anchor} placement={placement} role="menu" className={cn('min-w-[200px]', className)} {...aria}>
        <div ref={listRef} onKeyDown={onKeyDown} className="flex flex-col">
          {items.map((item) => {
            if (!item.disabled) enabledIndex += 1;
            const idx = enabledIndex;
            const content = (
              <>
                {item.icon ? <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--maher-text-tertiary)]">{item.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint ? <span className="text-[11px] text-[var(--maher-text-tertiary)]">{item.hint}</span> : null}
              </>
            );
            const common = {
              'data-menu-item': true,
              'data-active': idx === active && !item.disabled ? 'true' : undefined,
              'data-tone': item.tone === 'error' ? 'error' : undefined,
              role: 'menuitem',
              tabIndex: -1,
              className: 'maher-menu__item',
              onMouseEnter: () => !item.disabled && setActive(idx),
            } as const;
            const node =
              item.href && !item.disabled ? (
                (() => {
                  const Link = LinkComponent ?? 'a';
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      {...common}
                      onClick={() => {
                        item.onSelect?.();
                        close();
                      }}
                    >
                      {content}
                    </Link>
                  );
                })()
              ) : (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  {...common}
                  onClick={() => {
                    item.onSelect?.();
                    close();
                  }}
                >
                  {content}
                </button>
              );
            return item.separator ? (
              <div key={item.id} className="contents">
                <div className="my-1 h-px bg-[var(--maher-border)]" role="separator" />
                {node}
              </div>
            ) : (
              node
            );
          })}
        </div>
      </Popover>
    </>
  );
}
