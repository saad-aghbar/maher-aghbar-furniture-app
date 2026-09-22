'use client';

import { Link } from '@/i18n/navigation';
import { useMgmtCopy } from '@/lib/mgmtCopy';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink } from '@/lib/management-summary';
import { Board, Ribbon, type BoardTone } from '@maher/ui';
import { useDeskCopy } from './desk-shared';

const STATION_TONES: BoardTone[] = ['neutral', 'info', 'brand', 'warning', 'info', 'success'];

/** Where the open orders sit: one ribbon of shares and six station cells. */
export function FloorFlowBoard({ data }: { data: ManagementSummary }) {
  const { t } = useDeskCopy();
  const copy = useMgmtCopy();
  const steps = data.factoryFlow;
  const total = steps.reduce((s, x) => s + x.count, 0);

  return (
    <Board>
      <Board.Header
        title={t('mgmtSectionFactoryFlow')}
        description={t('mgmtSectionFactoryFlowHint')}
        meta={
          <span className="tabular-nums" dir="ltr">
            {total.toLocaleString('en-JO')} {t('deskOpenOrders')}
          </span>
        }
      />
      <Board.Body>
        <Ribbon
          legend={false}
          segments={steps.map((s, i) => ({
            key: s.key,
            value: s.count,
            label: copy.flowLabel(s.key, s.label),
            tone: STATION_TONES[i % STATION_TONES.length],
          }))}
        />
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {steps.map((step, i) => {
            const tone = STATION_TONES[i % STATION_TONES.length];
            const pct = total > 0 ? Math.round((step.count / total) * 100) : 0;
            return (
              <Link
                key={step.key}
                href={tileLink(step.href, step.filter)}
                className="maher-press group/cell flex flex-col gap-1 rounded-[12px] px-2 py-2 transition-colors hover:bg-[var(--maher-surface-muted)]"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `var(--maher-${tone === 'brand' ? 'brand' : tone === 'neutral' ? 'text-tertiary' : tone})` }}
                  />
                  <span
                    className={
                      step.count > 0
                        ? 'text-xl font-semibold leading-6 tabular-nums tracking-[-0.02em] text-[var(--maher-text-primary)]'
                        : 'text-xl font-semibold leading-6 tabular-nums text-[var(--maher-text-tertiary)]'
                    }
                    dir="ltr"
                  >
                    {step.count}
                  </span>
                </span>
                <span className="text-[12px] leading-4 text-[var(--maher-text-secondary)]">
                  {copy.flowLabel(step.key, step.label)}
                </span>
                <span className="text-[11px] leading-4 tabular-nums text-[var(--maher-text-tertiary)]" dir="ltr">
                  {pct}%
                </span>
              </Link>
            );
          })}
        </div>
      </Board.Body>
    </Board>
  );
}
