'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import { Menu, type MenuItem } from '../overlay/Menu';

export interface ListSortOption<T extends string = string> {
  value: T;
  label: ReactNode;
}

export interface ListToolbarCopy {
  search?: string;
  filters?: string;
  sort?: string;
  clearSearch?: string;
}

export interface ListToolbarProps<S extends string = string> {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Focus the search on `/`. Default on. */
    shortcut?: boolean;
  };
  /** Number of active filters → stamp on the button. */
  filterCount?: number;
  onOpenFilters?: () => void;
  sort?: {
    value: S;
    options: ListSortOption<S>[];
    onChange: (value: S) => void;
    dir?: 'asc' | 'desc';
    onDirChange?: (dir: 'asc' | 'desc') => void;
  };
  /** Chips row rendered under the controls. */
  children?: ReactNode;
  /** End-side actions (Create, Export, Scan). */
  actions?: ReactNode;
  /** Leading content (a SectionTabs or title). */
  leading?: ReactNode;
  copy?: ListToolbarCopy;
  className?: string;
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 5h14M6 10h8M8.5 15h3" />
    </svg>
  );
}

function SortGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4v12m0 0-3-3m3 3 3-3M14 16V4m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

/**
 * ListToolbar — search · chips · filters · sort · actions, in one row that
 * wraps on compact. Search takes `/`; filter button shows an active-count stamp.
 */
export function ListToolbar<S extends string = string>({
  search,
  filterCount = 0,
  onOpenFilters,
  sort,
  children,
  actions,
  leading,
  copy,
  className,
}: ListToolbarProps<S>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!search || search.shortcut === false) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search]);

  const sortItems: MenuItem[] | null = sort
    ? [
        ...sort.options.map((o) => ({
          id: o.value,
          label: o.label,
          onSelect: () => sort.onChange(o.value),
          hint: o.value === sort.value ? '•' : undefined,
        })),
        ...(sort.onDirChange
          ? [
              {
                id: '__dir',
                separator: true,
                label: sort.dir === 'asc' ? '↑ Ascending' : '↓ Descending',
                onSelect: () => sort.onDirChange?.(sort.dir === 'asc' ? 'desc' : 'asc'),
              },
            ]
          : []),
      ]
    : null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        {search ? (
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--maher-text-tertiary)]">
              <SearchGlyph />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? copy?.search ?? 'Search'}
              aria-label={search.placeholder ?? copy?.search ?? 'Search'}
              className="h-10 w-full rounded-[10px] border border-[var(--maher-border)] bg-[var(--maher-surface)] pe-9 ps-9 text-sm text-[var(--maher-text-primary)] placeholder:text-[var(--maher-text-tertiary)] hover:border-[var(--maher-border-strong)] focus:border-[var(--maher-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {search.value ? (
              <button
                type="button"
                aria-label={copy?.clearSearch ?? 'Clear search'}
                onClick={() => {
                  search.onChange('');
                  inputRef.current?.focus();
                }}
                className="maher-press absolute end-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[var(--maher-text-tertiary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            ) : search.shortcut !== false ? (
              <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded-[5px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] px-1.5 text-[11px] text-[var(--maher-text-tertiary)] sm:flex">
                /
              </kbd>
            ) : null}
          </div>
        ) : null}
        {onOpenFilters ? (
          <Button variant="secondary" onClick={onOpenFilters} leadingIcon={<FilterGlyph />} aria-haspopup="dialog" className="relative">
            {copy?.filters ?? 'Filters'}
            {filterCount > 0 ? (
              <Stamp size="sm" tone="brand" className="-me-1">
                {filterCount}
              </Stamp>
            ) : null}
          </Button>
        ) : null}
        {sort && sortItems ? (
          <Menu
            items={sortItems}
            trigger={
              <Button variant="secondary" leadingIcon={<SortGlyph />} aria-label={copy?.sort ?? 'Sort'}>
                <span className="hidden sm:inline">{sort.options.find((o) => o.value === sort.value)?.label ?? copy?.sort ?? 'Sort'}</span>
              </Button>
            }
          />
        ) : null}
        {actions ? <div className="ms-auto flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
