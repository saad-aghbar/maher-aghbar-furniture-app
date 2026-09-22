'use client';

import { Link } from '@/i18n/navigation';
import type { ManagementSummary } from '@/lib/management-summary';
import { tileLink, tileValues } from '@/lib/management-summary';
import { Board, Figure, Ledger, LedgerRow, Ribbon, Sparkline } from '@maher/ui';
import { useMemo } from 'react';
import { useDeskCopy } from './desk-shared';

/** Today's inspection split and the 14-day pass rate. Folds "no open exceptions" when relevant. */
export function QualityBoard({
  quality,
  series,
  exceptionsAllClear,
}: {
  quality: NonNullable<ManagementSummary['quality']>;
  series: ManagementSummary['series'];
  exceptionsAllClear: boolean;
}) {
  const { t, tileLabel, locale } = useDeskCopy();

  const passRate = useMemo(() => {
    const days = series?.qualityLast14 ?? [];
    const points: number[] = [];
    let last: number | null = null;
    let anyData = false;
    for (const d of days) {
      const n = d.passed + d.failed;
      if (n > 0) {
        last = Math.round((d.passed / n) * 100);
        anyData = true;
      }
      points.push(last ?? 100);
    }
    const totals = days.reduce(
      (acc, d) => ({ passed: acc.passed + d.passed, failed: acc.failed + d.failed }),
      { passed: 0, failed: 0 },
    );
    const overall =
      totals.passed + totals.failed > 0
        ? Math.round((totals.passed / (totals.passed + totals.failed)) * 100)
        : null;
    return { points: anyData ? points : [], overall };
  }, [series]);

  const failing = quality.failRework.count > 0;
  const allZero = tileValues(quality).every((tile) => tile.count === 0) && !passRate.points.length;

  return (
    <Board tone={failing ? 'error' : 'success'}>
      <Board.Header title={t('mgmtSectionQuality')} description={t('mgmtSectionQualityHint')} />
      {allZero ? (
        <Board.Empty title={t('deskQualityEmptyTitle')} description={t('deskQualityEmptyBody')} />
      ) : (
        <Board.Body>
          {passRate.points.length ? (
            <div className="flex items-end justify-between gap-4">
              <Figure
                value={passRate.overall != null ? `${passRate.overall}%` : '—'}
                label={t('deskQualityPassRate')}
                locale={locale}
                tone={passRate.overall != null && passRate.overall < 80 ? 'warning' : 'success'}
              />
              <div className="w-1/2 max-w-[220px]">
                <Sparkline
                  points={passRate.points}
                  tone={failing ? 'error' : 'success'}
                  height={44}
                  baseline="auto"
                />
              </div>
            </div>
          ) : null}

          <Ribbon
            className={passRate.points.length ? 'mt-4' : undefined}
            size="sm"
            segments={[
              { key: 'passed', value: quality.passedToday.count, label: tileLabel('passedToday'), tone: 'success' },
              { key: 'fail', value: quality.failRework.count, label: tileLabel('failRework'), tone: 'error' },
              { key: 'waiting', value: quality.waitingInspection.count, label: tileLabel('waitingInspection'), tone: 'info' },
            ]}
          />

          {quality.readyReinspection.count > 0 ? (
            <Ledger className="mt-3 border-t border-[var(--maher-border)] pt-1">
              <LedgerRow
                label={tileLabel('readyReinspection')}
                value={quality.readyReinspection.count}
                tone="warning"
                stamp
                href={tileLink(quality.readyReinspection.href, quality.readyReinspection.filter)}
                LinkComponent={Link}
              />
            </Ledger>
          ) : null}
        </Board.Body>
      )}
      {exceptionsAllClear ? (
        <Board.Footer>
          <span>{t('deskExceptionsEmpty')}</span>
        </Board.Footer>
      ) : null}
    </Board>
  );
}
