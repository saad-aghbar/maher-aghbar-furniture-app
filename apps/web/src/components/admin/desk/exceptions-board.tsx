'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink, tileValues } from '@/lib/management-summary';
import { Board, Ticket, toneFromKey } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

/** Dark-ink tickets for open returns, dispositions and corrections. Renders nothing when clear. */
export function ExceptionsBoard({
  exceptions,
}: {
  exceptions: NonNullable<ManagementSummary['exceptions']>;
}) {
  const { t, tileLabel } = useDeskCopy();
  const rows = tileValues(exceptions).filter((tile) => tile.count > 0);
  if (!rows.length) return null;

  return (
    <Board tone="error" as="section">
      <Board.Header title={t('mgmtSectionExceptions')} description={t('mgmtSectionExceptionsHint')} />
      <ul className="m-0 list-none divide-y divide-[color:color-mix(in_oklab,var(--maher-background)_14%,transparent)] p-0">
        {rows.map((tile) => (
          <li key={tile.key} className="m-0">
            <Ticket
              ink="ink"
              tone={toneFromKey(tile.key, tile.count) === 'error' ? 'error' : 'warning'}
              title={tileLabel(tile.key)}
              trailing={
                <span className="text-base font-semibold tabular-nums" dir="ltr">
                  {tile.count}
                </span>
              }
              href={tileLink(tile.href, tile.filter)}
              LinkComponent={Link}
            />
          </li>
        ))}
      </ul>
    </Board>
  );
}
