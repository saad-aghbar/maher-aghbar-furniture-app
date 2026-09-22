'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, DayStrip, Meter, type BoardTone } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

/** The dock ladder: finished waiting → leaving today → overdue pickup → shipped, then next week's trucks. */
export function OutboundBoard({ data }: { data: ManagementSummary }) {
  const { t, tileLabel, dayColumns } = useDeskCopy();
  const o = data.outbound;
  const ladder: Array<{ tile: typeof o.finishedWaiting; tone: BoardTone }> = [
    { tile: o.finishedWaiting, tone: 'brand' },
    { tile: o.leavingToday, tone: 'info' },
    { tile: o.overduePickup, tone: o.overduePickup.count > 0 ? 'error' : 'neutral' },
    { tile: o.shippedAwaitingDealer, tone: o.shippedAwaitingDealer.count > 0 ? 'warning' : 'neutral' },
  ];
  const max = Math.max(1, ...ladder.map((l) => l.tile.count));
  const trucks = dayColumns(data.series?.deliveriesNext7, {
    href: tileLink(o.leavingToday.href, 'section=ready'),
  });
  const allZero = ladder.every((l) => l.tile.count === 0) && trucks.every((c) => c.value === 0);

  return (
    <Board tone={o.overduePickup.count > 0 ? 'error' : 'brand'}>
      <Board.Header title={t('mgmtSectionOutbound')} description={t('mgmtSectionOutboundHint')} />
      {allZero ? (
        <Board.Empty title={t('deskOutboundEmptyTitle')} description={t('deskOutboundEmptyBody')} />
      ) : (
        <Board.Body>
          <div className="space-y-3">
            {ladder.map(({ tile, tone }) => (
              <Link
                key={tile.key}
                href={tileLink(tile.href, tile.filter)}
                className="-mx-2 block rounded-[10px] px-2 py-1 transition-colors hover:bg-[var(--maher-surface-muted)]"
              >
                <Meter label={tileLabel(tile.key)} value={tile.count} max={max} tone={tone} />
              </Link>
            ))}
          </div>
          {trucks.length ? (
            <div className="mt-5">
              <p className="mb-2 text-[13px] leading-5 text-[var(--maher-text-secondary)]">
                {t('deskOutboundNext7')}
              </p>
              <DayStrip
                columns={trucks.map((c) => ({ ...c, tone: c.value > 0 ? 'brand' : 'neutral' }))}
                height={44}
                LinkComponent={Link}
              />
            </div>
          ) : null}
        </Board.Body>
      )}
    </Board>
  );
}
