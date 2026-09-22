'use client';

import { Link } from '@/i18n/navigation';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import type { MgmtActivityItem } from '@/lib/management-summary';
import { Board, cn, type BoardTone } from '@maher/ui';
import { ArrowUpRight } from 'lucide-react';
import { useDeskCopy } from './desk-shared';

function kindTone(kind?: string): BoardTone {
  switch (kind) {
    case 'qc':
      return 'success';
    case 'payment':
      return 'success';
    case 'truckDeparted':
    case 'deliveryUpdated':
      return 'info';
    case 'returnStatus':
      return 'warning';
    case 'grn':
    case 'finishedGoods':
    case 'finishedGoodsPlain':
    case 'taskCompleted':
      return 'brand';
    default:
      return 'neutral';
  }
}

/** Spine timeline of today's events. Elastic: fills the column and scrolls inside. */
export function ActivityBoard({
  items,
  className,
}: {
  items: MgmtActivityItem[];
  className?: string;
}) {
  const { t, time } = useDeskCopy();
  const copy = useMgmtCopy();

  return (
    <Board tone="neutral" className={cn('xl:flex-1', className)}>
      <Board.Header stamp={false} title={t('mgmtSectionActivity')} description={t('mgmtSectionActivityHint')} />
      {items.length ? (
        <Board.Body padding="none" grow className="max-h-[26rem] overflow-y-auto xl:max-h-none">
          <ol className="relative m-0 list-none py-2 ps-0">
            <span
              aria-hidden
              className="absolute inset-y-3 start-[27px] w-px bg-[var(--maher-border)]"
            />
            {items.map((item, i) => {
              const tone = kindTone(item.kind);
              const ink = `var(--maher-${tone === 'brand' ? 'brand' : tone === 'neutral' ? 'text-tertiary' : tone})`;
              const body = (
                <>
                  <span className="relative z-[1] mt-[7px] flex h-3 w-3 shrink-0 items-center justify-center">
                    <span
                      className="h-2 w-2 rounded-full ring-[3px] ring-[var(--maher-surface)]"
                      style={{ background: ink }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5 text-[var(--maher-text-primary)]">
                      {copy.eventLabel(item)}
                    </span>
                    <span className="block text-xs leading-4 tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                      {time(item.at)}
                    </span>
                  </span>
                  {item.href ? (
                    <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--maher-text-tertiary)] rtl:-scale-x-100" />
                  ) : null}
                </>
              );
              const rowClass = 'flex items-start gap-3 px-5 py-2';
              return (
                <li key={`${item.at}-${i}`} className="m-0">
                  {item.href ? (
                    <Link href={item.href} className={cn(rowClass, 'transition-colors hover:bg-[var(--maher-surface-muted)]')}>
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </Board.Body>
      ) : (
        <Board.Empty
          title={t('deskActivityEmptyTitle')}
          description={t('deskActivityEmptyBody')}
          className="flex-1 justify-center"
        />
      )}
    </Board>
  );
}
