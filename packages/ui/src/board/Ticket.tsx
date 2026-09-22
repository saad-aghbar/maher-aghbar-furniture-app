import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { Stamp } from './Stamp';
import { toneInk, toneSoft, type BoardTone } from './tone';

export interface TicketProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  why?: ReactNode;
  /** Short action label rendered on the end edge. */
  action?: ReactNode;
  tone?: BoardTone;
  href?: string;
  LinkComponent?: AppLinkComponent;
  /** `paper` sits inside a board; `ink` is the dark exception ticket. */
  ink?: 'paper' | 'ink';
  /** Soft tone wash across the row (critical items). */
  wash?: boolean;
  trailing?: ReactNode;
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/** Ticket — one actionable row: stamp, title, why, and the action on the end edge. */
export function Ticket({
  title,
  why,
  action,
  tone = 'brand',
  href,
  LinkComponent,
  ink = 'paper',
  wash,
  trailing,
  className,
  style,
  children,
  ...props
}: TicketProps) {
  const inkColor = toneInk(tone);
  const dark = ink === 'ink';
  const classes = cn(
    'maher-ticket group/ticket relative flex items-start gap-3 px-4 py-3 text-start',
    dark
      ? 'bg-[var(--maher-text-primary)] text-[var(--maher-background)]'
      : 'text-[var(--maher-text-primary)]',
    href && 'maher-press cursor-pointer',
    className,
  );
  const vars = {
    ...style,
    ...(wash && !dark ? { background: toneSoft(tone) } : null),
  } as CSSProperties;

  const body = (
    <>
      <Stamp tone={tone} className="mt-[7px]" style={dark ? { boxShadow: 'none' } : undefined} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-semibold leading-5',
            dark ? 'text-[var(--maher-background)]' : 'text-[var(--maher-text-primary)]',
          )}
        >
          {title}
        </span>
        {why ? (
          <span
            className={cn(
              'mt-0.5 block text-[13px] leading-5',
              dark ? 'text-[var(--maher-background)] opacity-70' : 'text-[var(--maher-text-secondary)]',
            )}
          >
            {why}
          </span>
        ) : null}
        {children}
      </span>
      <span
        className="flex shrink-0 items-center gap-1.5 self-center text-xs font-semibold"
        style={{ color: dark ? 'var(--maher-background)' : inkColor }}
      >
        {trailing}
        {action ? <span className="hidden sm:inline">{action}</span> : null}
        {href ? <Arrow /> : null}
      </span>
    </>
  );

  if (href) {
    const Link = LinkComponent ?? 'a';
    return (
      <Link href={href} className={classes} style={vars} {...(props as object)}>
        {body}
      </Link>
    );
  }
  return (
    <div className={classes} style={vars} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {body}
    </div>
  );
}
