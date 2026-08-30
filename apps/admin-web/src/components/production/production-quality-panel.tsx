'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import { Badge, Card, EmptyState, Skeleton, StatusBadge } from '@maher/ui';
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

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--maher-brand)]">
            {tp('qualityEyebrow')}
          </p>
          <h2 className="text-base font-semibold">{tp('hubQuality')}</h2>
          <p className="text-sm text-text-secondary">{tp('qualityHint')}</p>
        </div>
        {inspections.length > 0 ? <Badge>{inspections.length}</Badge> : null}
      </div>

      {contextQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : contextQuery.isError ? (
        <p className="text-sm text-[var(--maher-error)]">{tp('qualityError')}</p>
      ) : !ctx ? (
        <EmptyState title={tp('qualityEmptyTitle')} description={tp('qualityEmptyBody')} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] p-3">
              <p className="text-xs text-text-tertiary">{tp('qualityState')}</p>
              <div className="mt-1">
                <StatusBadge status={ctx.orderStatus} label={statusLabel(ctx.orderStatus)} />
              </div>
              {ctx.currentStageCode ? (
                <p className="mt-1 text-xs text-text-secondary">
                  {tp('stage')}: {ctx.currentStageCode}
                </p>
              ) : null}
            </div>
            <div className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] p-3">
              <p className="text-xs text-text-tertiary">{tp('qualityLatestResult')}</p>
              <div className="mt-1">
                {latestResult ? (
                  <StatusBadge status={latestResult} label={statusLabel(latestResult)} />
                ) : (
                  <span className="text-sm text-text-secondary">{tp('qualityPending')}</span>
                )}
              </div>
              {latest?.number ? (
                <Link
                  href={`/quality/${latest.id}`}
                  className="mt-1 inline-block text-xs font-medium text-brand hover:underline"
                  dir="ltr"
                >
                  {latest.number}
                </Link>
              ) : null}
            </div>
            <div className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] p-3">
              <p className="text-xs text-text-tertiary">{tp('qualityAttempts')}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums" dir="ltr">
                {analytics?.inspectionAttempts ?? inspections.filter((i) => i.result).length}
              </p>
              <p className="text-xs text-text-secondary">
                {tp('qualityReworkCount', { count: analytics?.reworkCount ?? 0 })}
              </p>
            </div>
            <div className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] p-3">
              <p className="text-xs text-text-tertiary">{tp('qualityOpenRework')}</p>
              {openRework ? (
                <div className="mt-1 space-y-1">
                  <StatusBadge
                    status={openRework.status}
                    label={statusLabel(openRework.status)}
                  />
                  {openRework.number ? (
                    <p className="text-xs text-text-secondary" dir="ltr">
                      {openRework.number}
                    </p>
                  ) : null}
                  {openRework.description ? (
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {openRework.description}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-sm text-text-secondary">{tp('qualityNoOpenRework')}</p>
              )}
            </div>
          </div>

          {packages.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('qualityExpectedPackages')}
                {ctx.packagingUnlocked ? (
                  <span className="ms-2 font-normal normal-case text-[var(--maher-success)]">
                    · {tp('qualityPackagingUnlocked')}
                  </span>
                ) : null}
              </p>
              <ul className="flex flex-wrap gap-2">
                {packages.map((pkg) => (
                  <li
                    key={pkg.code}
                    className="rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium" dir="ltr">
                      {pkg.code}
                    </span>
                    <span className="ms-1.5 text-text-secondary">
                      {packageLabel(pkg, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {inspections.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('qualityInspections')}
              </p>
              <ul className="space-y-2">
                {inspections.map((insp) => (
                  <li
                    key={insp.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--maher-radius-md)] border border-border bg-[var(--maher-surface-muted)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/quality/${insp.id}`}
                        className="font-medium text-brand hover:underline"
                        dir="ltr"
                      >
                        {insp.number}
                      </Link>
                      {insp.stageCode ? (
                        <p className="text-xs text-text-secondary">{insp.stageCode}</p>
                      ) : null}
                    </div>
                    {insp.result ? (
                      <StatusBadge status={insp.result} label={statusLabel(insp.result)} />
                    ) : (
                      <span className="text-xs text-text-secondary">{tp('qualityPending')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title={tp('qualityEmptyTitle')} description={tp('qualityEmptyBody')} />
          )}

          {timeline.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {tp('qualityTimeline')}
              </p>
              <ol className="space-y-2 border-s border-border ps-3">
                {[...timeline].reverse().map((ev, idx) => (
                  <li key={`${ev.at}-${ev.kind}-${idx}`} className="relative text-sm">
                    <span className="absolute -start-[17px] top-1.5 h-2 w-2 rounded-full bg-[var(--maher-brand)]" />
                    <p className="font-medium">{timelineKindLabel(ev.kind, tp)}</p>
                    {ev.detailEn ? (
                      <p className="text-xs text-text-secondary line-clamp-2">{ev.detailEn}</p>
                    ) : null}
                    <p className="text-[11px] text-text-tertiary">
                      <span dir="ltr">{formatWhen(ev.at, locale)}</span>
                      {ev.actorName ? ` · ${ev.actorName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
