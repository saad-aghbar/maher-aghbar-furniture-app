'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { AppLinkComponent } from '../AppLinkComponent';
import { Board } from '../board/Board';
import { Stamp } from '../board/Stamp';
import type { BoardTone } from '../board/tone';
import { cn } from '../cn';
import { Ltr } from '../Ltr';

export interface DetailFact {
  label: ReactNode;
  value: ReactNode;
  /** Render value LTR (money, codes, dates). */
  ltr?: boolean;
  tone?: BoardTone;
}

export interface DetailHeroProps {
  /** Back link: label + href (LinkComponent) or onClick. */
  back?: { label: ReactNode; href?: string; onClick?: () => void };
  LinkComponent?: AppLinkComponent;
  /** Document number / code, always LTR. */
  code?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: { label: ReactNode; tone: BoardTone };
  /** Inline ledger: 2–6 facts. */
  facts?: DetailFact[];
  /** Primary action (ink pill) + overflow menu / secondary buttons. */
  primary?: ReactNode;
  actions?: ReactNode;
  /** Image / avatar on the start side. */
  media?: ReactNode;
  /** Wash tone (defaults to the status tone). */
  tone?: BoardTone;
  /** Below the facts, full width (a StageStrip, a Meter). */
  children?: ReactNode;
  className?: string;
}

/**
 * DetailHero — the identity board at the top of every detail page.
 * Back · code · title · status stamp · inline facts · primary ink pill + overflow.
 */
export function DetailHero({ back, LinkComponent, code, title, subtitle, status, facts, primary, actions, media, tone, children, className }: DetailHeroProps) {
  const Link = LinkComponent ?? 'a';
  const resolvedTone = tone ?? status?.tone ?? 'brand';
  return (
    <Board tone={resolvedTone} wash="top" as="section" className={className}>
      <div className="px-5 pb-5 pt-4 sm:px-6">
        {back ? (
          back.href ? (
            <Link href={back.href} onClick={back.onClick} className="maher-press -ms-1.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]">
              <BackGlyph />
              {back.label}
            </Link>
          ) : (
            <button type="button" onClick={back.onClick} className="maher-press -ms-1.5 inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-[13px] text-[var(--maher-text-secondary)] hover:bg-[var(--maher-surface-muted)] hover:text-[var(--maher-text-primary)]">
              <BackGlyph />
              {back.label}
            </button>
          )
        ) : null}

        <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', back && 'mt-2')}>
          <div className="flex min-w-0 items-start gap-4">
            {media ? <div className="shrink-0">{media}</div> : null}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {code ? (
                  <Ltr className="text-[13px] font-medium tabular-nums text-[var(--maher-text-secondary)]">{code}</Ltr>
                ) : null}
                {status ? (
                  <Stamp tone={status.tone} size="sm">
                    {status.label}
                  </Stamp>
                ) : null}
              </div>
              <h1 className="mt-1 text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[28px] sm:leading-9 rtl:tracking-normal">
                {title}
              </h1>
              {subtitle ? <p className="mt-1 max-w-[64ch] text-[14px] leading-5 text-[var(--maher-text-secondary)]">{subtitle}</p> : null}
            </div>
          </div>
          {primary || actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              {actions}
              {primary}
            </div>
          ) : null}
        </div>

        {facts?.length ? (
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
            {facts.map((f, i) => (
              <div key={i} className="min-w-0">
                <dt className="text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{f.label}</dt>
                <dd
                  className={cn('mt-0.5 truncate text-[14px] font-medium leading-5 text-[var(--maher-text-primary)]', f.ltr && 'tabular-nums')}
                  dir={f.ltr ? 'ltr' : undefined}
                  style={f.tone && f.tone !== 'neutral' ? { color: `var(--maher-${f.tone === 'brand' ? 'brand' : f.tone})` } : undefined}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </Board>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5l-5 5 5 5" />
    </svg>
  );
}

/** The dark pill used for a hero's primary action. */
export function InkPill({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'maher-press inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-4 text-[13px] font-semibold text-[var(--maher-background)] transition-opacity hover:opacity-90 disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}
