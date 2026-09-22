'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { cn } from '../cn';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';

export interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Stamp tone or a custom leading node (thumb, icon well). */
  tone?: BoardTone;
  leading?: ReactNode;
  title: ReactNode;
  /** Second line: dealer, date, why. */
  meta?: ReactNode;
  /** End-side content: figure, status chip, amount (LTR). */
  trailing?: ReactNode;
  href?: string;
  LinkComponent?: AppLinkComponent;
  onClick?: () => void;
  /** Hide the chevron for non-navigating rows. */
  chevron?: boolean;
  selected?: boolean;
}

/**
 * ListRow — the mobile list row on the web: stamp/thumb · title · meta · trailing · chevron.
 * Whole row is the link. Use inside `ListRows` or a `Board.Body padding="none"`.
 */
export function ListRow({ tone, leading, title, meta, trailing, href, LinkComponent, onClick, chevron, selected, className, ...props }: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const showChevron = chevron ?? interactive;
  const content = (
    <>
      {leading ?? (tone ? <Stamp tone={tone} className="shrink-0" /> : null)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium leading-5 text-[var(--maher-text-primary)]">{title}</span>
        {meta ? <span className="mt-0.5 block truncate text-[12px] leading-4 text-[var(--maher-text-secondary)]">{meta}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums text-[var(--maher-text-primary)]">{trailing}</span> : null}
      {showChevron ? (
        <svg viewBox="0 0 20 20" className="maher-list-row__chevron h-4 w-4 shrink-0 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m8 5 5 5-5 5" />
        </svg>
      ) : null}
    </>
  );
  const cls = cn('maher-list-row', interactive && 'maher-list-row--interactive maher-press', selected && 'bg-[var(--maher-brand-soft)]', className);

  if (href) {
    const Link = LinkComponent ?? 'a';
    return (
      <Link href={href} className={cls} onClick={onClick} {...(props as object)}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={cn(cls, 'w-full text-start')} onClick={onClick} {...(props as HTMLAttributes<HTMLButtonElement>)}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} {...(props as HTMLAttributes<HTMLDivElement>)}>
      {content}
    </div>
  );
}

/** Divided stack of rows. */
export function ListRows({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col divide-y divide-[var(--maher-border)]', className)} {...props} />;
}

/** 36px square image/icon well for a row's leading slot. */
export function RowThumb({ src, alt = '', icon, className }: { src?: string | null; alt?: string; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--maher-surface-muted)] text-[var(--maher-text-tertiary)]', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        icon ?? null
      )}
    </span>
  );
}
