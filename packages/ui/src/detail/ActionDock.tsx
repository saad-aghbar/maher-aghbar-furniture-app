'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export interface ActionDockProps extends HTMLAttributes<HTMLDivElement> {
  /** Small status line at the start (e.g. "3 items · 1,240 ILS"). */
  note?: ReactNode;
  children: ReactNode;
}

/**
 * ActionDock — the mobile sticky CTA on the web. Sticks to the bottom on
 * compact screens with a blurred paper backdrop; sits inline from `md`.
 */
export function ActionDock({ note, children, className, ...props }: ActionDockProps) {
  return (
    <div className={cn('maher-action-dock', className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {note ? <div className="min-w-0 text-[13px] text-[var(--maher-text-secondary)]">{note}</div> : <span />}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 [&>*]:flex-1 md:[&>*]:flex-none">{children}</div>
      </div>
    </div>
  );
}
