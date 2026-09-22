'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Board, BoardSkeleton, Figure, KeyFacts, Stamp, Timeline, type BoardTone } from '@maher/ui';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

type TimelineEvent = {
  at: string;
  kind: string;
  titleEn?: string;
  detailEn?: string | null;
  actorName?: string | null;
};

type InspectionSummary = {
  id: string;
  number: string;
  result?: string | null;
  stageCode?: string | null;
  createdAt?: string;
  inspectedAt?: string | null;
};

type OpenRework = {
  id: string;
  number?: string;
  status: string;
  description?: string | null;
};

type QualityFloorContext = {
  orderStatus: string;
  currentStageCode?: string | null;
  latestInspection?: InspectionSummary | null;
  inspections?: InspectionSummary[];
  openRework?: OpenRework | null;
  expectedPackages?: Array<{ code: string; labelEn: string; labelAr?: string }>;
  packagingUnlocked?: boolean;
  lightAnalytics?: {
    inspectionAttempts?: number;
    reworkCount?: number;
    failureCategories?: string[];
    latestResult?: string | null;
    openReworkStatus?: string | null;
  };
  timeline?: TimelineEvent[];
};

type Props = {
  productionOrderId: string;
};

function timelineKindLabel(
  kind: string,
  tp: ReturnType<typeof useTranslations>,
): string {
  switch (kind) {
    case 'INSPECTION_STARTED':
      return tp('qualityTimelineInspectionStarted');
    case 'INSPECTION_PASSED':
      return tp('qualityTimelineInspectionPassed');
    case 'INSPECTION_FAILED':
      return tp('qualityTimelineInspectionFailed');
    case 'REWORK_STARTED':
      return tp('qualityTimelineReworkStarted');
    case 'REWORK_COMPLETED':
      return tp('qualityTimelineReworkCompleted');
    case 'REWORK_MATERIAL':
      return tp('qualityTimelineReworkMaterial');
    case 'REINSPECTION':
      return tp('qualityTimelineReinspection');
    case 'PACKAGING_COMPLETED':
      return tp('qualityTimelinePackagingCompleted');
    case 'FIN_POSTED':
      return tp('qualityTimelineFinPosted');
    default:
      return kind.replace(/_/g, ' ');
  }
}

