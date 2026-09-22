import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { toneInk, type BoardTone } from './tone';

export interface DayStripColumn {
  key: string;
  label: ReactNode;
  value: number;
  /** Second value drawn as a thin bar beside the first (e.g. due vs completed). */
  compare?: number;
  today?: boolean;
  tone?: BoardTone;
  href?: string;
}

export interface DayStripProps extends HTMLAttributes<HTMLDivElement> {
  columns: DayStripColumn[];
  compareTone?: BoardTone;
  /** Bar area height in px. */
  height?: number;
  LinkComponent?: AppLinkComponent;
}

/** DayStrip — a week of columns: count over bar over label. Today is inked. */
export function DayStrip({
  columns,
  compareTone = 'neutral',
  height = 56,
  LinkComponent,
  className,
  ...props
}: DayStripProps) {
  const max = Math.max(1, ...columns.map((c) => Math.max(c.value, c.compare ?? 0)));
  return (
    <div className={cn('grid gap-1.5', className)} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }} {...props}>
      {columns.map((col, i) => {
        const ink = toneInk(col.tone ?? (col.today ? 'brand' : 'neutral'));
        const primaryPct = Math.round((col.value / max) * 100);
        const comparePct = col.compare != null ? Math.round((col.compare / max) * 100) : null;
        const body = (
          <>
            <span
              className={cn(
                'text-xs font-semibold tabular-nums leading-4',
                col.value > 0 ? 'text-[var(--maher-text-primary)]' : 'text-[var(--maher-text-tertiary)]',
              )}
              dir="ltr"
            >
              {col.value}
            </span>
            <span className="flex w-full items-end justify-center gap-[3px]" style={{ height }}>
              <span
                className="maher-daystrip-bar w-full max-w-[22px] rounded-t-[4px] rounded-b-[2px]"
                style={
                  {
                    height: `${Math.max(primaryPct, col.value > 0 ? 8 : 3)}%`,
                    background: col.value > 0 ? ink : 'var(--maher-border)',
                    animationDelay: `${i * 40}ms`,
                  } as CSSProperties
                }
              />
              {comparePct != null ? (
                <span
                  className="maher-daystrip-bar w-[5px] rounded-t-[3px] rounded-b-[1px]"
                  style={
                    {
                      height: `${Math.max(comparePct, 3)}%`,
                      background: toneInk(compareTone),
                      opacity: 0.55,
                      animationDelay: `${i * 40 + 20}ms`,
                    } as CSSProperties
                  }
                />
              ) : null}
            </span>
            <span
              className={cn(
                'text-[11px] leading-4',
                col.today
                  ? 'font-semibold text-[var(--maher-text-primary)]'
                  : 'text-[var(--maher-text-tertiary)]',
              )}
            >
              {col.label}
            </span>
          </>
        );
        const cellClass = cn(
          'flex flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 text-center',
          col.today && 'bg-[var(--maher-surface-muted)]',
          col.href && 'maher-press transition-colors hover:bg-[var(--maher-surface-muted)]',
        );
        if (col.href) {
          const Link = LinkComponent ?? 'a';
          return (
            <Link key={col.key} href={col.href} className={cellClass}>
              {body}
            </Link>
          );
        }
        return (
          <div key={col.key} className={cellClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
