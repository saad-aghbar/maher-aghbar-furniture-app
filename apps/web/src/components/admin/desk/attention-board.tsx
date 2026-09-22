'use client';

import { Link } from '@/i18n/navigation';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, Stamp, Ticket } from '@maher/ui';
import { CheckCircle2 } from 'lucide-react';
import { useDeskCopy } from './desk-shared';
import { priorityTone } from './pick-focus';

const MAX = 5;

/** Up to five tickets that need a decision, critical first. */
export function AttentionBoard({ data }: { data: ManagementSummary }) {
  const { t } = useDeskCopy();
  const copy = useMgmtCopy();
  const cards = data.attention;
  const shown = cards.slice(0, MAX);
  const rest = cards.length - shown.length;
  const critical = cards.filter((c) => c.priority === 'critical').length;
  const tone = critical > 0 ? 'error' : cards.some((c) => c.priority === 'high') ? 'warning' : 'brand';

  return (
    <Board tone={cards.length ? tone : 'success'}>
      <Board.Header
        title={t('mgmtSectionAttention')}
        description={t('mgmtSectionAttentionHint')}
        meta={
          cards.length ? (
            <Stamp tone={tone} size="sm">
              {cards.length}
            </Stamp>
          ) : null
        }
      />
      {cards.length ? (
        <ul className="m-0 list-none divide-y divide-[var(--maher-border)] p-0">
          {shown.map((card) => {
            const cardTone = priorityTone(card.priority);
            return (
              <li key={card.id} className="m-0">
                <Ticket
                  tone={cardTone}
                  wash={card.priority === 'critical'}
                  title={copy.attentionTitle(card)}
                  why={copy.attentionWhy(card)}
                  action={copy.attentionAction(card)}
                  href={tileLink(card.href, card.filter)}
                  LinkComponent={Link}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <Board.Empty
          icon={<CheckCircle2 className="h-4 w-4" />}
          title={t('deskAttentionEmptyTitle')}
          description={t('deskAttentionEmptyBody')}
        />
      )}
      {rest > 0 ? (
        <Board.Footer>
          <span>{t('deskAttentionMore', { count: rest })}</span>
          {data.late?.overdue?.count ? (
            <Link
              href={tileLink(data.late.overdue.href, data.late.overdue.filter)}
              className="font-semibold text-[var(--maher-error)]"
            >
              {t('deskLateOrders', { count: data.late.overdue.count })}
            </Link>
          ) : null}
        </Board.Footer>
      ) : data.late?.overdue?.count ? (
        <Board.Footer>
          <span>{t('mgmtAtRiskLimited')}</span>
          <Link
            href={tileLink(data.late.overdue.href, data.late.overdue.filter)}
            className="font-semibold text-[var(--maher-error)]"
          >
            {t('deskLateOrders', { count: data.late.overdue.count })}
          </Link>
        </Board.Footer>
      ) : null}
    </Board>
  );
}
