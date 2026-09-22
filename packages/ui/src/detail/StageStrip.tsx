'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';

export type StageState = 'done' | 'current' | 'todo' | 'blocked' | 'skipped';

export interface StageStripStage {
  key: string;
  label: ReactNode;
  state: StageState;
  /** Small line under the label (date, count, station). */
  meta?: ReactNode;
  href?: string;
}

export interface StageStripProps extends HTMLAttributes<HTMLOListElement> {
  stages: StageStripStage[];
  LinkComponent?: AppLinkComponent;
  /** Compact = smaller type, no meta. */
  compact?: boolean;
}

/**
 * StageStrip — one entity's journey across stations: connected nodes,
 * done = brand fill, current = ring, blocked = sienna, todo = hairline.
 */
export function StageStrip({ stages, LinkComponent, compact, className, ...props }: StageStripProps) {
  const Link = LinkComponent ?? 'a';
  return (
    <ol className={cn('m-0 flex list-none p-0', className)} {...props}>
      {stages.map((s) => {
        const body = (
          <>
            <span className="maher-stage-strip__node" aria-hidden>
              {s.state === 'done' ? (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2.5 6.5 2.5 2.5 4.5-5" />
                </svg>
              ) : s.state === 'blocked' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--maher-error)]" />
              ) : s.state === 'current' ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--maher-brand)]" />
              ) : null}
            </span>
            <span
              className={cn(
                'block truncate text-center leading-4',
                compact ? 'text-[11px]' : 'text-[12px]',
                s.state === 'current' ? 'font-semibold text-[var(--maher-text-primary)]' : s.state === 'blocked' ? 'font-medium text-[var(--maher-error)]' : s.state === 'todo' || s.state === 'skipped' ? 'text-[var(--maher-text-tertiary)]' : 'text-[var(--maher-text-secondary)]',
                s.state === 'skipped' && 'line-through',
              )}
            >
              {s.label}
            </span>
            {!compact && s.meta ? <span className="block truncate text-[11px] leading-4 text-[var(--maher-text-tertiary)]" dir="auto">{s.meta}</span> : null}
          </>
        );
        return (
          <li key={s.key} data-state={s.state} className="maher-stage-strip__cell" aria-current={s.state === 'current' ? 'step' : undefined}>
            {s.href ? (
              <Link href={s.href} className="maher-press flex w-full flex-col items-center gap-1.5 rounded-[10px] px-1 py-1 hover:bg-[var(--maher-surface-muted)]">
                {body}
              </Link>
            ) : (
              <span className="flex w-full flex-col items-center gap-1.5 px-1 py-1">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
