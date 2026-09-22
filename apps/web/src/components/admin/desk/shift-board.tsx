'use client';

import { Link } from '@/i18n/navigation';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileValues } from '@/lib/management-summary';
import { Board, Figure, Stamp, toneFromKey, type BoardTone } from '@maher/ui';
import { ArrowRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useDeskCopy } from './desk-shared';
import { pickFocus } from './pick-focus';

const BrandShaderWash = dynamic(
  () => import('@/components/brand-shader-wash').then((mod) => mod.BrandShaderWash),
  { ssr: false },
);

/** Hero: greeting, one focus sentence with its action, and the six today counts. */
export function ShiftBoard({
  data,
  firstName,
}: {
  data: ManagementSummary;
  firstName: string | null;
}) {
  const { t, tileLabel, tileHref, time, date } = useDeskCopy();
  const copy = useMgmtCopy();
  const focus = useMemo(() => pickFocus(data), [data]);
  const today = useMemo(() => tileValues(data.today), [data.today]);

  const focusTitle =
    focus.kind === 'attention'
      ? copy.attentionTitle(focus.card)
      : focus.kind === 'late'
        ? t('deskFocusLate', { count: focus.count })
        : focus.kind === 'blocked'
          ? t('deskFocusBlocked', { count: focus.count })
          : t('deskFocusClear');
  const focusWhy =
    focus.kind === 'attention'
      ? copy.attentionWhy(focus.card)
      : focus.kind === 'late'
        ? t('deskFocusLateWhy')
        : focus.kind === 'blocked'
          ? t('deskFocusBlockedWhy')
          : t('deskFocusClearWhy');
  const focusAction =
    focus.kind === 'attention'
      ? copy.attentionAction(focus.card)
      : focus.kind === 'late'
        ? t('deskFocusLateAction')
        : focus.kind === 'blocked'
          ? t('deskFocusBlockedAction')
          : null;

  return (
    <Board
      tone={focus.tone}
      wash="top"
      as="section"
      aria-labelledby="desk-shift-title"
      className="maher-board--ink"
    >
      {/* Dark gradient field: shader under a veil so the greeting stays legible. */}
      <div className="maher-board__field" aria-hidden>
        <BrandShaderWash variant="hero" />
        <div className="maher-board__field-veil" />
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <p className="text-[13px] leading-5 text-[var(--maher-text-secondary)]">
            {date(new Date(data.generatedAt))} · {t('dashboardUpdated', { time: time(data.generatedAt) })}
          </p>
          <h1
            id="desk-shift-title"
            className="mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[var(--maher-text-primary)] sm:text-[30px] sm:leading-9"
          >
            {firstName ? t('dashboardGreetingNamed', { name: firstName }) : t('dashboardGreeting')}
          </h1>

          <div className="mt-5 flex items-start gap-3">
            <Stamp tone={focus.tone} className="mt-[7px]" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-6 text-[var(--maher-text-primary)]">
                {focusTitle}
              </p>
              <p className="mt-0.5 max-w-[52ch] text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                {focusWhy}
              </p>
              {focus.kind !== 'clear' && focusAction ? (
                <Link
                  href={focus.href}
                  className="maher-press mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--maher-text-primary)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--maher-background)] transition-opacity hover:opacity-90"
                >
                  {focusAction}
                  <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-6 lg:grid-cols-3">
          {today.map((tile) => {
            const tone: BoardTone = tile.count > 0 ? toneFromKey(tile.key, tile.count) : 'neutral';
            return (
              <Link
                key={tile.key}
                href={tileHref(tile)}
                className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]"
              >
                <Figure
                  value={tile.count}
                  size="sm"
                  tone={tile.count > 0 ? (tone === 'brand' ? undefined : tone) : 'neutral'}
                  label={tileLabel(tile.key)}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </Board>
  );
}
