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
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[14px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)] p-[3px]', className)}
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
        'maher-press relative inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-[11px] px-3.5 text-[13px] font-medium transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/30',
        selected ? 'bg-[var(--maher-text-primary)] text-[var(--maher-background)]' : 'text-[var(--maher-text-secondary)] hover:text-[var(--maher-text-primary)]',
        className,
      )}
    >
      {children}
      {typeof count === 'number' ? (
        <span
          className={cn('rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors duration-200', selected ? 'bg-[var(--maher-background)]/20 text-[var(--maher-background)]' : 'bg-[var(--maher-border)] text-[var(--maher-text-secondary)]')}
          dir="ltr"
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
    <div key={value} role="tabpanel" className={cn('maher-animate-rise pt-4', className)}>
      {children}
    </div>
  );
}
