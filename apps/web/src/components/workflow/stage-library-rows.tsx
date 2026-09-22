'use client';

import { apiFetch } from '@/lib/api-client';
import { stageLabel } from '@/lib/workflow-labels';
import { Board, Ltr, Stamp, type BoardTone } from '@maher/ui';
import { useQueries } from '@tanstack/react-query';
import { Camera, Lock, ShieldCheck, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export type StageLibraryRow = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameHe?: string | null;
  estimatedHours?: number | null;
  requiresInspection: boolean;
  requiresPhotos: boolean;
  responsibleDepartment?: string | null;
  schedulingResourceMode?: 'WORKER_CONSTRAINED' | 'RESOURCE_CONSTRAINED' | null;
  resourceSlots?: number | null;
};

type Worker = { id: string; firstName: string; lastName: string };

/**
 * Stage library rows — one Board per section, hairline rows with the skilled
 * worker count (mobile-only `production-stage-library/:id/workers`).
 */
export function StageLibraryRows<Row extends StageLibraryRow>({
  title,
  description,
  rows,
  onOpen,
  numbered,
  locked,
  caption,
  captionFor,
  tone = 'neutral',
}: {
  title: string;
  description?: string;
  rows: Row[];
  onOpen: (row: Row) => void;
  numbered?: boolean;
  locked?: boolean;
  caption?: string;
  captionFor?: (row: Row) => string;
  tone?: BoardTone;
}) {
  const locale = useLocale();
  const t = useTranslations('production');
  const workers = useQueries({
    queries: rows.map((row) => ({
      queryKey: ['stage-library-workers', row.id],
      queryFn: () => apiFetch<Worker[]>(`/api/v1/production-stage-library/${row.id}/workers`).catch(() => [] as Worker[]),
      staleTime: 5 * 60_000,
    })),
  });

  return (
    <Board tone={tone}>
      <Board.Header title={title} description={description} meta={<Stamp tone={tone} size="sm">{rows.length}</Stamp>} />
      <ol className="divide-y divide-[var(--maher-border)]">
        {rows.map((row, index) => {
          const w = workers[index]?.data ?? [];
          const loading = workers[index]?.isLoading;
          const cap = captionFor?.(row) ?? caption;
          return (
            <li key={row.id}>
              <button type="button" onClick={() => onOpen(row)} className="maher-press flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-[var(--maher-surface-muted)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--maher-border)] text-[12px] font-semibold text-[var(--maher-text-secondary)]" dir="ltr">
                  {locked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : numbered ? index + 1 : <Ltr>{row.code.slice(0, 2)}</Ltr>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[14px] font-semibold text-[var(--maher-text-primary)]">{stageLabel(locale, row)}</span>
                    {row.requiresInspection ? (
                      <Stamp tone="info" size="sm">
                        <ShieldCheck className="h-3 w-3" aria-hidden /> {t('workflow.filterInspection')}
                      </Stamp>
                    ) : null}
                    {row.requiresPhotos ? (
                      <Stamp tone="neutral" size="sm">
                        <Camera className="h-3 w-3" aria-hidden /> {t('workflow.filterPhotos')}
                      </Stamp>
                    ) : null}
                    {row.schedulingResourceMode === 'RESOURCE_CONSTRAINED' ? <Stamp tone="warning" size="sm">{t('workflow.resourceConstrained', { slots: row.resourceSlots ?? 1 })}</Stamp> : null}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--maher-text-tertiary)]">
                    <Ltr>{row.code}</Ltr>
                    {row.responsibleDepartment ? ` · ${row.responsibleDepartment}` : ''}
                    {row.estimatedHours ? ` · ${row.estimatedHours}h` : ''}
                    {cap ? ` · ${cap}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--maher-text-secondary)]" title={w.map((x) => `${x.firstName} ${x.lastName}`).join(', ')}>
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  <span dir="ltr">{loading ? '…' : w.length}</span>
                  <span className="sr-only">{t('workflow.skilledWorkers', { count: w.length })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Board>
  );
}