function packageLabel(
  pkg: { labelEn: string; labelAr?: string },
  locale: string,
): string {
  if (locale === 'ar' && pkg.labelAr) return pkg.labelAr;
  return pkg.labelEn;
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ProductionQualityPanel({ productionOrderId }: Props) {
  const tp = useTranslations('production');
  const tStatus = useTranslations('statuses');
  const locale = useLocale();

  const contextQuery = useQuery({
    queryKey: ['quality-floor-context', productionOrderId],
    queryFn: () =>
      apiFetch<QualityFloorContext>(
        `/api/v1/quality-inspections/orders/${encodeURIComponent(productionOrderId)}/context`,
      ),
    enabled: Boolean(productionOrderId),
  });

  const ctx = contextQuery.data;
  const analytics = ctx?.lightAnalytics;
  const inspections = ctx?.inspections ?? [];
  const timeline = ctx?.timeline ?? [];
  const packages = ctx?.expectedPackages ?? [];
  const latest = ctx?.latestInspection ?? null;
  const openRework = ctx?.openRework ?? null;
  const latestResult = analytics?.latestResult ?? latest?.result ?? null;

  function statusLabel(code: string | null | undefined): string {
    if (!code) return '—';
    try {
      return tStatus(code as never);
    } catch {
      return code.replace(/_/g, ' ');
    }
  }

  const resultTone = (r?: string | null): BoardTone => (r === 'PASSED' || r === 'PASS' ? 'success' : r === 'FAILED' || r === 'FAIL' ? 'error' : r === 'PARTIAL' ? 'warning' : 'info');
  const tone: BoardTone = openRework ? 'error' : latestResult ? resultTone(latestResult) : 'info';

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Board tone={tone} wash="top">
        <Board.Header title={tp('hubQuality')} description={tp('qualityHint')} meta={inspections.length > 0 ? <Stamp tone={tone} size="sm">{inspections.length}</Stamp> : null} />
        {contextQuery.isLoading ? (
          <BoardSkeleton header={false} rows={3} />
        ) : contextQuery.isError ? (
          <Board.Empty title={tp('qualityError')} />
        ) : !ctx ? (
          <Board.Empty title={tp('qualityEmptyTitle')} description={tp('qualityEmptyBody')} />
        ) : (
          <Board.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Figure size="sm" value={analytics?.inspectionAttempts ?? inspections.filter((i) => i.result).length} label={tp('qualityAttempts')} delta={tp('qualityReworkCount', { count: analytics?.reworkCount ?? 0 })} />
              <div>
                <p className="text-[12px] leading-4 text-[var(--maher-text-tertiary)]">{tp('qualityLatestResult')}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {latestResult ? <Stamp tone={resultTone(latestResult)}>{statusLabel(latestResult)}</Stamp> : <span className="text-[13px] text-[var(--maher-text-secondary)]">{tp('qualityPending')}</span>}
                  {latest?.number ? (
                    <Link href={`/admin/quality/${latest.id}`} className="text-[12px] font-medium text-[var(--maher-brand)] hover:underline" dir="ltr">
                      {latest.number}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <KeyFacts
              columns={2}
              facts={[
                { label: tp('qualityState'), value: <Stamp tone={tone} size="sm">{statusLabel(ctx.orderStatus)}</Stamp> },
                { label: tp('stage'), value: ctx.currentStageCode ?? '—', ltr: true },
                {
                  label: tp('qualityOpenRework'),
                  wide: true,
                  value: openRework ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Stamp tone="error" size="sm">{statusLabel(openRework.status)}</Stamp>
                      {openRework.number ? <span dir="ltr">{openRework.number}</span> : null}
                      {openRework.description ? <span className="text-[var(--maher-text-secondary)]">— {openRework.description}</span> : null}
                    </span>
                  ) : (
                    tp('qualityNoOpenRework')
                  ),
                },
              ]}
            />
            {packages.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[12px] text-[var(--maher-text-tertiary)]">
                  {tp('qualityExpectedPackages')}
                  {ctx.packagingUnlocked ? <span className="ms-1.5 text-[var(--maher-success)]">· {tp('qualityPackagingUnlocked')}</span> : null}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {packages.map((pkg) => (
                    <li key={pkg.code}>
                      <Stamp tone="neutral" size="sm">
                        <span dir="ltr">{pkg.code}</span>
                        <span className="ms-1 font-normal text-[var(--maher-text-secondary)]">{packageLabel(pkg, locale)}</span>
                      </Stamp>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Board.Body>
        )}
      </Board>

      <div className="space-y-5">
        <Board tone="neutral">
          <Board.Header title={tp('qualityInspections')} />
          {inspections.length === 0 ? (
            <Board.Empty title={tp('qualityEmptyTitle')} description={tp('qualityEmptyBody')} />
          ) : (
            <ul className="divide-y divide-[var(--maher-border)]">
              {inspections.map((insp) => (
                <li key={insp.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span className="min-w-0">
                    <Link href={`/admin/quality/${insp.id}`} className="font-semibold text-[var(--maher-text-primary)] hover:text-[var(--maher-brand)]" dir="ltr">
                      {insp.number}
                    </Link>
                    {insp.stageCode ? <span className="block text-[12px] text-[var(--maher-text-tertiary)]">{insp.stageCode}</span> : null}
                  </span>
                  {insp.result ? <Stamp tone={resultTone(insp.result)} size="sm">{statusLabel(insp.result)}</Stamp> : <span className="text-[12px] text-[var(--maher-text-secondary)]">{tp('qualityPending')}</span>}
                </li>
              ))}
            </ul>
          )}
        </Board>
        {timeline.length > 0 ? (
          <Board tone="neutral">
            <Board.Header title={tp('qualityTimeline')} />
            <Timeline
              dense
              className="px-5 py-4"
              items={[...timeline].reverse().map((ev, idx) => ({
                id: `${ev.at}-${ev.kind}-${idx}`,
                time: formatWhen(ev.at, locale),
                title: timelineKindLabel(ev.kind, tp),
                description: ev.detailEn ?? undefined,
                actor: ev.actorName ?? undefined,
                tone: (ev.kind.toLowerCase().includes('fail') || ev.kind.toLowerCase().includes('rework') ? 'error' : ev.kind.toLowerCase().includes('pass') ? 'success' : 'neutral') as BoardTone,
              }))}
            />
          </Board>
        ) : null}
      </div>
    </div>
  );
}
