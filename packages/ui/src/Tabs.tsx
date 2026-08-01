'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from './cn';

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--maher-radius-lg)] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  count?: number;
  className?: string;
}

export function Tab({ value, children, count, className }: TabProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used within Tabs');

  const selected = ctx.active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => ctx.setActive(value)}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-[var(--maher-radius-md)] px-3.5 py-1.5 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/30',
        selected
          ? 'bg-[var(--maher-surface)] text-[var(--maher-text-primary)] shadow-[var(--maher-shadow-sm)]'
          : 'text-[var(--maher-text-secondary)] hover:text-[var(--maher-text-primary)]',
        className,
      )}
    >
      {children}
      {typeof count === 'number' ? (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
            selected
              ? 'bg-[var(--maher-brand-soft)] text-[var(--maher-brand)]'
              : 'bg-[var(--maher-border)] text-[var(--maher-text-secondary)]',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabPanel must be used within Tabs');

  if (ctx.active !== value) return null;

  return (
    <div role="tabpanel" className={cn('maher-animate-fade pt-4', className)}>
      {children}
    </div>
  );
}
