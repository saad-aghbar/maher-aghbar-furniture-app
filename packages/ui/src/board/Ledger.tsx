import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { Stamp } from './Stamp';
import { toneInk, type BoardTone } from './tone';

export interface LedgerProps extends HTMLAttributes<HTMLUListElement> {
  /** Draw hairlines between rows. Default on. */
  divided?: boolean;
}

/** Ledger — a column of label / value rows. Values sit on the end edge, always LTR. */
export function Ledger({ divided = true, className, ...props }: LedgerProps) {
  return (
    <ul
      className={cn('m-0 list-none p-0', divided && 'divide-y divide-[var(--maher-border)]', className)}
      {...props}
    />
  );
}

export interface LedgerRowProps extends Omit<HTMLAttributes<HTMLLIElement>, 'title'> {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: BoardTone;
  /** Show the tone stamp before the label. */
  stamp?: boolean;
  href?: string;
  LinkComponent?: AppLinkComponent;
  icon?: ReactNode;
}

export function LedgerRow({
  label,
  value,
  hint,
  tone,
  stamp,
  href,
  LinkComponent,
  icon,
  className,
  ...props
}: LedgerRowProps) {
  const inkColor = tone && tone !== 'neutral' ? toneInk(tone) : 'var(--maher-text-primary)';
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-secondary)]">
            {icon}
          </span>
        ) : null}
        {stamp ? <Stamp tone={tone ?? 'neutral'} /> : null}
        <span className="min-w-0">
          <span className="block truncate text-sm leading-5 text-[var(--maher-text-primary)]">
            {label}
          </span>
          {hint ? (
            <span className="block text-xs leading-4 text-[var(--maher-text-tertiary)]">{hint}</span>
          ) : null}
        </span>
      </span>
      <span
        className="shrink-0 text-sm font-semibold tabular-nums"
        style={{ color: inkColor } as CSSProperties}
        dir="ltr"
      >
        {value}
      </span>
    </>
  );
  const rowClass = 'flex items-center justify-between gap-3 py-2.5';
  return (
    <li className={cn('m-0', className)} {...props}>
      {href ? (
        (() => {
          const Link = LinkComponent ?? 'a';
          return (
            <Link
              href={href}
              className={cn(rowClass, '-mx-2 rounded-[10px] px-2 transition-colors hover:bg-[var(--maher-surface-muted)]')}
            >
              {inner}
            </Link>
          );
        })()
      ) : (
        <div className={rowClass}>{inner}</div>
      )}
    </li>
  );
}
