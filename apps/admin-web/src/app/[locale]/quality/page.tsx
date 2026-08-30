'use client';

import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  EmptyState,
  ErrorState,
  Ltr,
  PageHero,
  Skeleton,
  StatusBadge,
} from '@maher/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

type InspectionRow = {
  id: string;
  number: string;
  result?: string | null;
  stageCode?: string | null;
  createdAt?: string;
  productionOrderId?: string;
  productionOrder?: {
    id: string;
    number: string;
    status?: string;
    productDescription?: string | null;
  } | null;
  rework?: Array<{ id: string; status: string }>;
};

type AttentionCard = {
  kind: string;
  titleEn?: string;
  subtitleEn?: string;
  reasonEn?: string;
  actionEn?: string;
  productionOrderId: string;
  productionOrderNumber?: string;
  inspectionId?: string | null;
  reworkId?: string;
};

function hasOpenRework(row: InspectionRow): boolean {
  return (row.rework ?? []).some((rw) =>
    ['AWAITING_STAGE', 'IN_PROGRESS', 'OPEN'].includes(String(rw.status).toUpperCase()),
  );
}

export default function QualityListPage() {
  const tNav = useTranslations('navigation');
  const tc = useTranslations('catalog');
  const tp = useTranslations('production');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('statuses');

  const listQuery = useQuery({
    queryKey: ['quality-inspections', 'list'],
    queryFn: () =>
      apiFetch<{ data: InspectionRow[] }>('/api/v1/quality-inspections?page=1&pageSize=50'),
    placeholderData: keepPreviousData,
  });

  const attentionQuery = useQuery({
    queryKey: ['quality-inspections', 'attention'],
    queryFn: () => apiFetch<AttentionCard[]>('/api/v1/quality-inspections/attention'),
    staleTime: 30_000,
  });

  const attentionByInspection = useMemo(() => {
    const map = new Set<string>();
    for (const card of attentionQuery.data ?? []) {
      if (card.inspectionId) map.add(card.inspectionId);
    }
    return map;
  }, [attentionQuery.data]);

  const attentionByOrder = useMemo(() => {
    const map = new Set<string>();
    for (const card of attentionQuery.data ?? []) {
      if (card.productionOrderId) map.add(card.productionOrderId);
    }
    return map;
  }, [attentionQuery.data]);

  function statusLabel(code: string | null | undefined): string {
    if (!code) return tc('pending');
    try {
      return tStatus(code as never);
    } catch {
      return code.replace(/_/g, ' ');
    }
  }

  if (listQuery.isLoading && !listQuery.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <ErrorState
        title={tNav('quality')}
        onRetry={() => listQuery.refetch()}
        retryLabel={tCommon('retry')}
      />
    );
  }

  const rows = listQuery.data?.data ?? [];
  const attention = attentionQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHero title={tNav('quality')} description={tc('inspections')} tone="soft" />

      {attention.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">{tp('qualityAttentionTitle')}</h2>
          <ul className="space-y-2">
            {attention.map((card) => (
              <li key={card.reworkId ?? `${card.productionOrderId}-${card.inspectionId}`}>
                <Link
                  href={
                    card.inspectionId
                      ? `/quality/${card.inspectionId}`
                      : `/production/${card.productionOrderId}`
                  }
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--maher-warning)]/40 bg-[var(--maher-warning-soft)] px-3 py-3 transition hover:border-[var(--maher-warning)]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--maher-warning)]" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-text-primary">
                      {tp('qualityAttentionBadge')}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {card.subtitleEn ?? card.productionOrderNumber}
                    </p>
                    {card.reasonEn ? (
                      <p className="text-xs text-text-secondary line-clamp-2">{card.reasonEn}</p>
                    ) : null}
                    {card.actionEn ? (
                      <p className="text-xs font-medium text-[var(--maher-warning)]">
                        {card.actionEn}
                      </p>
                    ) : null}
                  </div>
                  {card.productionOrderNumber ? (
                    <Ltr className="text-xs font-medium text-text-tertiary">
                      {card.productionOrderNumber}
                    </Ltr>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title={tc('noInspections')} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const poId = row.productionOrderId ?? row.productionOrder?.id;
            const needsAttention =
              attentionByInspection.has(row.id) ||
              (poId ? attentionByOrder.has(poId) : false) ||
              hasOpenRework(row);
            return (
              <li key={row.id}>
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3 ${
                    needsAttention
                      ? 'border-[var(--maher-warning)]/50 bg-[var(--maher-warning-soft)]/60'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    {needsAttention ? (
                      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--maher-warning)]">
                        <AlertTriangle className="h-3 w-3" />
                        {tp('qualityAttentionBadge')}
                      </p>
                    ) : null}
                    <Link
                      href={`/quality/${row.id}`}
                      className="font-semibold text-brand hover:underline"
                      dir="ltr"
                    >
                      {row.number}
                    </Link>
                    <p className="text-xs text-text-secondary">
                      {row.productionOrder?.productDescription ??
                        row.stageCode ??
                        tc('inspectionDetail')}
                    </p>
                    {poId ? (
                      <Link
                        href={`/production/${poId}`}
                        className="text-xs text-text-tertiary hover:text-brand"
                        dir="ltr"
                      >
                        {row.productionOrder?.number ?? poId}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.result ? (
                      <StatusBadge status={row.result} label={statusLabel(row.result)} />
                    ) : (
                      <StatusBadge status="PENDING" label={tc('pending')} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
