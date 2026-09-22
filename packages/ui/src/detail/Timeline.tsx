'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { cn } from '../cn';
import { Ltr } from '../Ltr';

export interface TimelineItem {
  id: string;
  /** Preformatted time or date label (rendered LTR). */
  time?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: BoardTone;
  /** Who did it. */
  actor?: ReactNode;
  /** Extra content under the description (photos, a link). */
  children?: ReactNode;
}

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[];
  /** Group headings (e.g. "Today") — array of `{ label, itemIds }`. */
  groups?: Array<{ label: ReactNode; ids: string[] }>;
  dense?: boolean;
}

/**
 * Timeline — spine list of events with tone stamps. Used for order history,
 * activity, task logs. Scrolls inside its Board when the body is `grow`.
 */
export function Timeline({ items, groups, dense, className, ...props }: TimelineProps) {
  const render = (list: TimelineItem[]) =>
    list.map((item) => (
      <li key={item.id} className={cn('maher-timeline__item', dense ? 'pb-3' : 'pb-4')}>
        <Stamp tone={item.tone ?? 'neutral'} className="maher-timeline__dot" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium leading-5 text-[var(--maher-text-primary)]">{item.title}</p>
            {item.description ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">{item.description}</p> : null}
            {item.actor ? <p className="mt-0.5 text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{item.actor}</p> : null}
            {item.children ? <div className="mt-2">{item.children}</div> : null}
          </div>
          {item.time ? <Ltr className="shrink-0 pt-0.5 text-[12px] tabular-nums text-[var(--maher-text-tertiary)]">{item.time}</Ltr> : null}
        </div>
      </li>
    ));

  if (groups?.length) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {groups.map((g, gi) => {
          const list = g.ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as TimelineItem[];
          if (!list.length) return null;
          return (
            <div key={gi}>
              <p className="mb-2 text-[12px] font-medium text-[var(--maher-text-tertiary)]">{g.label}</p>
              <ol className="m-0 list-none p-0" {...props}>
                {render(list)}
              </ol>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <ol className={cn('m-0 list-none p-0', className)} {...props}>
      {render(items)}
    </ol>
  );
}
