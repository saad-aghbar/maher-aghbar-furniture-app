'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../cn';
import { Spinner } from '../Spinner';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { Popover } from '../overlay/Popover';
import { Field, controlClassName } from './Field';

export interface ComboboxOption<V extends string = string> {
  value: V;
  label: string;
  /** Second line (code, city, role). */
  description?: string;
  /** Small stamp before the label. */
  tone?: BoardTone;
  icon?: ReactNode;
  disabled?: boolean;
  /** Optional group heading. */
  group?: string;
}

export interface ComboboxProps<V extends string = string> {
  value: V | null;
  onChange: (value: V | null, option: ComboboxOption<V> | null) => void;
  /** Static options, or a loader called with the typed query (debounced). */
  options?: ComboboxOption<V>[];
  loadOptions?: (query: string) => Promise<ComboboxOption<V>[]>;
  /** Label shown when `value` is set but not in the loaded options. */
  selectedLabel?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  placeholder?: string;
  emptyText?: string;
  loadingText?: string;
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Render extra footer row (e.g. "Create new…"). */
  footer?: ReactNode;
  id?: string;
  /** Minimum query length before `loadOptions` fires. */
  minQuery?: number;
  name?: string;
}

const DEBOUNCE_MS = 220;

/**
 * Combobox — typed search over local or async options, paper listbox,
 * roving selection with arrows, Enter selects, Escape closes.
 */
export function Combobox<V extends string = string>({
  value,
  onChange,
  options,
  loadOptions,
  selectedLabel,
  label,
  hint,
  error,
  required,
  placeholder,
  emptyText = 'No matches',
  loadingText = 'Searching…',
  clearable = true,
  clearLabel = 'Clear',
  disabled,
  className,
  footer,
  id,
  minQuery = 0,
  name,
}: ComboboxProps<V>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<ComboboxOption<V>[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const all = useMemo(() => (loadOptions ? remote : options ?? []), [loadOptions, remote, options]);
  const selected = useMemo(() => all.find((o) => o.value === value) ?? null, [all, value]);
  const displayLabel = selected?.label ?? (value != null ? selectedLabel ?? String(value) : '');

  const filtered = useMemo(() => {
    if (loadOptions) return all;
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q));
  }, [all, loadOptions, query]);

  useEffect(() => {
    if (!loadOptions || !open) return undefined;
    if (query.trim().length < minQuery) {
      setRemote([]);
      return undefined;
    }
    const current = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      loadOptions(query.trim())
        .then((rows) => {
          if (requestId.current === current) setRemote(rows);
        })
        .catch(() => {
          if (requestId.current === current) setRemote([]);
        })
        .finally(() => {
          if (requestId.current === current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loadOptions, query, open, minQuery]);

  useEffect(() => {
    setActive(0);
  }, [filtered.length, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  function select(option: ComboboxOption<V>) {
    if (option.disabled) return;
    onChange(option.value, option);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const enabled = filtered.filter((o) => !o.disabled);
      if (!enabled.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + dir + enabled.length) % enabled.length);
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      const enabled = filtered.filter((o) => !o.disabled);
      const target = enabled[active];
      if (target) select(target);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === 'Backspace' && !query && value != null && clearable) {
      onChange(null, null);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string | undefined, ComboboxOption<V>[]>();
    filtered.forEach((o) => {
      const list = map.get(o.group) ?? [];
      list.push(o);
      map.set(o.group, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  let enabledIndex = -1;

  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {(ctx) => (
        <div ref={setAnchor} className="relative">
          {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
          <input
            ref={inputRef}
            id={ctx.id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-invalid={ctx.invalid || undefined}
            aria-describedby={ctx.describedBy}
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={open ? query : displayLabel}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={cn(controlClassName, 'pe-16', selected?.tone && 'ps-8')}
          />
          {selected?.tone && !open ? <Stamp tone={selected.tone} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2" /> : null}
          <span className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {loading ? <Spinner className="h-3.5 w-3.5 text-[var(--maher-text-tertiary)]" /> : null}
            {clearable && value != null && !disabled ? (
              <button
                type="button"
                aria-label={clearLabel}
                tabIndex={-1}
                onClick={() => {
                  onChange(null, null);
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="maher-press flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--maher-text-tertiary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            ) : null}
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className={cn('pointer-events-none h-4 w-4 text-[var(--maher-text-tertiary)] transition-transform duration-200', open && 'rotate-180 text-[var(--maher-brand)]')}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 8 4 4 4-4" />
            </svg>
          </span>

          <Popover open={open} onClose={close} anchor={anchor} matchWidth role="listbox" aria-label={typeof label === 'string' ? label : undefined} className="p-1">
            <div id={listId}>
              {loading && !filtered.length ? (
                <p className="px-3 py-2.5 text-[13px] text-[var(--maher-text-tertiary)]">{loadingText}</p>
              ) : !filtered.length ? (
                <p className="px-3 py-2.5 text-[13px] text-[var(--maher-text-tertiary)]">
                  {loadOptions && query.trim().length < minQuery ? placeholder ?? emptyText : emptyText}
                </p>
              ) : (
                groups.map(([group, rows]) => (
                  <div key={group ?? '__'} role="group" aria-label={group}>
                    {group ? (
                      <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--maher-text-tertiary)] rtl:normal-case rtl:tracking-normal">
                        {group}
                      </p>
                    ) : null}
                    {rows.map((o) => {
                      if (!o.disabled) enabledIndex += 1;
                      const isActive = enabledIndex === active && !o.disabled;
                      const isSelected = o.value === value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={o.disabled}
                          data-active={isActive ? 'true' : undefined}
                          className={cn('maher-menu__item', isSelected && 'font-semibold')}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => select(o)}
                        >
                          {o.tone ? <Stamp tone={o.tone} /> : o.icon ? <span className="flex h-4 w-4 items-center justify-center text-[var(--maher-text-tertiary)]">{o.icon}</span> : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{o.label}</span>
                            {o.description ? <span className="block truncate text-[11px] text-[var(--maher-text-tertiary)]">{o.description}</span> : null}
                          </span>
                          {isSelected ? (
                            <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--maher-brand)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="m5 10.5 3 3 7-7" />
                            </svg>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
              {footer ? <div className="mt-1 border-t border-[var(--maher-border)] pt-1">{footer}</div> : null}
            </div>
          </Popover>
        </div>
      )}
    </Field>
  );
}
