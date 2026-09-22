'use client';

import { Link } from '@/i18n/navigation';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, DayStrip, Figure, Meter, Ticket } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

/** Floor load: last week's completions against next week's dues, plus what's stuck. */
export function ProductionLoadBoard({ data }: { data: ManagementSummary }) {
  const { t, tileLabel, tileHref, dayColumns, locale } = useDeskCopy();
  const copy = useMgmtCopy();
  const series = data.series ?? null;
  const completed = dayColumns(series?.completedLast7, {
    href: tileLink(data.production.tasksCompletedToday.href, data.production.tasksCompletedToday.filter),
  });
  const due = dayColumns(series?.dueNext7, {
    href: tileLink(data.production.dueToday.href, data.production.dueToday.filter),
  });
  const stages = (series?.stageDurations ?? []).slice(0, 4);
  const slowest = stages[0]?.avgMinutes ?? 0;
  const blocked = data.blocked.slice(0, 3);
  const { activeOrders, blocked: blockedTile, dueToday } = data.production;

  return (
    <Board tone={blockedTile.count > 0 ? 'warning' : 'brand'}>
      <Board.Header
        title={t('deskLoadTitle')}
        description={t('mgmtSectionProductionHint')}
      />
      <Board.Body>
        <div className="grid gap-4 sm:grid-cols-3">
          {[activeOrders, dueToday, blockedTile].map((tile) => (
            <Link
              key={tile.key}
              href={tileHref(tile)}
              className="maher-press -m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]"
            >
              <Figure
                value={tile.count}
                size="sm"
                label={tileLabel(tile.key)}
                locale={locale}
                tone={
                  tile.key === 'blocked' && tile.count > 0
                    ? 'warning'
                    : tile.key === 'dueToday' && tile.count > 0
                      ? 'info'
                      : undefined
                }
              />
            </Link>
          ))}
        </div>

        {completed.length || due.length ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {completed.length ? (
              <div>
                <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                  {t('deskLoadCompleted7')}
                </p>
                <DayStrip
                  columns={completed.map((c) => ({ ...c, tone: c.value > 0 ? 'success' : 'neutral' }))}
                  height={48}
                  LinkComponent={Link}
                />
              </div>
            ) : null}
            {due.length ? (
              <div>
                <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                  {t('deskLoadDue7')}
                </p>
                <DayStrip
                  columns={due.map((c) => ({ ...c, tone: c.value > 0 ? 'info' : 'neutral' }))}
                  height={48}
                  LinkComponent={Link}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {stages.length ? (
          <div className="mt-5">
            <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
              {t('deskStageDurations')}
            </p>
            <div className="space-y-2.5">
              {stages.map((s, i) => (
                <Meter
                  key={s.stageCode}
                  size="sm"
                  label={s.stageName}
                  value={s.avgMinutes}
                  max={slowest || 1}
                  tone={i === 0 ? 'warning' : 'brand'}
                  valueLabel={`${s.avgMinutes.toLocaleString('en-JO')} ${t('deskMinutesShort')}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </Board.Body>

      {blocked.length ? (
        <div className="border-t border-[var(--maher-border)]">
          <p className="px-5 pt-3 text-[13px] font-medium leading-5 text-[var(--maher-text-secondary)]">
            {t('mgmtBlockedTitle')}
          </p>
          <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
            {blocked.map((row) => (
              <li key={row.id} className="m-0">
                <Ticket
                  tone="warning"
                  title={row.title}
                  why={copy.blockedWhy(row)}
                  href={tileLink(row.href, row.filter)}
                  LinkComponent={Link}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Board>
  );
}
