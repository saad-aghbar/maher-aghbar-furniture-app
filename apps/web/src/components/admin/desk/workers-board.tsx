'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary } from '@/lib/management-summary';
import { Board, Figure, Ribbon, Stamp } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

const SCHEDULING = '/admin/production/scheduling';

/** Who is on tools and how the open tasks are split. Hidden when the user cannot read tasks. */
export function WorkersBoard({ workers }: { workers: NonNullable<ManagementSummary['workers']> }) {
  const { t, tileLabel, locale } = useDeskCopy();
  const total = workers.assigned + workers.unassigned;

  return (
    <Board tone={workers.conflicts > 0 ? 'warning' : 'brand'}>
      <Board.Header
        title={t('mgmtSectionWorkers')}
        description={t('mgmtSectionWorkersHint')}
        meta={
          workers.conflicts > 0 ? (
            <Link href={SCHEDULING}>
              <Stamp tone="warning" size="sm">
                {workers.conflicts} {tileLabel('conflicts')}
              </Stamp>
            </Link>
          ) : null
        }
      />
      <Board.Body>
        <div className="flex items-end justify-between gap-4">
          <Link href={SCHEDULING} className="-m-1.5 rounded-[12px] p-1.5 transition-colors hover:bg-[var(--maher-surface-muted)]">
            <Figure value={workers.workingToday} label={t('deskWorkersOnTools')} locale={locale} />
          </Link>
          <Link href={SCHEDULING} className="-m-1.5 rounded-[12px] p-1.5 text-end transition-colors hover:bg-[var(--maher-surface-muted)]">
            <Figure value={total} size="sm" label={t('deskWorkersOpenTasks')} locale={locale} tone="neutral" />
          </Link>
        </div>
        <Ribbon
          className="mt-4"
          size="sm"
          segments={[
            { key: 'assigned', value: workers.assigned, label: tileLabel('assigned'), tone: 'brand' },
            {
              key: 'unassigned',
              value: workers.unassigned,
              label: tileLabel('unassigned'),
              tone: workers.unassigned > 0 ? 'warning' : 'neutral',
            },
          ]}
        />
      </Board.Body>
    </Board>
  );
}
