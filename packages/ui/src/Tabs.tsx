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
    <div role="tablist" className={cn('flex gap-1 border-b border-[var(--maher-border)]', className)}>
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function Tab({ value, children, className }: TabProps) {
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
        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        selected
          ? 'border-[var(--maher-brand)] text-[var(--maher-brand)]'
          : 'border-transparent text-[var(--maher-text-secondary)] hover:text-[var(--maher-text-primary)]',
        className,
      )}
    >
      {children}
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
    <div role="tabpanel" className={cn('pt-4', className)}>
      {children}
    </div>
  );
}
