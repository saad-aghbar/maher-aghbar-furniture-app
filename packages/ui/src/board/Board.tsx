import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { Stamp } from './Stamp';
import { toneInk, toneSoft, type BoardTone } from './tone';

/**
 * Board — the single card shell for the web app.
 *
 * Paper surface, hairline border, layered shadow, optional header band.
 * Tone never lives in a side rail: it shows as a stamp before the title,
 * in the figure ink, or as a gradient wash across the header edge.
 */
export interface BoardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  tone?: BoardTone;
  /** `top` washes the header edge with the tone; `full` tints the whole board (critical tickets). */
  wash?: 'none' | 'top' | 'full';
  /**
   * `paper` (default) is the warm surface. `ink` is always dark in both themes and
   * re-scopes text/tone tokens; one per page, hero only. Pair with `Board.Field`.
   */
  variant?: 'paper' | 'ink';
  /** Adds lift on hover and press feedback. Implied when `href` is set. */
  interactive?: boolean;
  href?: string;
  LinkComponent?: AppLinkComponent;
  /** Render element when not a link. Defaults to `section`. */
  as?: 'section' | 'div' | 'article' | 'li';
}

export function Board({
  tone = 'brand',
  wash = 'none',
  variant = 'paper',
  interactive,
  href,
  LinkComponent,
  as = 'section',
  className,
  style,
  children,
  ...props
}: BoardProps) {
  const isInteractive = interactive || Boolean(href);
  const classes = cn(
    'maher-board group relative flex flex-col overflow-hidden rounded-[18px] border border-[var(--maher-border)] bg-[var(--maher-surface)] text-start',
    isInteractive && 'maher-board--interactive',
    wash === 'top' && 'maher-board--wash-top',
    wash === 'full' && 'maher-board--wash-full',
    variant === 'ink' && 'maher-board--ink',
    className,
  );
  const vars = {
    ...style,
    '--board-ink': toneInk(tone),
    '--board-soft': toneSoft(tone),
  } as CSSProperties;

  if (href) {
    const Link = LinkComponent ?? 'a';
    return (
      <Link href={href} className={classes} style={vars} {...(props as object)}>
        {children}
      </Link>
    );
  }
  const Tag = as;
  return (
    <Tag className={classes} style={vars} {...props}>
      {children}
    </Tag>
  );
}

export interface BoardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  /** Small text or chips on the end edge. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Ink stamp before the title. Defaults to on. */
  stamp?: boolean;
  /** Flush header (no muted band) for boards whose body is the hero. */
  plain?: boolean;
}

export function BoardHeader({
  title,
  description,
  meta,
  actions,
  stamp = true,
  plain,
  className,
  ...props
}: BoardHeaderProps) {
  return (
    <div
      className={cn(
        'maher-board__header relative flex items-start justify-between gap-3 px-5 py-3',
        !plain && 'border-b border-[var(--maher-border)] bg-[var(--maher-surface-muted)]',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {stamp ? <Stamp className="mt-[7px]" /> : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[var(--maher-text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {meta || actions ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--maher-text-tertiary)]">
          {meta}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export interface BoardBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** `tight` for ledgers and lists that draw their own row padding. */
  padding?: 'default' | 'tight' | 'none';
  /** Grow to fill the board (elastic column slack). */
  grow?: boolean;
}

export function BoardBody({ padding = 'default', grow, className, ...props }: BoardBodyProps) {
  return (
    <div
      className={cn(
        'relative',
        padding === 'default' && 'px-5 py-4',
        padding === 'tight' && 'px-3 py-2',
        grow && 'flex-1 min-h-0',
        className,
      )}
      {...props}
    />
  );
}

export function BoardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-auto flex items-center justify-between gap-3 border-t border-[var(--maher-border)] px-5 py-2.5 text-[13px] text-[var(--maher-text-secondary)]',
        className,
      )}
      {...props}
    />
  );
}

export interface BoardEmptyProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

/** Teaching empty state. Names what would appear here and offers one next step. */
export function BoardEmpty({ title, description, action, icon, className, ...props }: BoardEmptyProps) {
  return (
    <div
      className={cn('flex flex-col items-start gap-2 px-5 py-6 text-start', className)}
      {...props}
    >
      {icon ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--board-soft,var(--maher-brand-soft))] text-[var(--board-ink,var(--maher-brand))]">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-medium text-[var(--maher-text-primary)]">{title}</p>
      {description ? (
        <p className="max-w-[46ch] text-[13px] leading-5 text-[var(--maher-text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Field slot for an ink board: sits under the content, hosts a shader/gradient,
 * and lays a veil over it so type stays readable. Children = the moving layer.
 */
export function BoardField({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('maher-board__field', className)} aria-hidden {...props}>
      {children}
      <div className="maher-board__field-veil" />
    </div>
  );
}

Board.Header = BoardHeader;
Board.Body = BoardBody;
Board.Footer = BoardFooter;
Board.Empty = BoardEmpty;
Board.Field = BoardField;
