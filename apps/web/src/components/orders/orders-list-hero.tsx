'use client';

import { Board, Figure, Ribbon, type BoardTone } from '@maher/ui';
import type { ReactNode } from 'react';

export interface HeroCount {
  key: string;
  label: string;
  count: number;
  tone: BoardTone;
  href?: string;
}

/**
 * List-page hero: title + one line of intent, and the section's pulse — a
 * Ribbon of how the whole splits plus a strip of Figures. Zeros stay muted.
 */
export function OrdersListHero({
  title,
  description,
  counts,
  actions,
  children,
}: {
  title: string;
  description?: string;
  counts?: HeroCount[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const total = counts?.reduce((a, c) => a + c.count, 0) ?? 0;
  return (
    <Board tone="brand" wash="top" as="section">
      <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">
                {title}
              </h1>
              {description ? <p className="mt-1 max-w-[56ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
          {children}
        </div>
        {counts?.length ? (
          <div className="min-w-0">
            {total > 0 ? (
              <Ribbon
                size="sm"
                legend={false}
                segments={counts.filter((c) => c.count > 0).map((c) => ({ key: c.key, label: c.label, value: c.count, tone: c.tone }))}
              />
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
              {counts.map((c) => (
                <Figure key={c.key} size="sm" value={c.count} label={c.label} tone={c.count > 0 ? (c.tone === 'brand' ? undefined : c.tone) : 'neutral'} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Board>
  );
}
